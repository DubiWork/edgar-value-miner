# EDGAR Value Miner - Regression Test Plan

**Purpose:** Living regression suite that grows with each feature. Every row is Playwright-executable.
**Updated:** 2026-03-11

---

## Test File Mapping

The regression test plan defines the full scope of E2E coverage. The table below maps each
test-case ID to its current implementation status and spec file.

| ID Range | Flow | Spec File | Status |
|----------|------|-----------|--------|
| RT-01 to RT-02 | Core | `e2e/smoke.spec.js` (Welcome State, Search-to-Dashboard) | Implemented |
| RT-03 to RT-06 | Search | `e2e/smoke.spec.js` (Autocomplete, Enter, Click) | Implemented |
| RT-07 to RT-09 | Search (edge cases) | Not yet implemented | Planned |
| RT-10 to RT-13 | Theme | `e2e/smoke.spec.js` (Theme toggle) | Partially implemented |
| RT-14 to RT-17 | Theme (persistence, a11y, mobile, chart) | Not yet implemented | Planned |
| RT-18 to RT-19 | Search (mobile, a11y) | Not yet implemented | Planned |
| RT-20 to RT-24 | Dashboard | `e2e/smoke.spec.js` (Dashboard via Enter/Click) | Partially implemented |
| RT-30 to RT-32 | Responsive | Not yet implemented | Planned |
| RT-50 to RT-57 | Revenue Chart | DEFERRED (RevenueChart not wired in App.jsx) | Deferred |

> **Note on RT-50 to RT-57:** These Revenue Chart regression tests are deferred because the
> `RevenueChart` component is not yet integrated into `App.jsx`. Once wired, these tests should
> be added to a dedicated `e2e/regression/revenue-chart.spec.js`.

### Current spec files

| File | Tests | Description |
|------|-------|-------------|
| `e2e/smoke.spec.js` | 5 | Primary regression suite with API mocking: welcome state, theme toggle, search autocomplete, search-to-dashboard (Enter), search-to-dashboard (click) |
| `e2e/regression/smoke.spec.js` | 3 | Lightweight deployment smoke tests (no mocking): app loads, no console errors, welcome state renders |
| `e2e/fixtures/mock-sec-data.js` | -- | Shared mock data (COMPANY_TICKERS, AAPL_COMPANY_FACTS) |

---

## Core Flows

| ID | Preconditions | Steps | Expected Result |
|----|--------------|-------|-----------------|
| RT-01 | App loaded | 1. Navigate to / | App loads without console errors, header visible |
| RT-02 | App loaded | 1. Type "AAPL" in search bar 2. Wait for results | Search results appear with company data |

---

## Search Flows (Issue #4)

| ID | Preconditions | Steps | Expected Result |
|----|--------------|-------|-----------------|
| RT-03 | App loaded, welcome state | 1. Verify hero search is visible | Large centered search input with placeholder |
| RT-04 | App loaded | 1. Type "AA" in search 2. Wait 200ms | Autocomplete dropdown shows matching tickers (AAPL, AAL, etc.) |
| RT-05 | Suggestions visible | 1. Press Down arrow 2. Press Enter | First suggestion selected, dashboard loads |
| RT-06 | App loaded | 1. Type "AAPL" 2. Press Enter | Dashboard loads with AAPL data |
| RT-07 | Previous search done | 1. Clear search 2. Focus search input | Recent searches dropdown shows last search |
| RT-08 | App loaded | 1. Type "<script>alert(1)</script>" | Input sanitized, no XSS, error shown |
| RT-09 | App loaded | 1. Type "ZZZZZ" 2. Press Enter | "No company found" error message |
| RT-18 | Mobile viewport 375px | 1. Tap search input 2. Type "MSFT" | Keyboard appears, suggestions visible, 44px touch targets |
| RT-19 | App loaded | 1. Tab to search 2. Type "G" 3. Arrow down 4. Enter | Full keyboard flow works, screen reader announces |

---

## Theme Flows (Issue #10)

| ID | Preconditions | Steps | Expected Result |
|----|--------------|-------|-----------------|
| RT-10 | Fresh browser, OS dark mode | 1. Navigate to / | Dark theme applied, no FOUC |
| RT-11 | Fresh browser, OS light mode | 1. Navigate to / | Light theme applied, no FOUC |
| RT-12 | App loaded in dark mode | 1. Click theme toggle in header | Theme switches to light, all colors update |
| RT-13 | App loaded in light mode | 1. Click theme toggle in header | Theme switches to dark, all colors update |
| RT-14 | App in dark mode | 1. Toggle to light 2. Reload page | Light mode persisted via localStorage |
| RT-15 | App loaded | 1. Tab to theme toggle 2. Press Enter | Theme switches, screen reader announces change |
| RT-16 | Mobile viewport (375px) | 1. Navigate to / 2. Tap theme toggle | Toggle is 44x44px, theme changes, no layout break |
| RT-17 | App loaded with chart visible | 1. Toggle theme | Chart colors update to match new theme |

---

## Dashboard Flows (Issue #3)

| ID | Preconditions | Steps | Expected Result |
|----|--------------|-------|-----------------|
| RT-20 | App loaded | 1. Search "AAPL" 2. Wait for data | Dashboard shows all sections: banner, metrics, chart containers |
| RT-21 | Dashboard loaded, 375px viewport | 1. Verify layout | Single column, no horizontal overflow, all sections visible |
| RT-22 | Dashboard loaded, 768px viewport | 1. Verify layout | 2-column metric cards, stacked chart containers |
| RT-23 | App loaded | 1. Search "AAPL" | Loading skeletons visible in correct positions before data loads |
| RT-24 | API returns error | 1. Search with mocked error | Error boundary displayed with retry option |

---

## Revenue Chart Flows (Issue #5 -- DEFERRED)

> These tests are **deferred** until `RevenueChart` is integrated into `App.jsx`.
> The component exists but is not yet rendered in the main application layout.

| ID | Preconditions | Steps | Expected Result |
|----|--------------|-------|-----------------|
| RT-50 | Dashboard loaded with valid company data | 1. Search "AAPL" 2. Wait for dashboard | Revenue chart renders in hero chart slot with bar chart and YoY line |
| RT-51 | Dashboard loaded with company missing revenue data | 1. Search company with no revenue data | Revenue chart shows empty state message, no chart rendered |
| RT-52 | Revenue chart visible with multi-year data | 1. Verify YoY labels on chart | YoY percentage labels display correctly above bars (e.g., "+12.3%") |
| RT-53 | Revenue chart visible | 1. Hover over a revenue bar | Tooltip appears with formatted dollar value (e.g., "$394.3B") and year |
| RT-54 | App in dark mode, revenue chart visible | 1. Verify chart colors | Chart uses dark theme palette (dark background, light text, themed bar colors) |
| RT-55 | App in light mode, revenue chart visible | 1. Verify chart colors | Chart uses light theme palette (light background, dark text, themed bar colors) |
| RT-56 | Revenue chart visible, 375px viewport | 1. Verify chart layout | Chart resizes responsively, no horizontal overflow, labels remain readable |
| RT-57 | Revenue chart visible | 1. Inspect DOM for hidden data table | Hidden accessible data table present with sr-only class for screen readers |

---

## Responsive Flows

| ID | Preconditions | Steps | Expected Result |
|----|--------------|-------|-----------------|
| RT-30 | Viewport 375px (mobile) | 1. Navigate to / | Layout responsive, no horizontal overflow |
| RT-31 | Viewport 768px (tablet) | 1. Navigate to / | Layout responsive, proper grid |
| RT-32 | Viewport 1280px (desktop) | 1. Navigate to / | Full desktop layout |

---

## Summary

**Total planned regression cases:** 34
**Implemented:** 8 (across `e2e/smoke.spec.js` and `e2e/regression/smoke.spec.js`)
**Planned (not yet implemented):** 18 (RT-07 to RT-09, RT-14 to RT-19, RT-21 to RT-24, RT-30 to RT-32)
**Deferred:** 8 (RT-50 to RT-57 -- RevenueChart not wired in App.jsx)

**Last feature added:** Issue #5 (Revenue Chart) -- 8 test cases (RT-50 to RT-57), currently deferred

### Execution

```bash
# Run all E2E tests (smoke + regression)
npm run test:e2e

# Run only the primary regression suite (with API mocking)
npx playwright test e2e/smoke.spec.js

# Run lightweight deployment smoke tests
npx playwright test e2e/regression/smoke.spec.js
```

### Known Limitations

1. **No dedicated regression project in Playwright config** -- all tests run under the `chromium` project. A `regression` project can be added to `playwright.config.js` when the suite grows.
2. **Revenue Chart tests deferred** -- `RevenueChart` component exists but is not wired into `App.jsx`.
3. **Single browser only** -- tests currently run in Chromium only. Firefox and WebKit can be added as separate projects.
