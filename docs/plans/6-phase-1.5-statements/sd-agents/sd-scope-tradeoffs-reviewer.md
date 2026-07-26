# Scope & Tradeoffs Review

## Domain: Scope & Tradeoffs
## Mode: feature-breakdown

---

## Summary

Phase 1.5 has an exceptionally well-articulated UX design spec, but its milestone (#6) scope boundary is dangerously blurred: the five "open questions deferred to PM" are not actually deferred — they must be decided NOW before epic decomposition, or the build will expand unbounded. The core statement grid (progressive disclosure + sparklines + chart drill-down) is the right MVP slice; three of the five "open questions" are clearly V2+ and must be cut explicitly. One build-vs-buy decision (sparklines) is already correct and documented; the remaining data-layer refactors are legitimate pre-work, not gold plating.

---

## Findings

### [sd-no-mvp-cut] — "Open Questions" Are Scope Bombs, Not Deferrals

**Severity:** HIGH

**Evidence:**
The design spec ends with five questions explicitly marked "PM decides at decomposition" — TTM column, per-share mode, CSV/clipboard export, cross-company comparison, and "pin to dashboard." In practice, each of these is a feature with its own data requirements, UI surface, and implementation effort. Leaving them "open" at decomposition time means every engineer on the milestone will individually assume or negotiate scope. This is the textbook case of "no MVP boundary defined — everything is must-have by default."

The spec's four-level progressive disclosure model (`Glance → Grid default → Full expansion → Chart drill-down`) is itself an excellent, tight MVP definition — but only for the UX interaction model. The five deferred questions cut across data layer (TTM requires rolling calculations), rendering (per-share mode requires shares outstanding integration), export infrastructure, and a fundamentally different product surface (cross-company comparison, dashboard pinning). Any of these, if "left open" and then agreed to mid-sprint, will expand the milestone by 30–60%.

Per Eric Ries: "Cut the list in half and cut it in half again." Per Ryan Singer (Shape Up): the appetite for this milestone is already large (6 refactor PRs + the full grid + chart drill-down). The open questions must receive explicit IN/OUT verdicts before the first PR is scoped.

**Recommendation — Verdicts for each open question:**

| Feature | Verdict | Rationale |
|---------|---------|-----------|
| TTM column | OUT — V2+ | Requires rolling-4Q aggregation logic not in current data layer; #225 tests quarterly but TTM is a derived metric. Zero incremental visual value for the MVP grid — the existing annual/quarterly toggle covers the primary research workflow. Re-evaluate after quarterly data is proven stable. |
| Per-share mode | OUT — V2+ | Requires shares-outstanding data (not currently in the 37-metric extraction layer). Adds a global toggle that cross-cuts every value in every grid row. High implementation blast radius for an advanced workflow; iCharts/Stockrow do not default to per-share view. |
| CSV/clipboard export | OUT — V2+ | Pure utility, no visual learning. Contradicts the "less Excely" product constraint — adding export makes the tool feel more like a spreadsheet. Users (single developer) can use the Raw number format toggle + manual copy for now. |
| Cross-company comparison (in grid) | OUT — V2+ | The chart drill-down already supports up-to-3 comparison overlays per line item — that IS the comparison MVP. Full cross-company grid comparison is a fundamentally different data model (multi-company fetch, column layout change). Do not confuse the chart overlay feature with a full comparison mode. |
| "Pin to dashboard" | OUT — V2+ | Depends on a persistence/dashboard infrastructure that does not exist. The overview page already shows 7 key metrics. This is a future personalization layer, not a deep-analysis feature. |

The minimum that makes the statement view useful for deep analysis is exactly the four-level interaction model as designed: grid with collapsed groups, sparklines, YoY, drill-down chart with comparison overlays. Everything else is additive polish.

---

### [sd-gold-plating] — #143 (AI Debate Epic) Is on the Wrong Milestone

**Severity:** HIGH

**Evidence:**
Issue #143 (AI Debate epic) is assigned to milestone #6 alongside the statement grid work. By the task description's own framing, this is "v2.0 differentiation." Building an AI debate feature before the core financial statement view is delivered and validated contradicts the fundamental product sequencing principle: prove the data visualization is useful for deep analysis before adding AI reasoning on top of it. There is no investor workflow that requires AI debate before requiring accurate, complete financial data.

If #143 is allowed to share milestone scope with the statement grid, one of two things will happen: (a) the grid ships incomplete because AI debate consumed bandwidth, or (b) the milestone deadline is extended to fit both — the Shape Up "project dies at time limit" anti-pattern in reverse (never-ending because of scope addition).

**Recommendation:** Move #143 to milestone #7 or a dedicated "AI features" milestone. The dependency order is: complete data layer (#225, #229, etc.) → statement grid → validated data quality → AI reasoning on top of clean, complete data. Shipping AI debate on incomplete or unvalidated data is doubly wasteful.

---

### [sd-gold-plating] — Refactor Pre-Work Is Correctly Scoped (No Action Needed)

**Severity:** LOW

**Evidence:**
The six refactor PRs (#228–#232, #225, #223) listed as "Dependencies on code-review findings" are genuine foundational work, not gold plating. Each has a direct, traceable link to a Phase 1.5 requirement:
- #228 (generic FinancialBarChart) → chart drill-down and comparison overlays cannot be built without it.
- #229 (config/registry-driven useKeyMetrics) → the statement grid renders N line items from config; without this, every line item is a hardcoded special case.
- #230 (unify derived metrics) → the Ratios & Margins tab is blocked.
- #231 (de-dup normalizeTicker) → data integrity prerequisite.
- #232 (raw-vs-normalized caching + route split) → the `/statements` route itself depends on this.

These are the scooter's wheels — not gold plating, not axle-only fragments. They unlock end-to-end functionality.

**Recommendation:** Keep all six refactor PRs on milestone #6. No scope changes needed here.

---

### [sd-gold-plating] — Hotfixes and Security Issues Should Not Block Statement Grid

**Severity:** MEDIUM

**Evidence:**
Hotfixes #191, #192, #194 and security issues #221, #226 are on milestone #6. These are maintenance and security concerns unrelated to the statement grid UX. The risk is not that they are wrong to fix — they absolutely should be fixed — but that if they are treated as gate conditions for the statement grid work, any one of them could delay the primary deliverable.

Specifically:
- Security issues (#221, #226): Security fixes should always be addressed, but they should run in parallel as a priority track, not as a blocker that halts statement grid development. The statement grid is a read-only data visualization — it does not introduce new attack surfaces if the fixes are about existing functionality. Fix them on their own PR, merge them to develop immediately, do not sequence them as "must ship first before grid work starts."
- Hotfixes (#191, #192, #194): Bug fixes. Same logic — parallel track, not serial dependency.

**Recommendation:** Explicitly declare that #191/#192/#194 and #221/#226 run in parallel with the grid epics. The single developer context makes this a sequencing question, not a team allocation question: finish hotfixes and security PRs FIRST (they are small), THEN start the refactor chain, THEN the grid. But they should not be on the milestone's critical path as blockers — they should be done before the refactor PRs begin, treating them as sprint 0 cleanup.

---

### [sd-build-vs-buy] — Sparkline Decision Is Correct and Well-Documented

**Severity:** LOW

**Evidence:**
The spec explicitly rejects @nivo and Recharts LineChart for sparklines, choosing raw SVG (~40 lines) instead. This is the right call: "@nivo would add ~45KB for a 60px cell; Recharts LineChart overhead too heavy at 30–50 sparklines/page." The build-vs-buy reasoning is documented in the spec itself (Section 8). This is a case where "buy" (use an existing charting library) would be gold plating — adding 45KB of bundle for a 60px SVG that only needs monotone area, 1.5px stroke, and gradient fill.

**Recommendation:** No action. This decision is correctly reasoned and documented.

---

### [sd-build-vs-buy] — Ratios & Margins Tab: Verify No External Formula Library Is Needed

**Severity:** LOW

**Evidence:**
The spec includes a "Ratios & Margins" tab as a fourth statement tab, dependent on #230 (unify derived metrics). The existing data layer has ~37 GAAP metrics. Standard financial ratios (P/E, EV/EBITDA, gross margin, ROIC, current ratio, etc.) are arithmetic derivations from those metrics — no external formula library is needed, and this is the correct approach. However, the scope of which ratios are included in Phase 1.5 vs. V2+ is not defined in the spec.

**Recommendation:** At epic decomposition, explicitly list which ratios are in scope for Phase 1.5. Recommendation: limit to the ratios derivable from the existing 37 GAAP metrics without requiring new data sources (e.g., shares outstanding for EPS, market cap for P/E require external price/shares data). Ratios requiring non-SEC data sources (P/E, EV multiples) belong in V2+ unless market data is already being fetched.

---

## Scope Map

| Item | MVP (1.5)? | V2+? | Rationale |
|------|-----------|------|-----------|
| `/company/:ticker/statements` route | YES | — | Core deliverable; new route for deep-dive |
| Income Statement tab + grid | YES | — | Primary research surface |
| Balance Sheet tab + grid | YES | — | Required for Roni's 16-item checklist |
| Cash Flow tab + grid | YES | — | Required for Roni's 16-item checklist |
| Ratios & Margins tab | YES (limited) | — | Include only ratios derivable from existing 37 metrics; no new data sources |
| Progressive disclosure (4 levels) | YES | — | Core UX constraint; prevents Excel feel |
| Collapsible groups + color accents | YES | — | Visual differentiation; "less Excely" |
| Inline sparklines (raw SVG) | YES | — | Trend-at-a-glance; correctly scoped |
| YoY badges (chip + arrow) | YES | — | Essential for pattern recognition |
| Sticky headers + label column | YES | — | Usability for wide grids |
| Annual/Quarterly toggle | YES | — | Core navigation |
| Range presets + brush minimap | YES | — | Control bar UX |
| Number format toggle (abbreviated/raw) | YES | — | Anti-Excel detail; simple toggle |
| Chart drill-down (slide-over/bottom-sheet) | YES | — | CAGR + high/low + series = deep analysis |
| Comparison overlays in chart (up to 3) | YES | — | In-chart comparison; correctly scoped |
| Accessibility (WCAG 2.1 AA) | YES | — | Non-negotiable; built into spec |
| Data gap handling | YES | — | Required for completeness |
| Refactor pre-work (#228-#232, #225, #223) | YES | — | Hard blockers for grid + chart |
| Hotfixes (#191, #192, #194) | YES (parallel) | — | Fix before refactors, not as grid blocker |
| Security issues (#221, #226) | YES (parallel) | — | Fix before refactors, not as grid blocker |
| TTM column | — | YES | Requires rolling-4Q derivation; quarterly data not yet validated |
| Per-share mode | — | YES | Requires shares-outstanding data not in current layer |
| CSV/clipboard export | — | YES | Contradicts "less Excely"; no deep-analysis value |
| Cross-company comparison grid | — | YES | Different data model; chart overlays cover the MVP need |
| "Pin to dashboard" | — | YES | Requires persistence infrastructure; personalization layer |
| AI Debate epic (#143) | — | YES (v2.0) | Depends on clean/validated data; wrong milestone |

---

## Build-vs-Buy Decisions

| Component | Decision | Alternatives Evaluated | Rationale |
|-----------|----------|----------------------|-----------|
| Sparklines | BUILD (raw SVG, ~40 lines) | @nivo (rejected: +45KB), Recharts LineChart (rejected: too heavy for 30-50 instances/page) | Correct. Documented in spec Section 8. Simple monotone area needs no charting library. |
| Chart drill-down | BUILD on existing Recharts/chart infrastructure via #228 refactor | New library (not evaluated) | Correct. Reusing and generalizing existing FinancialBarChart is the right move — no new library needed. |
| Financial ratio formulas | BUILD (arithmetic on existing 37 metrics) | External formula library (not needed) | Correct. Standard ratios are arithmetic; no library adds value here. |
| Data extraction layer | BUILD (existing SEC EDGAR parser) | Financial data APIs (Bloomberg, Polygon, Intrinio) | Acceptable for a personal tool. If data coverage gaps become blocking (e.g., shares outstanding for per-share mode), evaluate Polygon.io or similar for supplemental data in V2+. |

---

## Overall Assessment

- **Scope Score:** REASONABLE (grid + chart drill-down core), but BLOATED if the five open questions are left unresolved at decomposition
- **Items to Cut (move to V2+):** TTM column, per-share mode, CSV/clipboard export, cross-company comparison grid, "pin to dashboard," AI Debate epic (#143)
- **Buy Opportunities:** None for Phase 1.5. If V2+ per-share mode requires shares-outstanding data, evaluate Polygon.io free tier before building a custom shares scraper from SEC filings.
- **Key Sequencing Rule:** Hotfixes + security (#191, #192, #194, #221, #226) → refactor pre-work (#228-#232, #225, #223) → statement grid → chart drill-down. Run hotfixes and security as sprint 0; do not let them block grid work once they are merged.
