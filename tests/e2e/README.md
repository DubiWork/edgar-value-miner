# E2E Tests - Placeholder

**Status:** Deferred to Phase 1 UI Issues

## Why Deferred

E2E (End-to-End) tests require UI components to be built first. The SEC EDGAR API integration (Issue #2) provides the backend services, but E2E tests need:

1. Search input component (Issue #3 or later)
2. Company data display component (Issue #4 or later)
3. Error handling UI (Issue #5 or later)
4. Loading states integrated into UI

## Planned E2E Test Paths

### Path 1: First-Time Search (Cold Cache)
```
User flow:
1. User opens app
2. User types "AAPL" in search box
3. System shows loading state
4. System fetches from SEC (L3)
5. System displays company data
6. Verify: All metrics present, charts render
7. Time: <10 seconds
```

### Path 2: Cached Search (Hot Cache)
```
User flow:
1. User types "AAPL" again
2. System shows loading state
3. System fetches from IndexedDB (L1)
4. System displays company data
5. Verify: Same data, instant load
6. Time: <1 second
```

### Path 3: Invalid Ticker Error
```
User flow:
1. User types "INVALID123"
2. System shows loading state
3. System returns error from SEC
4. System displays user-friendly error message
5. User can retry with different ticker
6. Verify: Error boundary catches, shows "Try Again" button
```

## When to Implement

E2E tests should be created **after**:
- Issue #3: Company search UI component
- Issue #4: Company data display dashboard
- Issue #5: Error handling UI integration

## Framework

**Recommendation:** Playwright (already configured in most React projects)

**Alternative:** Cypress (if team prefers)

## Estimated Effort

- Setup Playwright/Cypress: 30 minutes
- Write 3 E2E test paths: 1.5 hours
- Debug and stabilize: 30 minutes
- **Total: 2 hours** (as planned in grooming)

## File Structure

```
tests/
  e2e/
    company-search.spec.js  (3 test paths)
    fixtures/
      mock-data.json        (test data)
    helpers/
      selectors.js          (page selectors)
```

## Next Steps

1. Complete Issues #3-#5 (UI components)
2. Return here to implement E2E tests
3. Run: `npm run test:e2e`

---

**Created:** 2026-03-04
**Sub-task:** #14 (deferred to post-UI implementation)
**Issue:** #2 - SEC EDGAR API Integration
