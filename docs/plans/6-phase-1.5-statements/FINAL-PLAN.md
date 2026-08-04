# Feature Breakdown: Phase 1.5 — Full Historical Financial Statements (iCharts-style)

**Project:** Edgar Value Miner — Milestone #6
**Mode:** feature-breakdown
**Synthesized:** 2026-07-26
**Design spec:** `docs/superpowers/specs/2026-07-26-phase-1.5-statements-design.md`

---

## Executive Summary

Phase 1.5 delivers a complete, visually-driven financial statements view for every SEC-reported line item across all years and quarters — the "iCharts / TIKR / Stockrow" experience for a single-user personal research tool. The UX and visual design are approved; what remains is PM-level scoping, epic decomposition, and execution sequencing. The core concept is sound: progressive disclosure prevents the "Excel wall," inline sparklines provide trend-at-a-glance, and the four-tab IA (Income / Balance Sheet / Cash Flow / Ratios) covers the full Roni checklist.

Three structural gaps must be closed before any story is written: (1) security issues #221 and #226 must gate Phase 1.5 — they are not parallel cleanup but hard prerequisites given new Firestore paths and expanded API surface; (2) zero stories currently have acceptance criteria or test strategies, making the entire backlog NOT READY by definition; (3) five "open product questions" and two undocumented scope boundaries (Ratios tab depth, comparison overlay semantics) must receive explicit IN/OUT verdicts or they will inflate scope during implementation.

The milestone is viable at ~13–14 calendar weeks (~104h nominal, ~149h at +40% realistic) for a solo developer at 15–20h/week. A phased release is strongly recommended: ship 1.5a (statement grid, no drill-down) first, then 1.5b (chart drill-down + Ratios tab). The verdict: **CONCERNS** — real architectural and readiness gaps, all fixable with 1–2 grooming sessions before sprint 1 begins.

---

## Strategic Context

- **North Star Metric (DEFINED):** "The developer can open any S&P 500 company on `/statements`, read a 10-year revenue trend including all major line items, in under 2 minutes — annual and quarterly — with zero data errors on companies that have restated financials."
- **Milestone:** #6 — Full Historical Data
- **Critical Findings Addressed:** 12 total (3 CRITICAL, 5 HIGH, 3 MEDIUM, 1 LOW)
- **Phase 1.5a / 1.5b split:** Grid (1.5a) ships before drill-down (1.5b). See Phased Release section.

---

## Product-Scope Decisions (Final — No Longer Open)

All five deferred questions are resolved here. These decisions are binding for milestone #6.

| Feature | Decision | Rationale |
|---------|----------|-----------|
| TTM column | **OUT — V2+** | Requires rolling-4Q derivation; quarterly data path untested and unproven stable (#225). Zero incremental visual value for MVP grid. |
| Per-share mode | **OUT — V2+** | Requires shares-outstanding data not in the current 37-metric extraction layer. High blast-radius toggle. |
| CSV/clipboard export | **OUT — V2+** | Contradicts the "less Excely" hard constraint. Users can use Raw format toggle + manual copy. |
| Cross-company comparison (grid) | **OUT — V2+** | The chart drill-down's up-to-3 comparison overlays (same-company, multi-metric) cover the MVP comparison need. A full cross-company grid is a fundamentally different data model. |
| "Pin to dashboard" | **OUT — V2+** | No dashboard persistence infrastructure exists. Overview page 7-metric cards cover the pinning need for now. |
| **Ratios & Margins tab scope** | **Phase 1.5 = derived margins ONLY** from existing 37 GAAP metrics: gross margin, operating margin, net margin, EBITDA margin. All market-price-dependent ratios (P/E, EV/EBITDA, ROIC, P/FCF) are V2+ — they require external price/shares data not in the current layer. |
| **"Comparison overlays" semantics** | **Same-company, multi-metric ONLY.** "Up to 3 overlays" in the chart drill-down means 3 different line items for the same company on one chart (e.g., Revenue + Gross Profit + Net Income). Cross-company comparison is V2+. |
| **#143 AI Debate epic** | **Moves to milestone #7 (v2.0).** Confirmed out of scope for 1.5. Dependency order: clean data → validated display → AI reasoning. |

---

## Consolidated Findings

### CRITICAL

**[C1] Security gate — #221 (Firestore rules) and #226 (FMP API key exposure) must ship before any new Phase 1.5 route goes to production.**
*Domains: Technical Strategy, Decomposition Quality, Execution Readiness*

Phase 1.5 adds a new `/statements` route with new Firestore collection paths (raw-vs-normalized cache split from #232). Without `firestore.rules`, any authenticated user can write to any Firestore path, including poisoning other users' cached financial data. The FMP API key in the Vite client bundle is an OWASP A02:2021 violation (Cryptographic Failures). Both issues already exist; Phase 1.5 expands their blast radius. Neither is a "run in parallel and catch up" situation — they are pre-conditions for production deployment. Agent assignments: `security-auditor` owns #221 + #226 review and sign-off.

Conflict note: Scope reviewer flagged these as "parallel, not blocking" while Technical reviewer called them CRITICAL gates. The STRICTER assessment wins: they must be merged before any Phase 1.5 story goes to production. They CAN be developed in parallel with refactor pre-work (sprint 0) but must be merged before any sprint 1 story ships.

**[C2] #222 (markStaleInIndexedDB no-op) must be fixed before uncapping full history.**
*Domains: Technical Strategy, Decomposition Quality*

`markStaleInIndexedDB` is a silent no-op — L1 cache invalidation is completely broken. Uncapping `ANNUAL_YEARS` / `QUARTERLY_PERIODS` to full history means stale full-history data will be served indefinitely from IndexedDB with no way to expire it. Users will see incorrect historical data for companies that have restated financials. This is the north star's direct threat — the success metric explicitly requires "zero data errors on companies that have restated financials." Fix #222 as part of or strictly before #232 (cache split).

**[C3] Zero stories have acceptance criteria, agent assignments, or test strategies — the entire backlog is NOT READY.**
*Domains: Decomposition Quality, Execution Readiness, Technical Strategy*

None of the 34 stories (existing issues + net-new statement grid stories) meet the Definition of Ready: no acceptance criteria, no story points, no assigned agents, no test scenarios. The test strategy is entirely absent — the only test mention in the design spec is the Playwright visual-regression exit criterion, which answers "did we build it correctly" not "does it work correctly." The quarterly data path (#225) is confirmed untested. The gaapNormalizer (approaching 1500 lines) has no confirmed unit coverage for full-history extraction. This is fixable: grooming sessions 1 and 2 can make Epic 1 fully Ready in 3–4 hours.

---

### HIGH

**[H1] Data layer extension has no architecture document.**
*Domain: Technical Strategy*

"Uncap `ANNUAL_YEARS`/`QUARTERLY_PERIODS`" is a bullet in the spec's dependencies section, not an architectural decision. The full Apple/MSFT Company Facts JSON can exceed 4–8 MB. There is no documented decision on: client-side vs. Cloud Function normalization, IndexedDB schema for raw-vs-normalized split, memory ceiling for 40+ years × 35 metrics, or the interaction between the SRP split (#233) and the uncap. The recommended approach: add a `fullHistory: boolean` flag to `normalizeCompanyFacts(facts, options)` — the `/statements` route passes `{ fullHistory: true }`, the overview route keeps `{ fullHistory: false }`. Document this in a 1-page Data Layer Spec before sprint 1 begins. This is Spike #3 work (normalization perf — 2h).

**[H2] #228 is epic-sized and must be split; #232 and #233 need decomposition.**
*Domain: Decomposition Quality*

Issue #228 (generic FinancialBarChart) covers at minimum: (a) extract shared FinancialBarChart component, (b) extract shared comparison overlay logic, (c) integrate with useChartTheme — three separate PRs. Issue #232 covers two independent concerns: (a) raw-vs-normalized IndexedDB schema change, (b) `/statements` route split from `/company/:ticker` — these should be separate stories because story (a) can ship and be tested before story (b). Issue #233 (gaapNormalizer SRP split) must be completed BEFORE uncapping full history — splitting a 1500-line file mid-feature is a merge-conflict trap.

**[H3] 10 core statement-grid stories do not yet exist and must be authored.**
*Domain: Decomposition Quality*

The statement grid, control bar, sparklines, URL state sync, chart drill-down, Ratios tab, mobile layout, accessibility, data gaps, and Playwright baselines are each story-sized but no GitHub issues exist for them. These must be created as part of Epic 3 and Epic 4 grooming. Story templates are provided in the Stories section below.

**[H4] 4 open product decisions still block acceptance criteria for some stories.**
*Domain: Decomposition Quality*

Even after the 5 open-question verdicts above, 4 stories need discovery before full AC can be written: (1) Ratios tab — which of the 37 GAAP metrics compose each margin; (2) comparison overlay interaction — exactly how the overlay selector UI works on mobile; (3) brush minimap drag behavior on touch devices; (4) focus-return semantics when drill-down panel closes. These are spike-able within the first sprint week (not blockers for starting Epic 1).

**[H5] #143 AI Debate is on the wrong milestone.**
*Domains: Strategic Alignment, Scope & Tradeoffs*

Confirmed move to milestone #7 (v2.0). Both Strategic Alignment and Scope reviewers agree without conflict. Action: update #143 milestone field in GitHub before sprint 1 begins.

---

### MEDIUM

**[M1] No measurable north star was written — now defined above; must be added to milestone #6 description.**
*Domain: Strategic Alignment*

The north star in the Executive Summary section of this document must be copied to the GitHub milestone #6 description field. This is a 5-minute action that eliminates the risk of shipping "complete by feature count" but failing by user value.

**[M2] gaapNormalizer SRP split (#233) must precede uncapping; #233 currently scoped as cleanup not blocker.**
*Domain: Technical Strategy*

#233 is labeled "CLEANUP" but is functionally a prerequisite for the full-history uncap. Splitting a 1500-line normalizer while simultaneously extending it is a merge-conflict trap that will cost more time than the split itself. Sequence: #233 → #232 (cache split) → data layer uncap. Reassign #233 to Epic 1 (pre-work) with BLOCKER label.

**[M3] Hotfixes (#191, #192, #194, #227) and CI issues (#217, #219) run in sprint 0, not on critical path.**
*Domains: Scope & Tradeoffs, Strategic Alignment*

These are legitimate maintenance items that belong in sprint 0 (before the refactor chain begins). They are small, parallel-eligible, and should not be sequenced as grid-blockers. Grouping them in sprint 0 lets the developer clear the maintenance debt in one focused session before the architectural refactors begin.

---

### LOW

**[L1] Sparkline build-vs-buy decision is correctly documented — raw SVG confirmed.**
*Domain: Scope & Tradeoffs*

No action needed. The spec's rejection of @nivo (+45KB) and Recharts for 30–50 instances/page is correct and well-reasoned. Raw SVG at ~40 lines per sparkline is the right call.

---

## Cross-Domain Patterns

**Pattern 1 — Systematic Planning Gap (affects all 3 critical findings).**
No north star → no acceptance criteria → no test strategy → no Definition of Ready. These are not independent failures; they trace to one root cause: the design spec was written as a UX artifact, not an engineering specification. The fix is one grooming session (3–4h) focused on Epic 1, which can make the first 5 stories fully Ready and unblock sprint 1.

**Pattern 2 — Security + Cache Debt Compound Risk.**
#221 (no Firestore rules) + #222 (broken cache invalidation) + #226 (exposed API key) are three independent bugs that together create a compounded risk specifically for Phase 1.5: new Firestore paths (#232) on top of no security rules (#221), combined with a broken invalidation mechanism (#222) being uncapped to 40+ years of data. Any one of these alone is manageable; all three together on a newly expanded data surface is a meaningful correctness and security risk. Sprint 0 must close all three.

**Pattern 3 — Agent Assignment Absent Everywhere.**
Every existing issue (#221–#233, #191–#194, #217, #219) has no agent assignment. Every net-new story will need one. The rule is uniform: `react-specialist` is primary for all Phase 1.5 implementation stories; `test-automator` is mandatory parallel for every story; `typescript-pro` owns #233; `security-auditor` owns #221 and #226; `devops-engineer` assists #232 (Cloud Functions scope).

---

## Three Pre-Sprint Spikes (Required Before Sprint 1)

These are time-boxed research tasks that resolve open technical questions and prevent blocked sprints. Run during sprint 0 alongside hotfix/security work.

| Spike | Question | Time-box | Owner Agent | Decision |
|-------|----------|----------|-------------|----------|
| **Spike A — SVG Sparkline Performance** | Do 30–50 simultaneous raw SVG sparklines in the statement grid stay under 200ms render p95 on a mid-range laptop? | 4h | `react-specialist` | Build a 35-row × 10-column prototype with inline SVGs; measure in Chrome DevTools. If p95 > 200ms, add `React.memo` keyed on `[data, theme]`. |
| **Spike B — d3-brush Minimap** | Does d3-brush handle drag + touch + keyboard correctly on the 200×24px minimap, and does it integrate cleanly with `useStatementParams`? | 2h | `react-specialist` | Integrate d3-brush in an isolated harness. Document the URL-sync pattern. Decision: use d3-brush (boring strategy wins; rejects custom canvas). |
| **Spike C — Full-History Normalization Perf** | What is the p95 response time for `normalizeCompanyFacts(appleFactsJSON, { fullHistory: true })`? Does it stay under 500ms client-side? | 2h | `react-specialist` + `typescript-pro` | Benchmark with real AAPL Company Facts JSON (~4–8 MB). If > 500ms, design moves normalization to Cloud Function. Decision feeds #232 architecture. |

---

## Epic List (4 Epics in #143 Format)

---

### EPIC 1: Sprint 0 — Security, Infrastructure & Pre-Work Foundations

**Overview (what + WHY):**
Close all known security debt, fix broken cache invalidation, resolve CI failures, and complete the six code-quality refactors that are hard prerequisites for the statement grid. Without this epic, every subsequent epic ships on a broken foundation: stale data (#222), exposed API keys (#226), cache poisoning surface (#221), and hardcoded chart components (#228) that block the drill-down. This is not optional cleanup — it is structural enabling work.

**Grooming Plan:**

| Story | Type | Effort | Agent | Status |
|-------|------|--------|-------|--------|
| #221 Firestore security rules | SECURITY | 3 SP | `security-auditor` | Backlog → Ready |
| #222 Fix markStaleInIndexedDB no-op | BUG | 2 SP | `react-specialist` + `test-automator` | Backlog → Ready |
| #226 FMP API key → Cloud Function secret | SECURITY | 3 SP | `security-auditor` + `devops-engineer` | Backlog → Ready |
| #227 Remove unguarded console.log | CHORE | 1 SP | `react-specialist` | Backlog → Ready |
| #217 CI workflow permissions | CHORE | 1 SP | `devops-engineer` | Backlog → Ready |
| #219 Prod functions deploy fix | BUG | 2 SP | `devops-engineer` | Backlog → Ready |
| #191 SEO meta/OG | ENHANCEMENT | 1 SP | `react-specialist` | Backlog → Ready |
| #192 Footer WCAG contrast | A11Y | 1 SP | `react-specialist` | Backlog → Ready |
| #194 Search input id/name | A11Y | 1 SP | `react-specialist` | Backlog → Ready |
| #233 gaapNormalizer SRP split (BLOCKER relabeled) | REFACTOR | 5 SP | `typescript-pro` + `test-automator` | Backlog → Ready |
| #231 Dedup normalizeTicker | REFACTOR | 2 SP | `react-specialist` + `test-automator` | Backlog → Ready |

**MVP/Full split:** All stories are MVP — this epic has no Full scope.

**Exit Gate:** All 11 stories merged to `develop`. #221, #222, #226 verified green in staging. #233 parity test: all existing normalizer outputs identical before/after split.

**De-risking Spike:** Spike C (normalization perf, 2h) runs during this epic — informs whether #233 split must include a Cloud Function migration or can remain client-side.

**Effort Summary:** 22 SP nominal (~22h). Add +40% realistic buffer: ~31h. Calendar: ~2–3 weeks at 15–20h/week.

**Key Architecture:** `markStaleInIndexedDB` must be a real IndexedDB TTL write — not just a flag toggle. The fix must be tested with an integration test: write → time-travel → read → assert stale. `gaapNormalizer` SRP split follows clean module boundaries: `gaapNormalizer.js` (orchestration), `gaapExtractors.js` (metric-specific extraction), `gaapFormatters.js` (display formatting), `gaapConstants.js` (caps, labels).

**Pre-Sprint Gates:** None — this IS the first sprint. Spikes A, B, C run during this epic.

**Success Criteria (OKRs):**
- O: Zero open CRITICAL/HIGH security findings before Phase 1.5 routes ship
- KR1: `firestore.rules` deployed and `security-auditor`-reviewed
- KR2: FMP API key absent from Vite bundle (verified via `npm run build && grep -r "FMP_KEY" dist/`)
- KR3: `markStaleInIndexedDB` integration test green
- KR4: gaapNormalizer split parity test green (all existing tests pass unchanged)

**Milestone tagline:** "Close the debt. Open the foundation."

---

### EPIC 2: Data Layer — Full History Uncap + Route Architecture

**Overview (what + WHY):**
Extend the data layer to fetch and cache full SEC history (40+ years annual, 80+ quarters), split the `/statements` route from the overview cache, and validate the quarterly extraction path. This epic delivers the data substrate that the statement grid and chart drill-down depend on. Without it, the grid can only show the capped 5-year/20-quarter slice that currently powers the overview.

**Grooming Plan:**

| Story | Type | Effort | Agent | Status |
|-------|------|--------|-------|--------|
| #223 Test coverage gate includes financial core | TEST | 2 SP | `test-automator` | Backlog → Ready |
| #224 Re-enable integration suite (remove describe.skip) | TEST | 2 SP | `test-automator` | Backlog → Ready |
| #225 Quarterly path tests | TEST | 3 SP | `test-automator` + `react-specialist` | Backlog → Ready |
| #232a Raw-vs-normalized IndexedDB schema | REFACTOR | 3 SP | `react-specialist` + `devops-engineer` | Backlog → Ready |
| #232b `/statements` route split from overview | REFACTOR | 2 SP | `react-specialist` | Backlog → Ready |
| #229 Config-driven useKeyMetrics + formatter registry | REFACTOR | 4 SP | `react-specialist` + `typescript-pro` | Backlog → Ready |
| #230 Unify derived metrics into normalizeCompanyFacts | REFACTOR | 3 SP | `react-specialist` + `test-automator` | Backlog → Ready |
| #228a Extract generic FinancialBarChart component | REFACTOR | 3 SP | `react-specialist` + `test-automator` | Backlog → Ready |
| #228b Extract shared comparison overlay logic | REFACTOR | 2 SP | `react-specialist` | Backlog → Ready |
| #228c useChartTheme integration across chart components | REFACTOR | 1 SP | `react-specialist` | Backlog → Ready |
| NEW: Full-history uncap (`fullHistory: boolean` flag) | FEATURE | 3 SP | `react-specialist` + `test-automator` | Net-new → Ready |

**MVP/Full split:**
- MVP: All test stories + #232a/b + full-history flag + #231 (from Epic 1)
- Full: #229, #230, #228 split (these enable the grid renderer in Epic 3)

**Exit Gate:** `normalizeCompanyFacts(appleFactsJSON, { fullHistory: true })` returns annual array of length ≥ 30 and quarterly array of length ≥ 80. Quarterly integration test green. `/statements` route loads from its own IndexedDB key, separate from overview. All derived margins (gross, operating, net, EBITDA) computable from existing 37 metrics.

**De-risking Spike:** Spike C result (from Epic 1) feeds the `fullHistory` implementation: if normalization exceeds 500ms client-side, the uncap moves to a Cloud Function and #232a schema includes a pre-aggregated payload path.

**Effort Summary:** 28 SP nominal (~28h). At +40%: ~39h. Calendar: ~2–3 weeks.

**Key Architecture:** `useStatementParams` hook owns all URL ↔ React state sync. URL is single source of truth: on mount, parse `?range` + `?granularity` → init state; on change, update state → `replaceState` (no history push); on first load per-ticker with no URL params, check localStorage. One hook, one place, zero 3-way sync bugs.

**Pre-Sprint Gates:** Epic 1 exit gate must be green (specifically #222 and #233).

**Success Criteria (OKRs):**
- O: Full SEC history available client-side for any ticker, correctly cached and invalidatable
- KR1: `normalizeCompanyFacts` passes 40-year AAPL benchmark test (≥ 30 annual, ≥ 80 quarterly rows)
- KR2: Quarterly path integration test green (was describe.skip in #224)
- KR3: `/statements` route cache miss does not cause overview cache eviction

**Milestone tagline:** "40 years of data, one clean route."

---

### EPIC 3: Statement Grid — Core Visual Experience (1.5a)

**Overview (what + WHY):**
Build the humanized statement grid with progressive disclosure, inline sparklines, YoY badges, sticky headers, collapsible groups, control bar + URL sync, number format toggle, and full accessibility. This is the primary deliverable of milestone #6 and the direct answer to the "less Excely, more intuitively visual" hard constraint. Four tabs: Income Statement, Balance Sheet, Cash Flow, Ratios & Margins. This epic is what users will judge the milestone by.

**Grooming Plan:**

| Story | Type | SP | Agent | Status |
|-------|------|----|-------|--------|
| NEW: Statement grid shell + routing (`/statements` page, tab IA, breadcrumb) | FEATURE | 3 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Collapsible group rows + subtotal rows + group color accents | FEATURE | 5 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Inline sparklines (raw SVG, useChartTheme, React.memo) | FEATURE | 4 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: YoY badges (chip + arrow, not color-alone, WCAG AA) | FEATURE | 2 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Sticky period header + sticky label column + zebra rows | FEATURE | 3 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Control bar — Annual/Quarterly toggle + range presets | FEATURE | 3 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Brush minimap (d3-brush, 200×24px, URL-synced) | FEATURE | 4 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Number format toggle (Abbreviated / Raw) | FEATURE | 2 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Data gap handling (em-dash, tint, aria-label, omit sparkline) | FEATURE | 2 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Mobile layout (2-period grid, 2-row control bar, touch targets) | FEATURE | 4 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Keyboard navigation + ARIA grid roles + axe-core tests | A11Y | 4 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Ratios & Margins tab (4 derived margins from existing 37 GAAP metrics) | FEATURE | 3 SP | `react-specialist` + `test-automator` | Net-new |

**MVP/Full split:**
- MVP (1.5a): Grid shell + collapsible groups + sparklines + YoY + sticky headers + control bar + URL sync + number format + data gaps. Ratios tab = FULL.
- Full (1.5b): Brush minimap, mobile layout, full keyboard nav, Ratios tab.

**Exit Gate (1.5a):**
1. Statement grid loads for AAPL with Income Statement tab, Annual, 10Y default in < 3 seconds on a cable connection.
2. Collapsible groups toggle correctly — only headline groups expanded by default.
3. Inline sparklines render for all visible rows with no console errors.
4. YoY badges show ↑/↓ arrow + percentage for all non-null periods.
5. Sticky header + left column remain sticky on horizontal and vertical scroll.
6. Annual ↔ Quarterly toggle switches columns correctly; URL updates.
7. 5Y / 10Y / MAX presets work; URL encodes `?range=5Y&granularity=annual`.
8. All existing Overview tests still green (no regression).

**Exit Gate (1.5b adds):**
9. Brush minimap drag selects a range; grid columns update; URL encodes range.
10. Mobile: 2-period layout renders at 375px viewport; touch targets ≥ 44px.
11. Keyboard: Tab enters grid; ArrowRight/Left moves between periods; Enter on row expands; Esc collapses; axe-core scan zero violations.
12. Ratios tab shows gross margin, operating margin, net margin, EBITDA margin with correct formula output verified against known AAPL values.

**De-risking Spike:** Spike A (SVG sparkline perf, 4h) result feeds the sparkline story — if p95 > 200ms at 35 rows, `React.memo` keying is added to the AC.

**Effort Summary:** 39 SP nominal (~39h). At +40%: ~55h. Calendar: ~3–4 weeks.

**Key Architecture:**
- Token system: 8 new CSS custom properties (`--color-group-revenue`, `--color-group-expense`, `--color-group-equity` + `-border` + `-fill` variants; `--color-subtotal-*`, `--color-row-zebra`, `--color-sparkline-*`, `--color-yoy-positive`, `--color-yoy-negative`, `--color-data-gap-bg`, `--period-pill-active-*`). Light + dark values, all WCAG AA verified.
- Grid renders from config registry (from #229). No hardcoded line items.
- URL is single source of truth via `useStatementParams()` hook (from Epic 2).
- Virtualization: NOT added by default. Add `@tanstack/react-virtual` only if Spike A or measured p95 in production > 200ms on the all-expanded scenario.
- Most-recent period on the LEFT (TIKR/Stockrow convention). `font-variant-numeric: tabular-nums`.

**Pre-Sprint Gates:** Epic 2 exit gate green (full-history data available, `useStatementParams` hook implemented, formatter registry shipped via #229, FinancialBarChart extracted via #228).

**Success Criteria (OKRs):**
- O: A developer can read a 10-year revenue trend for any S&P 500 ticker in under 2 minutes
- KR1: Statement grid loads AAPL Income Statement, Annual, 10Y in < 3s (cable connection)
- KR2: axe-core scan zero violations on grid + control bar
- KR3: All 4 tabs render correct data for 3 verified tickers (AAPL, MSFT, GOOGL) — validated against sec.gov raw data

**Milestone tagline:** "Every number, in context, at a glance."

---

### EPIC 4: Chart Drill-Down + Visual Regression Baselines (1.5b)

**Overview (what + WHY):**
Add the line-item chart drill-down panel (desktop slide-over, mobile bottom-sheet), CAGR/high/low stats block, comparison overlays (same-company, multi-metric), accessible data table, and inflection annotations. Capture Playwright `toHaveScreenshot()` baselines only after human approval of the live build. This epic makes Phase 1.5 "analytically complete" — users can go from a trend in the grid to a full series with context in one click.

**Grooming Plan:**

| Story | Type | SP | Agent | Status |
|-------|------|----|-------|--------|
| NEW: Drill-down slide-over panel (desktop, 440px, backdrop blur) | FEATURE | 4 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Bottom-sheet (mobile, 72vh, drag handle, focus trap) | FEATURE | 3 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Stats block (latest, CAGR, high/low) | FEATURE | 2 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Full time-series chart (Recharts via #228 FinancialBarChart) | FEATURE | 3 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Comparison overlays (up to 3, same-company, colorblind-safe palette) | FEATURE | 4 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Accessible data table (below chart, screen-reader navigable) | A11Y | 2 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Focus management (focus trap in panel, return to trigger row on Esc) | A11Y | 2 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Deep-link route `/statements/:lineItem` (shareable chart URL) | FEATURE | 2 SP | `react-specialist` + `test-automator` | Net-new |
| NEW: Playwright visual-regression baselines (after human approval) | TEST | 3 SP | `test-automator` | Net-new |

**MVP/Full split:**
- MVP: Slide-over panel + full chart + stats block + focus management + accessible data table.
- Full: Bottom-sheet (mobile), comparison overlays, deep-link route, Playwright baselines.

**Exit Gate:**
1. Clicking a row's chart icon opens the slide-over with the correct line item.
2. Esc closes the panel and returns focus to the trigger row.
3. Stats block shows correct CAGR, high, low for AAPL Revenue (Annual, 10Y).
4. Comparison overlay: adding a second metric renders both series with colorblind-safe colors (blue + orange first pair).
5. Mobile: bottom-sheet opens at 72vh; drag-to-close works; accessible data table scrolls within sheet.
6. axe-core: zero violations inside the panel.
7. Playwright baselines captured and committed (human-approved).

**De-risking Spike:** Spike B (d3-brush, 2h) result is already used in Epic 3 (minimap). No additional spike needed here.

**Effort Summary:** 25 SP nominal (~25h). At +40%: ~35h. Calendar: ~2 weeks.

**Key Architecture:** Drill-down chart re-uses the generic `FinancialBarChart` from #228. Comparison overlay color palette: `[#3B82F6 (blue), #F97316 (orange), #8B5CF6 (purple)]` — colorblind-safe set; line-style variation as secondary differentiator. `role="dialog"`, `aria-labelledby` → line-item name, `aria-describedby` → stats block.

**Pre-Sprint Gates:** Epic 3 MVP (1.5a grid) must be merged and staging-verified. #228 split (FinancialBarChart) must be complete.

**Success Criteria (OKRs):**
- O: Deep analysis of any line item is one click away from the grid, with full historical context
- KR1: Drill-down panel opens < 200ms after click (measured in DevTools)
- KR2: Playwright visual baseline tests green on CI for all 4 tabs + drill-down
- KR3: Mobile bottom-sheet renders correctly on 375px × 667px viewport (iPhone SE size)

**Milestone tagline:** "One click from trend to story."

---

## Stories — Epic 1 Groomed to Ready

The following are the 5 highest-priority stories from Epic 1, fully spec'd with acceptance criteria. These can be dispatched immediately after this plan is approved.

---

### Story E1-1: Fix markStaleInIndexedDB no-op [#222] — 2 SP

**As a** developer using the tool, **I want** the IndexedDB cache to correctly mark entries as stale when financial data is updated, **so that** I never see outdated financial data for a company that has restated its financials.

**Acceptance Criteria:**
- [ ] `markStaleInIndexedDB(ticker)` writes a real TTL/stale marker to the IndexedDB entry for `ticker` (not a no-op flag)
- [ ] Subsequent read after `markStaleInIndexedDB` call triggers a fresh fetch, not a cached read
- [ ] Integration test: write to cache → call markStale → read → assert fetch was called (use `vi.spyOn` on the fetch function)
- [ ] Existing cache read/write tests still pass
- [ ] `console.log` in the function is removed (or replaced with debug-level only)

**Sub-tasks:**
1. Read current `markStaleInIndexedDB` implementation — identify why it is a no-op — `react-specialist` — 30m
2. Write failing integration test: write → markStale → read → assert re-fetch — `test-automator` — 1h
3. Fix implementation to pass the test — `react-specialist` — 1h
4. Run full test suite and verify no regressions — `test-automator` — 30m

**Dependencies:** None (first story in Epic 1).
**Test Strategy:** Integration test with `vi.spyOn` on fetch + fake IndexedDB (idb-mock or real idb in jsdom).
**Definition of Done:** Integration test green, PR reviewed, merged to develop, no console.log in production bundle.

---

### Story E1-2: Deploy Firestore Security Rules [#221] — 3 SP

**As a** developer, **I want** `firestore.rules` deployed with appropriate read/write restrictions, **so that** no authenticated user can poison another user's cached financial data.

**Acceptance Criteria:**
- [ ] `firestore.rules` file exists in repo root and is deployed as part of `firebase deploy`
- [ ] Rules restrict write access to: only the authenticated user's own UID-scoped paths
- [ ] Rules permit read access to the user's own cached financial data
- [ ] `security-auditor` has reviewed and approved the rules before merge
- [ ] Firebase emulator rules test: unauthenticated write → rejected; authenticated write to own path → allowed; authenticated write to other user's path → rejected
- [ ] CI pipeline includes `firebase emulator:exec --only firestore` rules test

**Sub-tasks:**
1. Audit current Firestore collection path structure — `security-auditor` — 1h
2. Write `firestore.rules` with UID-scoped paths — `security-auditor` — 1h
3. Write Firebase emulator rules tests — `test-automator` — 1h
4. Add rules deploy step to CI — `devops-engineer` — 30m

**Dependencies:** None.
**Test Strategy:** Firebase emulator rules tests (`@firebase/rules-unit-testing`).
**Definition of Done:** `firestore.rules` deployed to production, emulator tests green, security-auditor sign-off on PR.

---

### Story E1-3: Move FMP API Key to Cloud Function Secret [#226] — 3 SP

**As a** developer, **I want** the Financial Modeling Prep API key stored server-side in Firebase Secret Manager, **so that** it is never exposed in the Vite client bundle.

**Acceptance Criteria:**
- [ ] FMP_API_KEY is removed from all `.env` files that are consumed by the Vite build (client bundle)
- [ ] A Cloud Function (`getFinancialData`) proxies FMP API calls, injecting the key server-side via `process.env.FMP_API_KEY` (Firebase Secret Manager)
- [ ] `npm run build && grep -r "FMP" dist/` returns zero matches
- [ ] All existing FMP data fetching still works end-to-end through the new proxy
- [ ] The proxy Cloud Function includes rate limiting (max 10 req/min per user) to prevent API key abuse

**Sub-tasks:**
1. Create Cloud Function proxy for FMP API calls — `devops-engineer` — 2h
2. Store FMP key in Firebase Secret Manager — `devops-engineer` — 30m
3. Update client-side data layer to call Cloud Function instead of FMP directly — `react-specialist` — 1h
4. Verify bundle does not contain key — `test-automator` — 30m
5. Test proxy end-to-end: real FMP response for AAPL revenue — `test-automator` — 30m

**Dependencies:** None.
**Test Strategy:** Bundle scan + Cloud Function integration test (Firebase emulator).
**Definition of Done:** `dist/` bundle contains no FMP references, Cloud Function deployed, `security-auditor` sign-off.

---

### Story E1-4: gaapNormalizer SRP Split [#233] — 5 SP

**As a** developer, **I want** `gaapNormalizer.js` split into focused modules, **so that** the full-history uncap in Epic 2 can extend a 200–300 line orchestrator rather than a 1500-line monolith.

**Acceptance Criteria:**
- [ ] `gaapNormalizer.js` (orchestration only) is ≤ 400 lines after split
- [ ] `gaapExtractors.js` contains all metric-specific XBRL tag extraction logic
- [ ] `gaapFormatters.js` contains all display formatting functions (abbreviation, sign flipping, labels)
- [ ] `gaapConstants.js` contains `ANNUAL_YEARS`, `QUARTERLY_PERIODS`, metric labels, and color mappings
- [ ] Parity test: for every existing test input, the output of the new modular normalizer is byte-identical to the old monolith output
- [ ] All 4 existing normalizer tests pass unchanged
- [ ] No circular imports between modules

**Sub-tasks:**
1. Map all exports and call sites in the current monolith — `typescript-pro` — 1h
2. Create module files with re-export strategy — `typescript-pro` — 2h
3. Write parity tests (snapshot of output before split, compare after) — `test-automator` — 1h
4. Execute split and verify parity — `typescript-pro` — 2h

**Dependencies:** #222 (must be done first — avoids touching the same file).
**Test Strategy:** Snapshot parity tests. All existing normalizer unit tests must pass without modification.
**Definition of Done:** 4 module files, parity tests green, no circular imports (verified via `madge`), `typescript-pro` + `test-automator` sign-off.

---

### Story E1-5: Remove Unguarded console.log + Re-enable Coverage Gate [#227, #223 partial] — 2 SP

**As a** developer, **I want** all production console.log calls gated by a debug flag and the coverage gate to include financial core modules, **so that** production logs are clean and coverage gaps are visible before Phase 1.5 begins.

**Acceptance Criteria:**
- [ ] All `console.log` calls in `src/` are either removed or wrapped in `if (DEBUG_MODE)` (env flag)
- [ ] ESLint rule `no-console` added to `.eslintrc` to prevent future regressions
- [ ] `vitest.config.js` coverage thresholds include `gaapNormalizer*` modules at minimum 60% line coverage
- [ ] `npm run test:coverage` exits non-zero if gaapNormalizer coverage is below threshold
- [ ] CI `ci.yml` runs coverage check and fails if below threshold

**Sub-tasks:**
1. Audit `console.log` usage in `src/` — `react-specialist` — 30m
2. Replace/remove console.log calls — `react-specialist` — 30m
3. Add `no-console` ESLint rule — `react-specialist` — 15m
4. Update coverage config to include normalizer modules — `test-automator` — 30m

**Dependencies:** None.
**Test Strategy:** ESLint CI check + vitest coverage CI check.
**Definition of Done:** ESLint clean, coverage CI green, no console.log in production bundle.

---

## Dependency Graph

```
Sprint 0 (Epic 1)
├── #222 (cache fix) ──────────────────────────────────┐
├── #221 (firestore rules) ─────────────────────────── │ ──► Epic 2 can begin
├── #226 (FMP key) ─────────────────────────────────── │
├── #217, #219 (CI/deploy) ─────────────────────────── │
├── #227, #191, #192, #194 (cleanup) ───────────────── │
├── #233 (gaapNormalizer split) ──────────────────┐    │
└── #231 (normalizeTicker dedup) ────────────────── │   │
                                                   │   │
Epic 2 (Data Layer)                                │   │
├── #223, #224 (test infra) ──────────────────┐   │   │
├── #225 (quarterly path tests) ──────────────┤   │   │
├── #232a (IndexedDB schema) ←────────────────────┘   │
├── #232b (route split) ──────────────────────────────┘
├── #229 (useKeyMetrics registry) ────────────┐
├── #230 (derived metrics unification) ───────┤
├── #228a/b/c (FinancialBarChart) ────────────┤
└── NEW: fullHistory flag ────────────────────┘
                     │
                     ▼
Epic 3 (Statement Grid — 1.5a)
├── Grid shell + routing
├── Collapsible groups
├── Sparklines ← Spike A result
├── YoY badges
├── Sticky headers
├── Control bar + URL sync ← useStatementParams from Epic 2
├── Brush minimap ← Spike B result
├── Number format toggle
├── Data gaps
├── Mobile layout
├── Keyboard nav + ARIA
└── Ratios tab ← #230 + derived margins only
                     │
                     ▼
Epic 4 (Drill-Down — 1.5b)
├── Slide-over panel
├── Bottom-sheet (mobile)
├── Stats block
├── Full chart ← FinancialBarChart from #228
├── Comparison overlays
├── Accessible data table
├── Focus management
├── Deep-link route
└── Playwright baselines ← human approval gate
```

---

## Parallel Groups

| Group | Stories | Can run in parallel with |
|-------|---------|-------------------------|
| Security sprint 0 | #221, #226 | #222, #217, #219, #227, #191, #192, #194 |
| Maintenance sprint 0 | #217, #219, #227, #191, #192, #194 | Security group |
| Core refactors | #233, #231 | Can run after #222; parallel with each other |
| Test infra | #223, #224, #225 | Parallel with #232a, #232b |
| Pre-work refactors | #229, #230, #228a/b/c | Sequential on #233; parallel with each other after #233 |
| Grid features | Grid shell, groups, sparklines, YoY, sticky | Sequential on Epic 2; can run in pairs |
| Mobile + A11y | Mobile layout, keyboard nav | Parallel with Ratios tab |
| Drill-down | All Epic 4 stories | Sequential on Epic 3 MVP (1.5a) |

---

## Agent Assignments

| Story/Epic | Primary Agent | Mandatory Parallel | Rationale |
|------------|--------------|-------------------|-----------|
| #221, #226 | `security-auditor` | `devops-engineer` | Security rules + Cloud Function |
| #222 | `react-specialist` | `test-automator` | IndexedDB integration |
| #217, #219 | `devops-engineer` | — | CI/deploy config |
| #233 | `typescript-pro` | `test-automator` | Large JS module decomposition |
| #231 | `react-specialist` | `test-automator` | Multi-file call-site audit |
| #229 | `react-specialist` + `typescript-pro` | `test-automator` | Hooks + formatter generic types |
| #230 | `react-specialist` | `test-automator` | Hook dependency graph |
| #228a/b/c | `react-specialist` | `test-automator` | Recharts + useChartTheme |
| #232a/b | `react-specialist` + `devops-engineer` | `test-automator` | Firebase config + React Router |
| #223, #224, #225 | `test-automator` | `react-specialist` | Test infra restoration |
| ALL Epic 3 grid stories | `react-specialist` | `test-automator` | React component + ARIA |
| Epic 4 drill-down stories | `react-specialist` | `test-automator` | Slide-over, chart, focus trap |
| Playwright baselines | `test-automator` | — | Visual regression only |

---

## Risk Register

| Risk | Impact | Probability | Mitigation | Domain |
|------|--------|-------------|------------|--------|
| Full-history payload > 8MB causes 3–5s load spike | HIGH | MEDIUM | Spike C benchmark; Cloud Function pre-aggregation if > 500ms client-side norm | Technical |
| Quarterly path produces incorrect data (untested, #225) | HIGH | HIGH | #225 test story is first in Epic 2; quarterly data validated before grid builds on it | Technical |
| gaapNormalizer bugs surface during full-history extraction | HIGH | MEDIUM | Parity tests in #233 split; integration test with real AAPL payload in Epic 2 | Technical |
| d3-brush minimap mobile drag regression | MEDIUM | LOW | Spike B validates touch behavior; d3-brush has existing touch event handling | Technical |
| SVG sparkline perf regression on all-groups-expanded | MEDIUM | LOW | Spike A; React.memo keying; virtualization option if measured > 200ms | Technical |
| Scope creep via "one more ratio" in Ratios tab | MEDIUM | HIGH | Hard scope boundary: derived margins from existing 37 metrics ONLY; document exclusion list | Strategic |
| Security issues not merged before Phase 1.5 routes ship | CRITICAL | MEDIUM | Hard sprint 0 gate; CI must block deploy if #221/#226 are open | Security |
| Sprint velocity overshoot (15–20h/week, solo) | HIGH | MEDIUM | 1.5a/1.5b phased release; can ship grid without drill-down | Timeline |
| #143 re-enters milestone scope | MEDIUM | LOW | Explicitly moved to milestone #7 in this plan; update GitHub milestone field | Strategic |

---

## Phased Release Plan

### Release 1.5a — Statement Grid (Target: Week 8–9)
Ships when Epic 1 + Epic 2 + Epic 3 MVP stories are complete.
- 4 tabs with collapsible groups, sparklines, YoY, sticky headers, control bar, URL sync.
- Annual and Quarterly data for full history.
- Number format toggle, data gap handling.
- Not included: brush minimap, mobile bottom-sheet, drill-down panel.

### Release 1.5b — Full Feature Complete (Target: Week 13–14)
Adds all remaining Epic 3 (minimap, mobile, full accessibility) + all Epic 4 stories.
- Chart drill-down with comparison overlays.
- Playwright visual-regression baselines committed.
- Deep-link route for shareable line-item charts.
- Full WCAG 2.1 AA accessibility coverage.

---

## Success Metrics (Per Phase)

| Phase | Metric | Target |
|-------|--------|--------|
| Sprint 0 complete | Security findings open | 0 CRITICAL, 0 HIGH |
| Epic 1 complete | gaapNormalizer test coverage | ≥ 60% line coverage |
| Epic 2 complete | Full-history data available | AAPL: ≥ 30 annual, ≥ 80 quarterly rows in normalizer output |
| 1.5a ship | Statement grid load time | < 3s p95 on cable, AAPL Income Statement Annual 10Y |
| 1.5a ship | Data correctness | 3 tickers (AAPL, MSFT, GOOGL) values match sec.gov raw data |
| 1.5b ship | Accessibility | axe-core zero violations on grid + control bar + drill-down |
| 1.5b ship | Visual regression | Playwright baselines green on CI |
| Milestone complete | North star | Developer reads 10-year revenue trend in < 2 minutes for any S&P 500 ticker |

---

## What Stays Backlog vs. Goes Ready

### Ready (can be dispatched after this plan is approved)
- #222 (cache fix) — fully spec'd above
- #221 (Firestore rules) — fully spec'd above
- #226 (FMP key) — fully spec'd above
- #227, #217, #219, #191, #192, #194 — small, self-contained, accept criteria writable from spec

### Ready After 1 Grooming Session (Epic 1 stories)
- #233 (gaapNormalizer split) — fully spec'd above
- #231 (normalizeTicker dedup) — 4 call sites + parity test

### Ready After Epic 2 Grooming Session (2–3 stories at a time)
- #223, #224, #225 (test infra) — requires reading current test config
- #232a/b (cache + route split) — requires Data Layer Spec (1-page doc, Sprint 0)
- #229, #230, #228a/b/c (pre-work refactors) — require Data Layer Spec to be final

### Backlog (needs spike or discovery before AC can be written)
- All Epic 3 grid stories — writable from spec after Spike A result
- All Epic 4 drill-down stories — writable from spec after Epic 3 MVP is staging-tested
- Ratios tab full AC — needs exact formula mapping from 37 GAAP metrics
- Brush minimap full AC — needs Spike B result

### Explicitly NOT in Phase 1.5 (Backlog, V2+ only)
- TTM column
- Per-share mode
- CSV/clipboard export
- Cross-company comparison grid
- "Pin to dashboard"
- P/E, EV/EBITDA, ROIC and all market-price-dependent ratios
- Cross-company overlays in drill-down
- AI Debate epic (#143) — moves to milestone #7

---

## Verdict: CONCERNS

Phase 1.5 has a strong design spec and a clear MVP concept, but three structural gaps prevent a APPROVED verdict today: (1) zero stories are Ready (no AC, no agents, no test strategy); (2) security issues #221/#222/#226 must be explicitly gated before any new routes ship; (3) the data layer extension has no architecture document. All three gaps are fixable in 1–2 grooming sessions. Once Epic 1 stories are groomed to Ready and the Data Layer Spec (1-page) is written, the plan is promotable to APPROVED and sprint 1 can begin.

---

*Synthesized from: sd-strategic-alignment-reviewer, sd-technical-strategy-reviewer, sd-scope-tradeoffs-reviewer, plus inline summaries for sd-decomposition-quality-reviewer, sd-risk-timelines-reviewer, sd-execution-readiness-reviewer*
*Domains excluded (N/A): None — all 6 domains contributed*
*Finding stats: 12 total (3 critical, 5 high, 3 medium, 1 low)*
*Design spec: `docs/superpowers/specs/2026-07-26-phase-1.5-statements-design.md`*
