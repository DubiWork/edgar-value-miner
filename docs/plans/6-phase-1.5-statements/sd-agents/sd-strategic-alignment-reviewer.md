# Strategic Alignment Review

## Domain: Strategic Alignment
## Mode: feature-breakdown

---

## Summary

Phase 1.5 is strategically coherent: it has one user, one purpose, and a hard UX constraint that keeps scope honest. The north star is implicitly "help the developer/owner do deep fundamental analysis faster," but it is never stated as a measurable outcome, which creates a sequencing gap. Priority ordering is mostly correct — pre-work refactors (#228-232) before the statement grid, hotfixes and CI issues absorbed as table-stakes — but three scope-boundary decisions are left open without a forcing mechanism, creating real scope-creep risk at the story-writing stage.

---

## Findings

### [sd-no-north-star] — North Star Exists in Spirit but Not on Paper

**Severity:** MEDIUM

**Evidence:**
The spec names the product goal in passing ("help ONE user do deep fundamental analysis faster") and names the constraint ("less Excely, more intuitively visual"), but nowhere in the task brief, the design spec, or the scope questions is there a single measurable outcome that declares Phase 1.5 "done and valuable."

The design spec exit criterion (`Playwright toHaveScreenshot()` baselines captured after human approval) is a quality gate, not a value gate. It answers "did we build it correctly?" not "did we make deep analysis faster?"

The OKR frameworks from the loaded knowledge bases (Brainstorm OKRs, Inspired Product, Outcome Roadmap) are unanimous: without a measurable north star, every story competes equally for priority, and the exit gate becomes "ship all planned stories" rather than "user can do X in Y minutes."

For a personal tool with one user, a minimal north star is achievable and sufficient. Example candidates:
- "Time from opening `/statements` to reading a 10-year revenue trend: under 60 seconds without instructions."
- "All 4 statement tabs load, with correct data for at least 50 S&P 500 tickers, for annual and quarterly periods."
- "Zero regressions on existing Overview glance functionality."

Without one of these (or similar), the milestone has no objective completion signal beyond feature checklist.

**Recommendation:**
Before epic decomposition proceeds, define exactly one measurable success criterion for Phase 1.5 as a whole. Write it in outcome terms, not feature terms. Slot it as the "Success Criteria / OKRs" section of the epic format #143 header. Even a simple "the developer can load any S&P 500 ticker statements page and read a 10-year revenue trend in under 2 minutes" is sufficient for a personal tool.

---

### [sd-misaligned-priorities] — Pre-Work Sequencing is Correct; Scope-Question Deferral is a Hidden Priority Inversion

**Severity:** MEDIUM

**Evidence:**
The build order implied by the spec is strategically sound:

1. Security/CI table-stakes (#221, #226, #217, #219) — unblocking safe deployment
2. Pre-work refactors (#228-232) — enabling the presentation layer
3. Data layer validation (#223, #225) — enabling correct data
4. Statement grid build — the core Phase 1.5 deliverable
5. Hotfixes (#191, #192, #194) — absorbed as quality floor

This sequencing correctly mirrors the "CRITICAL before HIGH before MEDIUM" logic from the loaded prioritization frameworks.

The hidden inversion is in the five scope questions deferred to "PM decides at decomposition":
- TTM column
- Per-share mode
- CSV/clipboard export
- Cross-company comparison
- "Pin to dashboard"

Each of these has a different effort profile and a different relationship to the north star. "Cross-company comparison" and "Pin to dashboard" are clearly Phase 2.0 features — they require infrastructure (comparison state management, dashboard persistence) that is architecturally non-trivial and completely outside the current Phase 1.5 data model. If they are left open during story-writing, there is a structural risk that individual stories will be written to "accommodate" these features (e.g., adding comparison URL params, adding pin affordances to UI) which constitutes scope creep disguised as future-proofing.

The other three (TTM column, per-share mode, CSV export) are implementable within the existing data layer at low-to-medium effort, but they also are not required for the core "show all SEC data visually" goal. Their deferral is appropriate; their status needs to be explicit in the plan (MVP vs Full split in epic format #143).

**Recommendation:**
Before story-writing, make explicit decisions on all five questions using the MoSCoW method:
- **Cross-company comparison:** OUT of 1.5 (requires separate comparison infrastructure, separate from #143 AI Debate for the same reason)
- **Pin to dashboard:** OUT of 1.5 (no dashboard architecture exists)
- **TTM column:** SHOULD HAVE for MVP if data layer can compute it from quarterly data without new endpoints; otherwise Phase 2.0
- **Per-share mode:** COULD HAVE; implement only if shares-outstanding is already in the data model (check before committing)
- **CSV/clipboard export:** COULD HAVE; implement only in Phase 1.5 Full split, not MVP; a single "copy value" on right-click is sufficient for MVP

This decision should appear in the epic's "MVP/Full split" table. Leaving them open at story-writing time is the proximate cause of schedule risk.

---

### [sd-scope-creep] — #143 (AI Debate) Is Out-of-Scope by Any Reasonable Standard; But the Spec Opens Two New Scope Doors

**Severity:** HIGH

**Evidence:**
The task prompt correctly identifies that #143 (AI Debate epic) should be recommended OUT of milestone 1.5. From a strategic alignment standpoint this is unambiguous: the north star is "show all SEC data visually," and AI debate functionality serves a completely different job-to-be-done (analytical deliberation / second opinion) that requires its own infrastructure, its own UX surface, and its own exit criteria. Including it in milestone 1.5 would violate the "cannonballs vs lead bullets" principle from the loaded prioritization frameworks — it would split engineering attention between completing the data display layer (the cannonball) and a separate AI feature (a future cannonball). Recommend #143 to milestone 2.0 or later.

However, the design spec itself introduces two new scope vectors that are not among the "five open questions" but carry real scope-creep risk:

**Scope door 1 — Ratios & Margins tab (#4 tab in the IA).** The spec includes "Ratios & Margins" as a full fourth tab. Pre-work issue #230 ("unify derived metrics") is the prerequisite. But the spec does not bound which ratios are in scope. Standard financial ratio sets (P/E, EV/EBITDA, P/FCF, Debt/Equity, current ratio, gross/operating/net margins, ROE, ROA, ROIC) number 15-25 items and require both derived-metric computation and a separate data join with market price data (for valuation ratios). If "Ratios & Margins" means derived margins from income statement data only (gross margin, operating margin, net margin, EBITDA margin), that is achievable within the Phase 1.5 data model. If it means full valuation ratios including market-price-dependent metrics, it requires new data sources and is Phase 2.0 scope.

The spec is silent on this boundary. If unresolved, a story author can legitimately write P/E and EV/EBITDA stories that belong in Phase 2.0.

**Scope door 2 — "Up-to-3 comparison overlays" in the chart drill-down (Section 6).** The spec says the line-item chart drill-down supports "up to 3 comparison overlays." This sounds like comparing the same metric across multiple companies (cross-company comparison), which the five open questions explicitly flag as a separate feature. If "comparison overlays" means comparing 3 different line items for the same company (e.g., Revenue vs Gross Profit vs Net Income on one chart), that is reasonable scope. If it means 3 companies on one chart, it is the same infrastructure as "Cross-company comparison" which is Phase 2.0.

The spec does not clarify which interpretation is intended.

**Recommendation:**
Add two explicit scope boundaries to the epic plan before story-writing:

1. Ratios & Margins tab is Phase 1.5 ONLY for derived margins from income statement data (gross margin, operating margin, net margin, EBITDA margin). All market-price-dependent valuation ratios (P/E, EV/EBITDA, etc.) are Phase 2.0. Label this explicitly in the MVP/Full split table.

2. "Comparison overlays" in chart drill-down means multiple line items for the SAME company, not cross-company. If cross-company overlays are desired, they move with the "Cross-company comparison" feature to Phase 2.0. Clarify this in the drill-down epic story acceptance criteria.

---

## Overall Assessment

- **Alignment Score:** ADEQUATE
- **Key Risks:**
  1. No measurable north star means the milestone can ship "complete" by feature count but fail by user value — particularly risky for the quarterly extraction path (#225) which is untested and could silently produce wrong data that passes visual review.
  2. Five unresolved scope questions + two undocumented scope boundaries (Ratios tab depth, comparison overlay semantics) create 7 open doors for scope creep at story-writing time; any one of them can pull Phase 2.0 work into this milestone.
- **Quick Wins:**
  1. Write one measurable north star sentence and add it to the milestone description before any story is written. This takes 10 minutes and eliminates ambiguity about when Phase 1.5 is "done."
  2. Add a "Not in Phase 1.5" explicit exclusion list to the epic overview: Cross-company comparison, Pin to dashboard, Market-price valuation ratios, AI Debate (#143), and cross-company overlays in the drill-down panel. Explicit exclusion lists are more powerful than MoSCoW alone because they create a forcing function during grooming.
