# EDGAR Value Miner - Regression Test Plan

**Purpose:** Living regression suite that grows with each feature. Every row is Playwright-executable.
**Updated:** 2026-03-08

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

## Revenue Chart Flows (Issue #5 — RevenueChart)

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

**Total regression cases:** 34
**Last feature added:** Issue #5 (Revenue Chart) — 8 test cases (RT-50 to RT-57)

*Updated via /groom-issue skill*
