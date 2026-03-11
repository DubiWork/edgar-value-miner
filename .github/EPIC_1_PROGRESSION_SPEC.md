# Progression Spec: Epic #1 -- Phase 1: Beautiful Data Visualization Dashboard

**Created:** 2026-03-11
**Epic issue:** #1
**Version:** v1.0.0
**Status:** RETROACTIVE -- Epic #1 shipped before the progression spec workflow existed. This document is created retroactively as part of #107 to establish a traceable record of what is now protected by regression tests.

**Parent issues:** #2, #3, #4, #5, #6, #7, #8, #9, #10, #11
**Sub-issues:** #13-#21, #22-#31, #34-#41, #48-#52, #55-#57, #63-#66, #75-#78, #83-#88, #95-#99

**Purpose:** Tracks the mapping between Epic #1 features and their regression test coverage. Since this epic was already promoted to production (v1.0.0), tests are being written retroactively in #107 and placed directly into `e2e/regression/` (no feature-to-regression graduation step needed).

---

## Features Delivered

| # | Feature | Parent Issue | Key Sub-Issues | Description |
|---|---------|-------------|----------------|-------------|
| F-1 | SEC EDGAR API Integration | #2 | -- | Fetch 5 years of financial data from SEC EDGAR |
| F-2 | Dashboard Layout | #3 | #34-#41 | CSS Grid layout with banner, metrics, chart containers, responsive design |
| F-3 | Ticker Search | #4 | #22-#31 | Autocomplete search with hero/compact variants, recent searches, XSS prevention |
| F-4 | Revenue Trend Chart | #5 | #48-#52 | Bar chart with YoY growth line, theme-aware colors, responsive |
| F-5 | Free Cash Flow Chart | #6 | #55-#57 | FCF trend visualization with useChartTheme integration |
| F-6 | Margins Chart | #7 | #63-#66 | Gross/Operating/Net margins with Recharts, dashboard wiring |
| F-7 | Key Metrics Cards | #8 | #75-#78 | Financial metric cards with animations, debt-to-equity calculation |
| F-8 | P/E Fair Value | #9 | #83-#88 | FMP API service, calculateFairValue utility, ValuationPanel, stock quote hook |
| F-9 | Dark/Light Theme | #10 | #13-#21 | FOUC prevention, CSS custom properties, ThemeContext, toggle, chart color bridge |
| F-10 | Local Watchlist | #11 | #95-#99 | useWatchlist hook, WatchlistCard, WatchlistPanel, 3-company limit, upgrade prompt |

---

## Regression Test Coverage

### Source Test Plans

The following per-issue test plans were used to derive the 34 regression test cases in `REGRESSION_TEST_PLAN.md`. These test plans were created during grooming and are the authoritative source for test case details:

| Source Plan | Issue | Flow Section | RT IDs | Count |
|-------------|-------|-------------|--------|-------|
| (Core - no dedicated plan) | -- | Core Flows | RT-01, RT-02 | 2 |
| ISSUE_4_TEST_PLAN | #4 | Search Flows | RT-03 to RT-09, RT-18, RT-19 | 9 |
| ISSUE_10_TEST_PLAN | #10 | Theme Flows | RT-10 to RT-17 | 8 |
| ISSUE_3_TEST_PLAN | #3 | Dashboard Flows | RT-20 to RT-24 | 5 |
| ISSUE_5_TEST_PLAN | #5 | Revenue Chart Flows | RT-50 to RT-57 | 8 |
| (Responsive - cross-cutting) | -- | Responsive Flows | RT-30 to RT-32 | 3 |
| **Total** | | | | **34** (note: RT-25 to RT-29, RT-33 to RT-49 are reserved) |

### Test Case to Spec File Mapping

All tests are placed directly in `e2e/regression/` since this is a retroactive spec.

| ID | Scenario | Spec File | Source Issue | Feature | Status |
|----|----------|-----------|-------------|---------|--------|
| RT-01 | App loads without errors, header visible | `e2e/regression/core.spec.js` | -- | F-1, F-2 | Covered |
| RT-02 | Search "AAPL" returns company data | `e2e/regression/core.spec.js` | -- | F-1, F-3 | Covered |
| RT-03 | Hero search visible on welcome state | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-04 | Autocomplete dropdown with matching tickers | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-05 | Keyboard navigation selects suggestion | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-06 | Type "AAPL" + Enter loads dashboard | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-07 | Recent searches dropdown shows last search | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-08 | XSS input sanitized, error shown | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-09 | Invalid ticker shows "No company found" | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-10 | OS dark mode detected, no FOUC | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-11 | OS light mode detected, no FOUC | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-12 | Toggle dark to light, all colors update | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-13 | Toggle light to dark, all colors update | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-14 | Theme preference persisted via localStorage | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-15 | Keyboard toggle + screen reader announcement | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-16 | Mobile theme toggle 44x44px, no layout break | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-17 | Chart colors update on theme toggle | `e2e/regression/theme.spec.js` | #10 | F-9 | Covered |
| RT-18 | Mobile search with touch targets | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-19 | Full keyboard search flow with a11y | `e2e/regression/search.spec.js` | #4 | F-3 | Covered |
| RT-20 | Dashboard shows all sections after search | `e2e/regression/dashboard.spec.js` | #3 | F-2 | Covered |
| RT-21 | Mobile single column, no overflow | `e2e/regression/dashboard.spec.js` | #3 | F-2 | Covered |
| RT-22 | Tablet 2-column metric cards | `e2e/regression/dashboard.spec.js` | #3 | F-2 | Covered |
| RT-23 | Loading skeletons in correct positions | `e2e/regression/dashboard.spec.js` | #3 | F-2 | Covered |
| RT-24 | Error boundary with retry option | `e2e/regression/dashboard.spec.js` | #3 | F-2 | Covered |
| RT-30 | Mobile 375px responsive layout | `e2e/regression/responsive.spec.js` | -- | F-2 | Covered |
| RT-31 | Tablet 768px responsive layout | `e2e/regression/responsive.spec.js` | -- | F-2 | Covered |
| RT-32 | Desktop 1280px full layout | `e2e/regression/responsive.spec.js` | -- | F-2 | Covered |
| RT-50 | Revenue chart renders with bar + YoY line | -- | #5 | F-4 | DEFERRED |
| RT-51 | Empty revenue data shows empty state | -- | #5 | F-4 | DEFERRED |
| RT-52 | YoY percentage labels above bars | -- | #5 | F-4 | DEFERRED |
| RT-53 | Hover tooltip with formatted dollar value | -- | #5 | F-4 | DEFERRED |
| RT-54 | Dark theme chart palette | -- | #5 | F-4 | DEFERRED |
| RT-55 | Light theme chart palette | -- | #5 | F-4 | DEFERRED |
| RT-56 | Revenue chart responsive at 375px | -- | #5 | F-4 | DEFERRED |
| RT-57 | Hidden accessible data table for screen readers | -- | #5 | F-4 | DEFERRED |

---

## Summary

- **Total regression test cases:** 34
- **Covered (spec file assigned, being implemented in #107):** 26
- **Deferred (RT-50 to RT-57):** 8
- **Gaps (missing test coverage):** 0 (all non-deferred cases have spec files)

---

## Deferred Tests: RT-50 to RT-57 (Revenue Chart)

**Reason:** The `RevenueChart` component exists (Issue #5, sub-issues #48-#52) but is not wired into the UI. The hero chart slot currently shows a static placeholder. A separate prerequisite issue must wire `RevenueChart` into `App.jsx` before these 8 e2e tests can be meaningfully executed.

**Action required:** When `RevenueChart` is wired into the dashboard, create a new issue to:
1. Add `revenue-chart.spec.js` to `e2e/regression/`
2. Implement RT-50 through RT-57
3. Update this progression spec to mark them as Covered

---

## Features Without Dedicated E2E Test Cases

The following Epic #1 features are covered indirectly through other test flows rather than having dedicated regression test IDs. This is by design -- they are validated as part of the dashboard and search flows.

| Feature | Covered By | Notes |
|---------|-----------|-------|
| F-1: SEC EDGAR API | RT-01, RT-02, RT-06, RT-20 | API integration is tested implicitly when search returns data and dashboard renders |
| F-5: FCF Chart | RT-20 | Verified as part of dashboard "all sections visible" check |
| F-6: Margins Chart | RT-20 | Verified as part of dashboard "all sections visible" check |
| F-7: Key Metrics Cards | RT-20, RT-21 | Verified as part of dashboard layout checks |
| F-8: P/E Fair Value | RT-20 | ValuationPanel verified as part of dashboard sections |
| F-10: Watchlist | -- | Deferred from Epic #1 regression (AC-21). Watchlist was the last feature shipped and does not have dedicated e2e test cases in the current plan. |

---

## Graduation Record

| Date | Event | Version | Notes |
|------|-------|---------|-------|
| 2026-03-08 | Epic #1 promoted to production | v1.0.0 | Direct promotion (pre-workflow) |
| 2026-03-11 | Retroactive progression spec created | -- | Issue #110, part of #107 test infrastructure |
| TBD | E2E regression spec files implemented | -- | Issues #108, #109, #111-#115 (sibling tasks in #107) |
| TBD | RT-50 to RT-57 implemented | -- | Pending RevenueChart UI wiring |

---

*This document was created retroactively. Future epics will have their progression spec created during the BAKE-START phase, before production promotion.*
