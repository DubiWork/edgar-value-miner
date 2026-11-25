## Problem Statement

A value investor researching a company needs to see full historical financial statements (income, balance sheet, cash flow, ratios, estimates) across 40+ years of SEC data — including correct handling of non-US filers (40-F like SHOP, IFRS like SAP) — drill into any metric on a chart, and toggle between annual and quarterly views. Today the app shows only a capped 5yr/20q slice on a single overview dashboard with no route for statements, no period range selector, and no drill-down. The iCharts recon (all 9 tabs, 2026-08-06) is the reference design.

## Solution

Deliver Phase 1.5 across four epics:

- **Epic 1 (Sprint 0):** Harden the security posture, close infra debt, and complete pre-work refactors that are blockers for the grid.
- **Epic 2 (Data layer + routing):** Uncap full history in the UI, introduce React Router, and split `/statements` route.
- **Epic 3 (Statement Grid 1.5a):** 6-tab company screen with Financial Statements tab containing 9 iCharts-style sub-tabs, sparklines, Annual/Quarterly toggle, period range selector.
- **Epic 4 (Chart Drill-Down 1.5b):** Same-company multi-metric overlay (up to 3), Playwright visual regression baselines, mobile responsive layout.

**Checkpoint gate:** User can see full historical statements for any company across all 9 tabs, drill into any metric on a chart. Data correct for 40-F (SHOP) and IFRS (SAP) filers.

## User Stories

### Epic 1 — Sprint 0 (Security + Pre-work)

1. As a developer, I want Firestore security rules version-controlled in the repo (not console-only), so that rules are reviewable, diffable, and deployable via CI. *(absorbs #221)*
2. As a developer, I want `markStaleInIndexedDB()` to actually invalidate the L1 cache (not silently return `true`), so that soft-invalidation works and stale data is correctly refreshed. *(absorbs #222)*
3. As a security-conscious owner, I want the FMP API key moved server-side (never in the client bundle or URL), the secProxy 502 to not leak the SEC URL, and the dead SEC User-Agent email removed from the bundle. *(absorbs #226)*
4. As a developer, I want `gaapNormalizer.js` split by SRP — data fetching separated from normalization logic — so that each concern is independently testable. *(absorbs #233)*
5. As a developer, I want `normalizeTicker` extracted to a single shared util (`src/utils/ticker.js`) replacing 4 duplicate copies, so that drift is impossible as services multiply. *(absorbs #231)*
6. As a developer, I want unguarded `console.log` calls in the production search path removed or guarded, so that no internal data leaks to the browser console in prod. *(absorbs #227)*
7. As a developer, I want the CI deploy-staging workflow to have a `permissions` block (CodeQL finding), so that the principle of least privilege is enforced. *(absorbs #217)*
8. As a developer, I want the financial-logic core (`gaapNormalizer`, `calculateMargins`, `calculateFairValue`, `inputSanitization`, `useKeyMetrics`) included in the coverage gate, so that regressions in the most critical logic are caught by CI. *(absorbs #223)*
9. As a developer, I want the L1/L2/network integration suite re-enabled (currently `describe.skip`), so that the integration layer runs in CI. *(absorbs #224)*
10. As a developer, I want the quarterly extraction path covered by tests, so that Phase 1.5 quarterly data is verifiably correct before building the grid. *(absorbs #225)*
11. As a developer, I want `useKeyMetrics` rewritten to a config/registry pattern (`{id, selector, formatter, trendFn}[]`) with formatters exported from `src/utils/formatters.js`, so that the statement grid can reuse them without duplication. *(absorbs #229)*
12. As a developer, I want a generic `FinancialBarChart(data, metricLabel, formatter)` component extracted from the duplicated `RevenueChart`/`FCFChart` code, so that the grid can add 10-15 chart rows without 10-15 bespoke files. *(absorbs #228)*
13. As a developer, I want derived metrics (`calculateMargins`) computed inside `normalizeCompanyFacts` rather than at render time in `App.jsx`, so that hooks, tests, and exports all receive canonical data. *(absorbs #230)*
14. As a developer, I want the deploy-staging workflow to build Cloud Functions **before** the hosting deploy (not after), so that a TypeScript compile failure aborts the deploy before anything is promoted — matching the prod build order. *(absorbs #240)*
15. As a developer, I want dead stubs, magic numbers, and JSDoc smells from the July 2026 code review cleaned up, so that the codebase is navigable before new features land. *(absorbs #262)*

### Epic 2 — Data Layer + Routing

16. As a user, I want full historical data (40+ years annual, 80+ quarters) rendered in the app when I search a company, so that I can see the complete financial history iCharts provides.
17. As a developer, I want React Router installed and a `/company/:ticker` route introduced, so that deep-linking to a company's page is possible and the app has a clean URL structure.
18. As a developer, I want a `/statements` sub-route split from the overview cache, so that the statements page can independently manage its data lifecycle.
19. As a user, I want SHOP (40-F filer) and SAP (IFRS filer) to return correct normalized data on the statements page, so that non-US companies display accurate financials.

### Epic 3 — Statement Grid (1.5a)

20. As a user, I want a 6-tab company screen (Overview, Business, Financial Statements, Valuation, Filings, Thesis) so that I can navigate all research areas from one place. Business/Valuation/Filings/Thesis are placeholders in this phase.
21. As a user, I want the Financial Statements tab to have 9 sub-tabs matching the iCharts layout (Income, Balance Sheet, Cash Flow, Reports, Ratios, Estimates, Compare, Score, Valuation) so that I have the full iCharts-style experience.
22. As a user, I want each chart sub-tab to show sparklines for the key metrics so that I can scan trends at a glance before expanding a chart.
23. As a user, I want an Annual / Quarterly toggle on each chart sub-tab so that I can switch between annual and quarterly views for the same metric.
24. As a user, I want a period range selector (1Y / 5Y / 10Y / 20Y) on each chart sub-tab so that I can zoom to the history depth I care about.
25. As a user, I want the Income sub-tab to show 8 bar charts (Revenue, Gross Profit, Operating Income, Net Income, EPS, Shares Outstanding, SBC, Rule of 40) with the iCharts color palette so that I see the same metrics I'm used to.
26. As a user, I want the Balance Sheet sub-tab to show point-in-time bars with MRQ as the last column so that I can see the current balance sheet state.
27. As a user, I want the Cash Flow sub-tab to show Operating Cash Flow, Free Cash Flow, CapEx, Dividends, with support for negative bars, so that cash generation and allocation are visible.
28. As a user, I want the Reports sub-tab to show a tabular view of raw financials with a YOY column and Annual/Quarterly toggle, matching the iCharts Reports tab layout.
29. As a user, I want the Ratios sub-tab to show 9 line charts each with a red-dashed average line, so that I can track valuation and health ratios over time.
30. As a user, I want the Estimates sub-tab to show analyst estimates with beat/miss badges, Low (blue) / High (red) ranges, and forward P/E in the EPS row, so that I can see how the company performs versus Wall Street expectations.
31. As a user, I want the Compare sub-tab to allow up to 5 stocks with per-metric green/red coloring, so that I can benchmark a company against peers.
32. As a user, I want the Score sub-tab to show a placeholder ("coming in Phase 2"), so that the tab exists as a hook for Phase 2 scoring.
33. As a user, I want the Valuation sub-tab to show a live DCF calculator with 10 inputs and 3 scenario cards, consistent with the iCharts Valuation tab design.
34. As a user, I want the Filter Metrics control on Income, Balance, and Cash Flow sub-tabs to be a multi-select so that I can focus on the metrics I care about.

### Epic 4 — Chart Drill-Down (1.5b)

35. As a user, I want to click any metric chart and overlay up to 3 metrics from the same company on a single chart, so that I can visually correlate revenue, margins, and cash flow in one view.
36. As a user, I want Playwright visual regression baselines captured for all 9 sub-tabs so that UI regressions are automatically detected in CI.
37. As a user on mobile, I want the statements grid to render as a single-column layout with stacked charts, so that the page is usable on a phone.
38. As a user on tablet, I want a 2-column metrics layout with stacked charts, so that the page makes good use of medium screen widths.

## Implementation Decisions

- **Router:** React Router v6+. Routes: `/` (current search/overview), `/company/:ticker` (company screen), `/company/:ticker/statements` (statements tab deep-link).
- **Data seam:** All data flows through `cacheCoordinator.getCompanyData(ticker, { fullHistory: true })`. The `fullHistory` flag already exists (Epic #248); Epic 2 wires it to the UI. No new data-fetching layer.
- **`<CompanyScreen />`:** New top-level routed component wrapping the 6-tab scaffold. Owns route params, data loading via `useCompanySearch`, and tab state.
- **`<StatementsTab />`:** New component inside CompanyScreen. Owns sub-tab state, Annual/Quarterly toggle, period range selector. Receives normalized company data as props from CompanyScreen.
- **`<FinancialBarChart />`:** Extracted generic chart (absorbs #228). Accepts `{data, metricLabel, formatter, color}`. All bar-chart sub-tabs compose from this.
- **`useKeyMetrics` registry:** Absorbs #229. Each entry `{id, label, selector, formatter, color, trendFn}`. Formatters exported from `src/utils/formatters.js` and reused by the grid.
- **`normalizeCompanyFacts`:** Absorbs #230 — `calculateMargins` moves inside the normalizer. Grid receives canonical data; no render-time derivation.
- **`normalizeTicker`:** Single copy in `src/utils/ticker.js` (absorbs #231). All services import from there.
- **FMP key:** Moved to a Cloud Function proxy (absorbs #226). Client never receives the key.
- **Firestore rules:** Version-controlled in `firestore.rules` + `firebase.json` (absorbs #221). Deployed via CI.
- **`markStaleInIndexedDB`:** Bug fix — must perform an actual IndexedDB write to set `needsRefresh: true` (absorbs #222).
- **iCharts color palette:** Defined as a design-token constant. Blue `#3b82f6`, green `#22c55e`, purple `#8b5cf6`, orange `#f97316`, red `#ef4444`, red-dashed avg line.
- **Freshness metadata:** Every normalized record carries `{source_type, last_fetched, refresh_policy}` per ADR-0001. Statements page shows "data as of [date]".
- **40-F / IFRS support:** `gaapNormalizer` correctly handles SHOP (40-F) and SAP (IFRS) namespace differences. Verified by fixture tests.
- **Score and AI Insights sub-tabs:** Placeholders in Phase 1.5 only.

## Testing Decisions

Good tests verify external behavior at the highest viable seam — what the module or component provides to the rest of the app — not internal implementation details. Prefer sociable tests (real service + mock network) over isolated mocks of internal collaborators.

**Seams (in priority order):**

1. **`cacheCoordinator.getCompanyData(ticker, { fullHistory: true })`** — all data-layer stories. Prior art: `src/services/__tests__/cacheCoordinator.test.js`. Tests assert: correct normalized shape, `fullHistory` unlocks 40yr data, 40-F and IFRS fixtures normalize correctly.

2. **`useCompanySearch(ticker)`** — route-driven search + data load. Prior art: `src/hooks/__tests__/useCompanySearch.test.js`. Tests assert: hook loads data on ticker change, loading/error states correct.

3. **`<StatementsTab />`** — all 9 sub-tab rendering stories. Prior art: `src/components/Dashboard/__tests__/Dashboard.integration.test.jsx`. Tests assert: correct sub-tab renders on selection, Annual/Quarterly toggle switches data, period range filters data, sparklines present, correct color palette, accessible keyboard navigation.

4. **`<CompanyScreen />`** — routing + 6-tab navigation. Tests assert: `/company/AAPL` renders company screen, correct tab active, deep-link to `/company/AAPL/statements` opens Statements tab.

5. **Firestore rules simulator** — for #221. Uses `@firebase/rules-unit-testing`. Tests assert: client cannot write to `edgarCache`, client can read, Cloud Function service account can write.

6. **`gaapNormalizer` fixtures** — SHOP (40-F) and SAP (IFRS). Prior art: `src/utils/__tests__/gaapNormalizer.test.js`. Tests assert: correct extraction from 40-F and IFRS namespaces.

## Out of Scope

- Phase 2: AI provider abstraction, Feroldi scorecard, interactive DCF, reverse DCF (placeholder tabs only).
- Phase 3: Bull vs Bear debate, AI Insights tab content.
- Auth / personal layer / reasoning trail — Phase 4+.
- SEO / static landing page at root — deferred.
- Multi-user scenarios, rate limiting — Phase 4+.
- Wayfinder map (#241) remains open as a living document.

## Further Notes

- **Reference design:** iCharts recon (2026-08-06, GOOGL). All 9 tabs complete. Specs in private Obsidian vault at `Assets/icharts/ICHARTS-RECON-INDEX.md`. Consult before implementing any sub-tab.
- **Absorbed issues:** #217, #221, #222, #223, #224, #225, #226, #227, #228, #229, #230, #231, #233, #240, #262 (Sprint 0 pre-work) + epics #234, #236, #237.
- **PR #286 (develop→main):** Must merge before Phase 1.5 work begins. Issue #248 closes when it merges.
- **ADR-0001** applies throughout: freshness metadata on every record, provider abstraction, portability constraint.
