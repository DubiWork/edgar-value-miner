# Technical Strategy Review

## Domain: Technical Strategy
## Mode: feature-breakdown

## Summary

The Phase 1.5 design spec is unusually strong for a solo-developer product — visual system is well-thought-out, the sparkline decision is justified, and the pre-work refactor sequencing (#228–#232) shows genuine architectural awareness. However, three structural gaps must be resolved before implementation begins: (1) the data layer extension (uncapping `ANNUAL_YEARS`/`QUARTERLY_PERIODS`) has no written technical plan — it is filed as a ticket note, not an architectural spec; (2) agent assignments across the pre-work issues default implicitly to a general implementer rather than the `react-specialist` / `typescript-pro` split required; (3) the test strategy is absent for 100% of the new stories, with the only test mention being the Playwright visual-regression exit criterion at the very end of the spec.

---

## Findings

### [sd-no-tech-approach] — Data Layer Extension Has No Architecture Document

**Severity:** HIGH

**Evidence:**
The design spec lists "uncap `ANNUAL_YEARS`/`QUARTERLY_PERIODS`" as a bullet under "Dependencies" but provides zero architectural detail. The current code in `gaapNormalizer.js` has hard-coded constants `ANNUAL_YEARS = 5` and `QUARTERLY_PERIODS = 20` with no config injection, no pagination, and no client-side memory ceiling. The raw SEC Company Facts payload for a large-cap company (e.g., Apple) contains 40+ years of XBRL data across dozens of tags — the full JSON response can exceed 4–8 MB. There is no documented decision for:

- Whether the full payload is fetched once and sliced client-side, or whether a Cloud Function pre-aggregates and paginates it
- What the L1 IndexedDB schema change looks like for raw vs. normalized split (#232 mentions "raw-vs-normalized caching decision" but this is unspecified)
- How the `gaapNormalizer.js` SRP split (#233, approaching 1500 lines) interacts with the new full-history extraction — if the split happens after the uncap, the normalizer will briefly be even larger
- Whether `normalizeCompanyFacts()` is called once for the whole payload (memory spike on every load: 40 years × 35 metrics × potentially 4 filings/year = ~5600 data points, all held in memory) or lazily per-tab
- The `markStaleInIndexedDB` silent no-op (#222) means the L1 cache will serve stale full-history data indefinitely — this is CRITICAL for correctness before uncapping

The technical spec checklist requires: data model schema changes, migration strategy, integration points, and scalability consideration (technical-specs.md). None of these are documented for the data layer extension.

**Recommendation:**
Before any statement-grid story begins, produce a 1-page "Data Layer Spec" covering:
1. Payload size budget: benchmark raw AAPL/MSFT Company Facts JSON and document p95 payload size
2. Normalization boundary: decide whether `gaapNormalizer` runs in a Cloud Function (pre-aggregated, sends only needed metric arrays) or stays client-side with a hard memory cap
3. Cache schema for raw-vs-normalized split (#232): document the IndexedDB key structure, TTL, and invalidation path — this must fix #222 before uncapping
4. `ANNUAL_YEARS`/`QUARTERLY_PERIODS` constants: replace with config-injectable values that default to `Infinity` (or configurable max) and validate in tests against a real 40-year payload
5. gaapNormalizer SRP split (#233) must be completed BEFORE uncapping — splitting a 1500-line file mid-feature is a merge conflict trap

---

### [sd-no-tech-approach] — Brush Minimap and URL-State Sync Are Undesigned

**Severity:** MEDIUM

**Evidence:**
The control bar specifies a 200×24px "draggable brush minimap (Revenue area chart)" but provides no technical design. This is a non-trivial implementation:
- A smooth-drag brush on a 200px canvas requires `requestAnimationFrame` or a pointer-events handler that avoids layout thrash during drag — the spec acknowledges this as a "performance concern" but gives no decision
- The spec states d3-brush is "likely needs a small library" but this is unresolved — no build-vs-buy decision was made
- URL state sync (`?range=5Y&granularity=quarterly`) + localStorage persistence + React state is a 3-way sync problem; without a documented state ownership model (single source of truth → URL params → React state from URL, or React state → URL as side effect), implementers will make inconsistent choices across components
- The spec lists the control bar as "global (all views sync)" — the sync mechanism between the control bar, the grid, and the slide-over chart drill-down is unspecified

The design-handoff.md checklist requires: interaction specs (animations/transitions defined) and responsive specs. The brush minimap has neither.

**Recommendation:**
- Decide on d3-brush vs. custom canvas/SVG now. d3-brush is ~12KB gzipped, is well-tested, and handles pointer events correctly across touch/mouse — use it. Custom canvas saves 12KB but costs 2–3x implementation time and introduces drag-edge bugs. Apply the "boring strategy wins" principle (Will Larson) — use the proven tool.
- Document state ownership: URL params are the single source of truth; on mount, React state is hydrated from URL params; on user change, React state updates, URL updates as a side effect via `useEffect`. localStorage writes the last-used state per ticker as a convenience, not as truth.
- The `react-specialist` should own this design decision, not be handed ambiguous "URL-synced state" requirements.

---

### [sd-no-tech-approach] — Statement Grid Virtualization Decision Is Missing

**Severity:** MEDIUM

**Evidence:**
The spec describes "30-50 raw SVG sparklines rendering simultaneously" as a known performance concern but does not specify whether row virtualization is required. At full expansion (35+ line items × 40+ periods), the DOM node count for the grid is:
- 35 rows × 40 columns = 1400 `<td>` cells
- Each row has an inline SVG sparkline: ~40 SVG elements (path, rect, linearGradient, stop × 2) = 35 × 40 = 1400 SVG nodes
- Total DOM nodes in the expanded grid: ~2800–4000+ nodes

This is above the threshold where CSS `position: sticky` begins to degrade on Chromium (sticky recalculation at ~2000+ table cells). The spec says "sticky headers + sticky left column (CSS position: sticky)" but does not acknowledge this risk.

The spec also asks "Is raw SVG sparkline the right call at 30-50 instances? What's the perf ceiling?" — this is explicitly an open question in the task brief, meaning the implementation team is expected to answer it before building.

**Recommendation:**
- SVG sparklines at 30–50 instances: **acceptable** — each sparkline is ~40 SVG nodes, totaling ~1500–2000 nodes for all sparklines simultaneously. This is within budget for modern browsers. The risk is not the sparklines themselves but the full expanded grid state.
- Add a virtualization decision to the spec: use `@tanstack/react-virtual` for rows when the total visible row count exceeds 20. The grid should default to collapsed groups (per the spec's progressive disclosure model), which keeps the visible row count at ~4–10 and makes virtualization optional for the default state. Only the MAX-expand all-groups scenario needs it.
- The `react-specialist` should prototype one full-expansion scenario with 35 rows + sparklines before committing to the grid architecture, following the tracer-bullet principle.

---

### [sd-no-tech-approach] — Open Security Issues Must Be Resolved Before New Route Ships

**Severity:** CRITICAL

**Evidence:**
Three known security/correctness issues from the known-risks list are directly in the path of Phase 1.5:

1. **#221 — No `firestore.rules`**: Cache poisoning is possible. The new `/statements` route adds a new Firestore collection path for the raw-vs-normalized cache split (#232). Without security rules, any authenticated user can write to any Firestore path — including poisoning other users' cached financial data.
2. **#226 — FMP API key in client bundle**: The Financial Modeling Prep API key is exposed in the Vite bundle. This is an OWASP A02:2021 (Cryptographic Failures / Sensitive Data Exposure) violation. Shipping Phase 1.5 without fixing this adds more surface area.
3. **#222 — `markStaleInIndexedDB` silent no-op**: L1 cache invalidation is broken. Uncapping to full history means stale full-history data will be served indefinitely from IndexedDB with no way to expire it. Users will see incorrect historical data for companies that have restated financials.

The technical-specs.md security section requirement states: "Auth/authz approach, data protection, threat model considered, compliance requirements." None of these are addressed in the Phase 1.5 spec.

**Recommendation:**
Gate Phase 1.5 implementation behind three pre-conditions:
1. `firestore.rules` must be shipped and reviewed by `security-auditor` before any new Firestore paths are added
2. FMP API key must be moved to a Cloud Function secret (Firebase Secret Manager) before Phase 1.5 goes to production
3. `markStaleInIndexedDB` must be a real implementation before the data layer is uncapped — otherwise Phase 1.5 ships with permanent cache poisoning for full-history data

---

### [sd-wrong-agent] — Agent Assignment Gaps Across Pre-Work Stories

**Severity:** HIGH

**Evidence:**
The pre-work issues (#228–#233) and the Phase 1.5 implementation stories have no explicit agent assignments in the spec or plan. Based on the task domains:

| Story/Task | Domain | Correct Agent | Risk if Wrong |
|---|---|---|---|
| #228 Generic FinancialBarChart extraction | React component refactor | `react-specialist` | General implementer will miss Recharts ResponsiveContainer memoization patterns |
| #229 Config/registry-driven useKeyMetrics | React hooks + TypeScript | `react-specialist` + `typescript-pro` | Formatter registry needs TypeScript generics; wrong typing = runtime errors at runtime |
| #230 Unify derived metrics | Data transform logic | `react-specialist` | Moving margins into normalizeCompanyFacts requires understanding the hook dependency graph |
| #231 Dedup normalizeTicker | Utility refactor | `react-specialist` | 4 copies means 4 call sites — missing one = silent regression |
| #232 Cache raw-vs-normalized + route split | Firebase + React Router | `react-specialist` + `devops-engineer` (for Cloud Functions) | Route split touches both client routing and Firebase function config |
| #233 gaapNormalizer SRP split | Pure JS utility | `typescript-pro` | 1500-line module; splitting requires careful re-export strategy |
| Statement grid component | React + accessibility | `react-specialist` | role="grid" + keyboard nav requires aria expertise |
| Raw SVG sparklines | React + SVG | `react-specialist` | Inline SVG with useChartTheme integration |
| Brush minimap | React + canvas/d3 | `react-specialist` | rAF-based drag needs performance expertise |
| Testing (all stories) | React Testing Library | `test-automator` + `qa-expert` | No test agent assigned = no tests |

The `CLAUDE.md` rule is explicit: "Using a general agent when a specialized one exists = FAILED TASK." All of these stories resolve to `react-specialist` as the primary agent, with `typescript-pro` for the normalizer split and `test-automator` for test coverage.

**Recommendation:**
Assign `react-specialist` as the primary implementation agent for all Phase 1.5 stories. Assign `test-automator` as a mandatory parallel agent for each story (write tests first, per VIRE TDD rule). Assign `typescript-pro` for #233 gaapNormalizer split. Assign `devops-engineer` for any Cloud Functions changes in #232.

---

### [sd-missing-test-strategy] — No Test Strategy for Any Phase 1.5 Story

**Severity:** CRITICAL

**Evidence:**
The design spec's only mention of testing is: "Playwright `toHaveScreenshot()` baselines captured ONLY after this design is built and human-approved — never snapshot the pre-redesign state."

This is a visual regression exit criterion — it is not a test strategy. The following testing levels are entirely absent:

- **Unit tests**: No mention of testing the new `ANNUAL_YEARS`/`QUARTERLY_PERIODS` uncapping, the formatter registry (#229), the derived-metric unification (#230), or the normalizeTicker dedup (#231). Given that `gaapNormalizer.js` is 1500+ lines, the normalizer is the highest-risk module in the entire codebase — it has no confirmed test coverage for the quarterly path (#225 notes quarterly data is "capped and untested").
- **Integration tests**: No mention of testing the cache coordinator with the new raw-vs-normalized split, or the `/statements` route loading end-to-end from IndexedDB → Firestore → SEC API fallback chain.
- **Component tests (React Testing Library)**: The statement grid has complex interactivity — collapsible groups, keyboard navigation, sparkline rendering, URL sync. None of these have acceptance test scenarios defined.
- **Accessibility tests**: `role="grid"` with full keyboard navigation and focus management requires axe-core integration tests. Not mentioned.
- **Performance benchmarks**: The spec raises performance concerns about sparklines and the brush minimap but defines no measurable performance acceptance criteria (e.g., "grid renders < 200ms for 35 rows at annual 10Y range").

The `test-scenarios/SKILL.md` framework requires: test objectives, starting conditions, step-by-step actions, and expected outcomes per story. None of the Phase 1.5 stories have this.

**Recommendation:**
Before any implementation sprint begins, produce test scenarios for at minimum:
1. `gaapNormalizer` uncapping: given raw Apple Company Facts JSON (40 years), `normalizeCompanyFacts()` returns annual array of length ≥ 30 and quarterly array of length ≥ 80
2. Statement grid collapsing: given a normalized dataset, clicking a group header toggles `aria-expanded` and shows/hides child rows
3. URL state sync: navigating to `?range=5Y&granularity=quarterly` initializes control bar to 5Y quarterly; changing the range updates the URL
4. Data gap rendering: a metric with a null value renders `—` em-dash, correct `aria-label`, and no sparkline data point for that period
5. Keyboard navigation: `Tab` enters the grid, `ArrowRight`/`ArrowLeft` moves between periods, `Enter` on a row opens the drill-down panel, `Esc` closes it and returns focus to the trigger row

---

## Agent Assignment Audit

| Task/Story | Current Agent | Correct Agent | Issue |
|---|---|---|---|
| #228 FinancialBarChart extraction | Unassigned (implicit general) | `react-specialist` | React component refactor with Recharts |
| #229 useKeyMetrics config/registry | Unassigned | `react-specialist` + `typescript-pro` | Hooks + formatter generic types |
| #230 Derive metrics unification | Unassigned | `react-specialist` | Hook dependency graph changes |
| #231 normalizeTicker dedup | Unassigned | `react-specialist` | Multi-file call-site audit |
| #232 Cache split + /statements route | Unassigned | `react-specialist` + `devops-engineer` | Firebase config + React Router |
| #233 gaapNormalizer SRP split | Unassigned | `typescript-pro` | Large JS module decomposition |
| Statement grid component | Unassigned | `react-specialist` | aria role="grid" + keyboard nav |
| SVG sparklines | Unassigned | `react-specialist` | Inline SVG + theme integration |
| Brush minimap | Unassigned | `react-specialist` | rAF drag + d3-brush integration |
| All test work | Unassigned | `test-automator` + `qa-expert` | Entirely absent |

---

## Test Coverage Map

| Story | Unit | Integration | E2E | Missing |
|---|---|---|---|---|
| #228 FinancialBarChart extraction | Not defined | Not defined | Not defined | RTL tests for shared chart props, empty states |
| #229 useKeyMetrics registry | Not defined | Not defined | Not defined | Formatter output tests, config-driven rendering |
| #230 Derive metrics unification | Not defined | Not defined | Not defined | Margin calculation parity tests before/after move |
| #231 normalizeTicker dedup | Not defined | Not defined | Not defined | All 4 call sites return identical output |
| #232 Cache split / route | Not defined | Not defined | Not defined | Cache read/write/invalidation cycle, route loads |
| #233 gaapNormalizer split | Not defined | Not defined | Not defined | Module re-export parity, 40-year payload test |
| Statement grid (annual/quarterly) | Not defined | Not defined | Not defined | Collapse/expand, column ordering, data gaps |
| Control bar + URL sync | Not defined | Not defined | Not defined | URL round-trip, localStorage persistence |
| Sparklines | Not defined | Not defined | Not defined | Theme color, null data omission |
| Brush minimap | Not defined | Not defined | Not defined | Drag range selection, sync with grid |
| Chart drill-down panel | Not defined | Not defined | Not defined | Focus trap, comparison overlay, mobile sheet |
| Accessibility (grid nav) | Not defined | Not defined | Not defined | axe-core scan, keyboard nav flow |
| Quarterly data uncap | Not defined | Not defined | Not defined | CRITICAL — quarterly path confirmed untested (#225) |

---

## Questions Answered

**Q1: Is raw SVG sparkline right at 30-50 instances?**
Yes — 30–50 SVG sparklines at ~40 nodes each totals ~1500–2000 SVG nodes. This is well within browser budget. The real performance risk is full grid expansion (all groups, 35+ rows, 40+ periods), not the sparklines themselves. The design's progressive disclosure default (groups collapsed) keeps typical visible-DOM load low. Recommendation: build sparklines as raw SVG (decision confirmed), but add a `React.memo` wrapper keyed on `[data, theme]` to prevent re-render on control-bar range changes that don't affect a collapsed group's sparkline data.

**Q2: Brush minimap — custom or d3-brush?**
Use d3-brush (~12KB gzip). The "boring strategy wins" principle (Will Larson) applies here. d3-brush handles cross-browser pointer events, touch drag, and keyboard accessibility correctly. A custom canvas implementation will take 2–3x longer and introduce drag-edge/mobile bugs. The 12KB bundle cost is justified against implementation risk on a non-core UI widget.

**Q3: State management for control bar (URL + localStorage + React)?**
Single source of truth is the URL. Pattern: on mount, parse `?range` + `?granularity` from URL → initialize React state; on user interaction, update React state → sync to URL via `replaceState` (no history push); on page load per-ticker, check localStorage for last-used params if URL has no params (discovery flow). This avoids 3-way sync bugs. A custom `useStatementParams()` hook should own this logic — one hook, one place.

**Q4: Data layer extension for full history?**
Do NOT uncap `ANNUAL_YEARS`/`QUARTERLY_PERIODS` client-side without first fixing #222 (L1 invalidation no-op) and benchmarking the raw payload size. The recommended approach: add a `fullHistory: boolean` flag to `normalizeCompanyFacts(facts, options)` that bypasses the caps when `true`. The `/statements` route passes `{ fullHistory: true }`. The `/company/:ticker` overview route keeps `fullHistory: false` (existing behavior unchanged). This is a non-breaking, opt-in extension.

**Q5: Is caching strategy (#232) correctly sequenced before grid build?**
Yes, the sequencing is correct: #232 (cache split) must ship before the statement grid, because the grid will attempt to read from a `/statements`-specific cache path that does not exist yet. However, #222 (invalidation fix) must ship as part of or before #232 — do not ship the cache split with a broken invalidation path.

**Q6: Virtualization for the statement grid?**
Not required for the default (collapsed) state. Required only for "expand all" scenario. Recommendation: implement without virtualization first, measure render time with a 35-row all-expanded grid in Chrome DevTools, then add `@tanstack/react-virtual` only if measured p95 render time exceeds 200ms. This follows the Pragmatic Programmer "no premature abstraction" rule. The progressive disclosure default makes virtualization unlikely to be needed in practice.

---

## Overall Assessment

- **Technical Score:** ADEQUATE (solid design, real architectural gaps in data layer and security)
- **Architecture Risks:**
  - Full-history payload size unknown and un-benchmarked — could cause 3–5 second load spikes on slow connections
  - L1 cache invalidation (#222) is broken; uncapping without fixing it = permanent stale data for restated financials
  - No Firestore security rules; new cache paths add attack surface before the baseline is secured
  - gaapNormalizer SRP split (#233) must precede uncapping to avoid a 1700+ line file mid-feature
- **Agent Fixes Needed:**
  - Assign `react-specialist` to all Phase 1.5 implementation stories (currently unassigned)
  - Assign `typescript-pro` to #233 gaapNormalizer split
  - Assign `test-automator` + `qa-expert` to every story (test strategy is entirely absent)
  - Assign `devops-engineer` to Cloud Functions changes in #232
  - Assign `security-auditor` to firestore.rules fix (#221) and FMP API key fix (#226) before any Phase 1.5 story goes to production
