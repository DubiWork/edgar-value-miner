// @ts-check
import { test, expect } from '@playwright/test';
import { SELECTORS } from '../helpers/selectors.js';
import { VIEWPORTS } from '../helpers/viewports.js';
import { COMPANY_TICKERS } from '../fixtures/mock-sec-data.js';

// =============================================================================
// Search Flow E2E Tests — MOSTLY REAL against live staging
//
// Runs against live staging: BASE_URL=https://edgar-value-miner-staging.web.app
//
// secCompanyFacts — fully real (live Cloud Function, AAPL data verified)
// secTickers      — intercepted with mock fixture: the live Cloud Function
//                   silently fails in headless Chromium (CORS / cold-start
//                   timeout) so we serve the static 797-entry fixture locally.
//                   The fixture contains AAPL + MSFT which is sufficient to
//                   test all autocomplete, keyboard-nav, and touch-target flows.
//
// RT-03 through RT-09, RT-18, RT-19 from the regression test plan.
// =============================================================================

/** Intercept only the secTickers endpoint; let everything else be real. */
async function mockTickersOnly(page) {
  const handler = (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(COMPANY_TICKERS),
    });
  // Dev proxy path
  await page.route('**/api/sec-tickers', handler);
  // Prod / staging Cloud Function path — match any URL containing /secTickers
  await page.route('**secTickers**', handler);
  // Direct SEC CDN path (fallback)
  await page.route('**/www.sec.gov/files/company_tickers.json', handler);
}

test.describe('Search Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockTickersOnly(page);
    await page.goto('/');
  });

  // ---------------------------------------------------------------------------
  // RT-03: Hero search input is visible with placeholder in welcome state
  // ---------------------------------------------------------------------------
  test('RT-03: Hero search input visible with placeholder in welcome state', async ({
    page,
  }) => {
    // Welcome state should be present
    await expect(
      page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`),
    ).toBeVisible();

    // Hero search input should be visible inside the welcome state
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await expect(input).toBeVisible();

    // Placeholder text
    await expect(input).toHaveAttribute(
      'placeholder',
      /search by ticker or company name/i,
    );

    // The search container should be present
    await expect(
      page.locator(`[data-testid="${SELECTORS.tickerSearch.root}"]`).first(),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RT-04: Type "AA", wait, autocomplete dropdown shows matching tickers
  // ---------------------------------------------------------------------------
  test('RT-04: Typing 2+ chars triggers autocomplete dropdown with matching tickers', async ({
    page,
  }) => {
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();
    await input.fill('AA');

    // Wait for the suggestion dropdown to appear (ticker fixture is served locally;
    // the dropdown may show briefly as "No matching tickers found" while debouncing)
    const dropdown = page.locator(
      `[data-testid="${SELECTORS.tickerSearch.dropdown}"]`,
    );
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // At least one suggestion item should be visible
    await expect(
      page.locator(
        `[data-testid="${SELECTORS.tickerSearch.suggestionItem(0)}"]`,
      ),
    ).toBeVisible({ timeout: 5_000 });

    // AAPL should appear in the dropdown because "AA" prefix-matches "AAPL"
    await expect(dropdown.getByText('AAPL')).toBeVisible({ timeout: 5_000 });
    await expect(dropdown.getByText('Apple Inc.')).toBeVisible({ timeout: 5_000 });
  });

  // ---------------------------------------------------------------------------
  // RT-05: Press Down arrow + Enter selects first suggestion, dashboard loads
  // ---------------------------------------------------------------------------
  test('RT-05: Keyboard navigation — Down arrow + Enter selects suggestion', async ({
    page,
  }) => {
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();
    await input.fill('AA');

    // Wait for dropdown with suggestions (ticker fixture served locally)
    await expect(
      page.locator(`[data-testid="${SELECTORS.tickerSearch.dropdown}"]`),
    ).toBeVisible({ timeout: 5_000 });

    // Press Down to highlight first item
    await page.keyboard.press('ArrowDown');

    // Wait for the first item to be highlighted (React state update)
    const firstItem = page.locator(
      `[data-testid="${SELECTORS.tickerSearch.suggestionItem(0)}"]`,
    );
    await expect(firstItem).toBeVisible({ timeout: 5_000 });
    await expect(firstItem).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });

    // Now press Enter to select the highlighted suggestion
    await page.keyboard.press('Enter');

    // Dashboard should load — wait for company banner (live secCompanyFacts Cloud Function)
    await expect(
      page.locator(`[data-testid="${SELECTORS.companyBanner.root}"]`),
    ).toBeVisible({ timeout: 35_000 });
  });

  // ---------------------------------------------------------------------------
  // RT-06: Type "AAPL" + Enter -> dashboard loads with AAPL data
  // ---------------------------------------------------------------------------
  test('RT-06: Searching for valid ticker AAPL via Enter loads dashboard', async ({
    page,
  }) => {
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Dashboard renders — wait for live Cloud Function response (companyFacts)
    await expect(
      page.locator(`[data-testid="${SELECTORS.companyBanner.root}"]`),
    ).toBeVisible({ timeout: 35_000 });

    // Company name heading
    await expect(
      page.getByRole('heading', { name: 'Apple Inc.' }),
    ).toBeVisible();

    // Ticker badge
    await expect(
      page.locator(`[data-testid="${SELECTORS.companyBanner.ticker}"]`),
    ).toHaveText('AAPL');

    // Metric cards are rendered (at least 3)
    const metricCards = page.locator(
      `[data-testid="${SELECTORS.metricCard.root}"]`,
    );
    await expect(metricCards.first()).toBeVisible();
    const count = await metricCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------------------
  // RT-07: After search, clear, focus input -> recent searches dropdown visible
  // ---------------------------------------------------------------------------
  test('RT-07: Recent searches dropdown appears after clearing a previous search', async ({
    page,
  }) => {
    // Seed recent searches in localStorage BEFORE the TickerSearch component
    // mounts. useRecentSearches reads localStorage during its useState
    // initializer, so pre-seeding guarantees handleFocus finds recent items.
    await page.evaluate(() => {
      localStorage.setItem(
        'edgar-recent-searches',
        JSON.stringify([
          { ticker: 'AAPL', companyName: 'Apple Inc.', timestamp: Date.now() },
        ]),
      );
    });

    // Navigate fresh so the TickerSearch reads the seeded localStorage
    await page.goto('/');
    await expect(
      page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`),
    ).toBeVisible({ timeout: 10_000 });

    // The hero search input should be empty and visible
    const heroInput = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await expect(heroInput).toBeVisible();
    await expect(heroInput).toHaveValue('');

    // Click the input — handleFocus checks !inputValue && recentSearches.length > 0
    // and should open the recent searches dropdown.
    await heroInput.click();

    // The recent searches dropdown should appear with "AAPL"
    const dropdown = page.locator(
      `[data-testid="${SELECTORS.tickerSearch.dropdown}"]`,
    );
    await expect(dropdown).toBeVisible({ timeout: 5_000 });
    // "Recent Searches" header text (use locator('span') to avoid matching
    // the sr-only <li> that also contains "recent searches")
    await expect(dropdown.locator('span', { hasText: 'Recent Searches' })).toBeVisible();
    await expect(dropdown.getByText('AAPL')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RT-08: XSS payload is sanitized, no script execution
  // ---------------------------------------------------------------------------
  test('RT-08: XSS payload in search input is sanitized', async ({ page }) => {
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();

    // Type XSS payload
    await input.fill('<script>alert(1)</script>');

    // The input value should be sanitized (tags stripped by inputSanitization)
    // sanitizeTickerInput strips HTML tags and non-alphanumeric characters,
    // then uppercases. "<script>alert(1)</script>" -> "ALERT1"
    const value = await input.inputValue();
    expect(value).not.toContain('<');
    expect(value).not.toContain('>');
    expect(value).not.toContain('script');

    // Verify no script tags exist in the DOM as a result of the input
    const scriptTags = await page.locator('script:not([src])').evaluateAll(
      (scripts) =>
        scripts.filter((s) => s.textContent.includes('alert(1)')).length,
    );
    expect(scriptTags).toBe(0);

    // The sanitized value should only contain allowed characters
    expect(value).toMatch(/^[A-Z0-9.\-]*$/);
  });

  // ---------------------------------------------------------------------------
  // RT-09: Type "ZZZZZ" + Enter -> error / "no company found" message
  // ---------------------------------------------------------------------------
  test('RT-09: Searching for invalid ticker shows error message', async ({
    page,
  }) => {
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();
    await input.fill('ZZZZZ');
    await input.press('Enter');

    // The app should display an error state (the cacheCoordinator will fail
    // because ZZZZZ is not in our mocked company_tickers, so mapTickerToCik
    // will throw TICKER_NOT_FOUND which surfaces as error-state in App.jsx)
    await expect(
      page.locator(`[data-testid="${SELECTORS.app.errorState}"]`),
    ).toBeVisible({ timeout: 10_000 });

    // Error message — the error boundary shows a heading with the error title.
    // The error state is already confirmed visible above; verify the heading text.
    await expect(
      page.locator(`[data-testid="${SELECTORS.app.errorState}"]`)
        .getByRole('heading'),
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RT-18: Mobile viewport 375px - search + suggestions work, 44px touch targets
  // ---------------------------------------------------------------------------
  test('RT-18: Mobile viewport — search and suggestions with 44px touch targets', async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    // Search input should be visible
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await expect(input).toBeVisible();

    // Type and trigger suggestions (ticker fixture served locally)
    await input.click();
    await input.fill('AA');

    // Dropdown should appear
    const dropdown = page.locator(
      `[data-testid="${SELECTORS.tickerSearch.dropdown}"]`,
    );
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // First suggestion should be visible
    const firstItem = page.locator(
      `[data-testid="${SELECTORS.tickerSearch.suggestionItem(0)}"]`,
    );
    await expect(firstItem).toBeVisible({ timeout: 5_000 });

    // Verify touch target size (min-h-[44px] is set in TickerSearch.jsx).
    // Use >= 43.5 to tolerate sub-pixel rounding in headless Chromium.
    const itemBox = await firstItem.boundingBox();
    expect(itemBox).not.toBeNull();
    expect(itemBox.height).toBeGreaterThanOrEqual(43.5);

    // No horizontal overflow on mobile
    const hasOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(hasOverflow).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // RT-19: Keyboard-only search flow (Tab, type, arrow down, Enter)
  // ---------------------------------------------------------------------------
  test('RT-19: Full keyboard-only search flow', async ({ page }) => {
    // Focus the search input directly (it may have autoFocus)
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await expect(input).toBeVisible();

    // Click the input to focus it and trigger loadTickers() in handleFocus
    await input.click();

    // Type 'AA' using keyboard (ticker fixture served locally — fast response)
    await page.keyboard.type('AA');

    // Wait for the first suggestion item to appear
    const firstItem = page.locator(
      `[data-testid="${SELECTORS.tickerSearch.suggestionItem(0)}"]`,
    );
    await expect(firstItem).toBeVisible({ timeout: 5_000 });

    // Navigate down with arrow key
    await page.keyboard.press('ArrowDown');

    // The first item should now be highlighted (aria-selected="true")
    await expect(firstItem).toHaveAttribute('aria-selected', 'true');

    // Screen reader announcement should indicate suggestions available
    const srRegion = page.locator(
      `[data-testid="${SELECTORS.tickerSearch.srAnnouncement}"]`,
    );
    await expect(srRegion).toContainText(/suggestion/i);

    // Press Enter to select
    await page.keyboard.press('Enter');

    // Dashboard should load (live secCompanyFacts Cloud Function)
    await expect(
      page.locator(`[data-testid="${SELECTORS.dashboard.layout}"]`),
    ).toBeVisible({ timeout: 35_000 });
  });
});
