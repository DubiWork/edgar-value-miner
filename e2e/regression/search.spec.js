// @ts-check
import { test, expect } from '@playwright/test';
import { mockAPIs } from '../helpers/mock-apis.js';
import { SELECTORS } from '../helpers/selectors.js';
import { VIEWPORTS } from '../helpers/viewports.js';

// =============================================================================
// Search Flow E2E Tests
//
// Covers the full search experience: autocomplete, keyboard nav, XSS,
// invalid tickers, recent searches, mobile viewport, and accessibility.
// RT-03 through RT-09, RT-18, RT-19 from the regression test plan.
// =============================================================================

test.describe('Search Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
  });

  // ---------------------------------------------------------------------------
  // RT-03: Hero search input is visible with placeholder in welcome state
  // ---------------------------------------------------------------------------
  test('RT-03: Hero search input visible with placeholder in welcome state', async ({
    page,
  }) => {
    // Welcome state should be present
    await expect(page.locator(SELECTORS.welcomeState)).toBeVisible();

    // Hero search input should be visible inside the welcome state
    const input = page.locator(SELECTORS.tickerSearchInput).first();
    await expect(input).toBeVisible();

    // Placeholder text
    await expect(input).toHaveAttribute(
      'placeholder',
      /search by ticker or company name/i,
    );

    // The search container should be present
    await expect(page.locator(SELECTORS.tickerSearch).first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RT-04: Type "AA", wait, autocomplete dropdown shows matching tickers
  // ---------------------------------------------------------------------------
  test('RT-04: Typing 2+ chars triggers autocomplete dropdown with matching tickers', async ({
    page,
  }) => {
    const input = page.locator(SELECTORS.tickerSearchInput).first();
    await input.click();
    await input.fill('AA');

    // Wait for the suggestion dropdown to appear (debounce + render)
    const dropdown = page.locator(SELECTORS.suggestionDropdown);
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // At least one suggestion item should be visible
    await expect(page.locator(SELECTORS.suggestionItem(0))).toBeVisible();

    // AAPL should appear in the dropdown because "AA" prefix-matches "AAPL"
    await expect(dropdown.getByText('AAPL')).toBeVisible();
    await expect(dropdown.getByText('Apple Inc.')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RT-05: Press Down arrow + Enter selects first suggestion, dashboard loads
  // ---------------------------------------------------------------------------
  test('RT-05: Keyboard navigation — Down arrow + Enter selects suggestion', async ({
    page,
  }) => {
    const input = page.locator(SELECTORS.tickerSearchInput).first();
    await input.click();
    await input.fill('AA');

    // Wait for dropdown
    await expect(
      page.locator(SELECTORS.suggestionDropdown),
    ).toBeVisible({ timeout: 5_000 });

    // Press Down to highlight first item, then Enter to select
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Dashboard should load
    await expect(
      page.locator(SELECTORS.dashboardLayout),
    ).toBeVisible({ timeout: 10_000 });

    // Company banner should be present
    await expect(page.locator(SELECTORS.companyBanner)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RT-06: Type "AAPL" + Enter -> dashboard loads with AAPL data
  // ---------------------------------------------------------------------------
  test('RT-06: Searching for valid ticker AAPL via Enter loads dashboard', async ({
    page,
  }) => {
    const input = page.locator(SELECTORS.tickerSearchInput).first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Dashboard renders
    await expect(
      page.locator(SELECTORS.dashboardLayout),
    ).toBeVisible({ timeout: 10_000 });

    // Company name heading
    await expect(
      page.getByRole('heading', { name: 'Apple Inc.' }),
    ).toBeVisible();

    // Ticker badge
    await expect(page.locator(SELECTORS.tickerBadge)).toHaveText('AAPL');

    // Metric cards are rendered (at least 3)
    const metricCards = page.locator(SELECTORS.metricCard);
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
    const input = page.locator(SELECTORS.tickerSearchInput).first();

    // Perform a search first to create a recent search entry
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard to load (search is recorded)
    await expect(
      page.locator(SELECTORS.dashboardLayout),
    ).toBeVisible({ timeout: 10_000 });

    // Now use the compact search bar in the header (second instance)
    const compactInput = page.locator(SELECTORS.tickerSearchInput).nth(1);
    await expect(compactInput).toBeVisible();

    // Clear any existing text and focus
    await compactInput.click();
    await compactInput.fill('');
    await compactInput.focus();

    // The recent searches dropdown should appear with "AAPL"
    const dropdown = page.locator(SELECTORS.suggestionDropdown);
    await expect(dropdown).toBeVisible({ timeout: 5_000 });
    await expect(dropdown.getByText('Recent Searches')).toBeVisible();
    await expect(dropdown.getByText('AAPL')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // RT-08: XSS payload is sanitized, no script execution
  // ---------------------------------------------------------------------------
  test('RT-08: XSS payload in search input is sanitized', async ({ page }) => {
    const input = page.locator(SELECTORS.tickerSearchInput).first();
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
    const input = page.locator(SELECTORS.tickerSearchInput).first();
    await input.click();
    await input.fill('ZZZZZ');
    await input.press('Enter');

    // The app should display an error state (the cacheCoordinator will fail
    // because ZZZZZ is not in our mocked company_tickers, so mapTickerToCik
    // will throw TICKER_NOT_FOUND which surfaces as error-state in App.jsx)
    await expect(
      page.locator(SELECTORS.errorState),
    ).toBeVisible({ timeout: 10_000 });

    // Error message should indicate data not found
    await expect(
      page.getByText(/not found|no data|verify the ticker/i),
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
    const input = page.locator(SELECTORS.tickerSearchInput).first();
    await expect(input).toBeVisible();

    // Type and trigger suggestions
    await input.click();
    await input.fill('AA');

    // Dropdown should appear
    const dropdown = page.locator(SELECTORS.suggestionDropdown);
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // First suggestion should be visible
    const firstItem = page.locator(SELECTORS.suggestionItem(0));
    await expect(firstItem).toBeVisible();

    // Verify touch target size (min-h-[44px] is set in TickerSearch.jsx)
    const itemBox = await firstItem.boundingBox();
    expect(itemBox).not.toBeNull();
    expect(itemBox.height).toBeGreaterThanOrEqual(44);

    // No horizontal overflow on mobile
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // RT-19: Keyboard-only search flow (Tab, type, arrow down, Enter)
  // ---------------------------------------------------------------------------
  test('RT-19: Full keyboard-only search flow', async ({ page }) => {
    // Tab until we reach the search input
    // The hero search input has autoFocus on desktop, so it should be focused.
    // But let's verify we can also Tab to it.
    const input = page.locator(SELECTORS.tickerSearchInput).first();

    // Focus the input via Tab navigation
    await page.keyboard.press('Tab');

    // Keep tabbing until input is focused (max 10 tabs to avoid infinite loop)
    let focused = false;
    for (let i = 0; i < 10; i++) {
      const activeEl = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      );
      if (activeEl === 'ticker-search-input') {
        focused = true;
        break;
      }
      await page.keyboard.press('Tab');
    }
    expect(focused).toBe(true);

    // Type a query using keyboard
    await page.keyboard.type('AA');

    // Wait for dropdown
    const dropdown = page.locator(SELECTORS.suggestionDropdown);
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Navigate down with arrow key
    await page.keyboard.press('ArrowDown');

    // The first item should now be highlighted (aria-selected="true")
    const firstItem = page.locator(SELECTORS.suggestionItem(0));
    await expect(firstItem).toHaveAttribute('aria-selected', 'true');

    // Screen reader announcement should indicate suggestions available
    const srRegion = page.locator(SELECTORS.srAnnouncement);
    await expect(srRegion).toContainText(/suggestion/i);

    // Press Enter to select
    await page.keyboard.press('Enter');

    // Dashboard should load
    await expect(
      page.locator(SELECTORS.dashboardLayout),
    ).toBeVisible({ timeout: 10_000 });
  });
});
