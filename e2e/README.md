# E2E Tests (Playwright)

End-to-end tests for EDGAR Value Miner, powered by [Playwright](https://playwright.dev/).

## Directory Structure

```
e2e/
  smoke.spec.js              # Primary regression suite (mocked API calls)
  fixtures/
    mock-sec-data.js          # Shared mock data for SEC EDGAR API responses
  regression/
    smoke.spec.js             # Lightweight deployment smoke tests (no mocking)
  features/
    .gitkeep                  # Placeholder for future feature-specific tests
```

### File Purposes

| File | Purpose |
|------|---------|
| `smoke.spec.js` | Main regression suite. Mocks all external API calls (SEC EDGAR, Firebase) so tests run deterministically without network dependencies. Covers welcome state, theme toggle, search autocomplete, and search-to-dashboard flows. |
| `regression/smoke.spec.js` | Lightweight smoke tests designed for post-deployment verification. Runs against the live app without mocking. Checks basic load, console errors, and search visibility. |
| `fixtures/mock-sec-data.js` | Exports `COMPANY_TICKERS` and `AAPL_COMPANY_FACTS` -- realistic mock data matching the SEC EDGAR API response schemas used by `edgarApi.js`. |

## Running Tests

### Prerequisites

Install Playwright browsers (one-time setup):

```bash
npx playwright install --with-deps chromium
```

### Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run only the primary regression suite (with API mocking)
npx playwright test e2e/smoke.spec.js

# Run lightweight deployment smoke tests
npx playwright test e2e/regression/smoke.spec.js

# Run with visible browser (headed mode)
npx playwright test --headed

# Run a specific test by title
npx playwright test -g "Welcome State renders correctly"

# View the HTML test report after a run
npx playwright show-report
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Target URL for remote testing (CI/staging). When set, the local dev server is not started. | `http://localhost:5174/edgar-value-miner/` |
| `CI` | Enables CI mode: forbids `test.only`, adds 1 retry, uses HTML + GitHub reporters. | unset |

## Mock API Pattern

Tests that need deterministic data should mock external APIs **before** navigating to the page.
The pattern used in `smoke.spec.js`:

```js
import { test, expect } from '@playwright/test';
import { COMPANY_TICKERS, AAPL_COMPANY_FACTS } from './fixtures/mock-sec-data.js';

async function mockAPIs(page) {
  // Mock SEC company tickers endpoint
  await page.route(
    '**/www.sec.gov/files/company_tickers.json',
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(COMPANY_TICKERS),
    }),
  );

  // Mock SEC company facts for a specific CIK
  await page.route(
    '**/data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
    (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AAPL_COMPANY_FACTS),
    }),
  );

  // Block Firebase/Firestore to prevent app from hanging
  await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.abort());
}

test('example test', async ({ page }) => {
  await mockAPIs(page);   // MUST be called before page.goto()
  await page.goto('/');
  // ... assertions
});
```

**Key rules:**
1. Call `mockAPIs(page)` before `page.goto('/')` in every test that needs mocking.
2. Add new mock data to `fixtures/mock-sec-data.js` to keep it centralized.
3. Always abort Firebase/Firestore routes to prevent the app from hanging on auth calls.

## How to Add New Tests

1. **Identify the flow.** Check `REGRESSION_TEST_PLAN.md` (in `.github/`) for the RT-XX ID and expected behavior.

2. **Choose the right file:**
   - For mocked, deterministic tests: add to `e2e/smoke.spec.js` or create a new file under `e2e/regression/`.
   - For deployment verification (no mocking): add to `e2e/regression/smoke.spec.js`.
   - For feature-specific suites: create a new file under `e2e/features/`.

3. **Follow the mock pattern** described above if the test needs API data.

4. **Use `data-testid` attributes** for element selection. Existing test IDs include:
   - `welcome-state`, `ticker-search`, `ticker-search-input`
   - `suggestion-dropdown`, `suggestion-item-0`
   - `dashboard-layout`, `company-banner`, `ticker-badge`
   - `metric-card`, `chart-container`

5. **Update the regression test plan** in `.github/REGRESSION_TEST_PLAN.md` after adding tests.

## Playwright Configuration

The Playwright config lives at `playwright.config.js` in the project root. Key settings:

- **Test directory:** `./e2e`
- **Browser:** Chromium only (single project)
- **Workers:** 1 (sequential execution)
- **Local dev server:** Vite on port 5174 (skipped when `BASE_URL` is set)
- **Traces:** Captured on first retry
- **Screenshots:** Only on failure

## Artifacts

Playwright generates artifacts that are gitignored:

- `test-results/` -- trace files and failure screenshots
- `playwright-report/` -- HTML report
- `playwright/.cache/` -- browser binary cache
