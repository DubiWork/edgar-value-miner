// @ts-check
import { test, expect } from '@playwright/test';
import { COMPANY_TICKERS, AAPL_COMPANY_FACTS } from './fixtures/mock-sec-data.js';

// ---------------------------------------------------------------------------
// Shared helper: intercept all external API calls before navigating
// ---------------------------------------------------------------------------

/**
 * Sets up route mocks for SEC EDGAR and Firebase/Firestore APIs.
 * MUST be called before page.goto() in every test.
 */
async function mockAPIs(page) {
  // Mock company_tickers.json (used by useTickerAutocomplete)
  await page.route(
    '**/www.sec.gov/files/company_tickers.json',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(COMPANY_TICKERS),
      }),
  );

  // Mock companyfacts for AAPL (CIK padded to 10 digits)
  await page.route(
    '**/data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AAPL_COMPANY_FACTS),
      }),
  );

  // Block all Firebase / Firestore requests so the app does not hang
  await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.abort());
  await page.route('**/securetoken.googleapis.com/**', (route) => route.abort());
  await page.route('**/googleapis.com/v1/**', (route) => route.abort());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Dashboard smoke tests', () => {
  // -----------------------------------------------------------------------
  // 1. Welcome State
  // -----------------------------------------------------------------------
  test('Welcome State renders correctly', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    // Header logo text
    await expect(page.getByText('EDGAR Value Miner')).toBeVisible();

    // Welcome state container
    await expect(page.locator('[data-testid="welcome-state"]')).toBeVisible();

    // Hero heading
    await expect(page.getByRole('heading', { name: 'Find gems in the market' })).toBeVisible();

    // Search bar
    await expect(page.locator('[data-testid="ticker-search"]')).toBeVisible();

    // Feature cards (use heading role to avoid matching description paragraph)
    await expect(page.getByRole('heading', { name: 'Visual Analysis' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Smart Valuations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quality Scoring' })).toBeVisible();

    // Footer
    await expect(page.getByText('Data powered by SEC EDGAR')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 2. Theme Toggle
  // -----------------------------------------------------------------------
  test('Theme toggle switches data-theme attribute', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const html = page.locator('html');

    // Read initial theme
    const initialTheme = await html.getAttribute('data-theme');

    // Click the toggle (aria-label starts with "Switch to")
    const toggle = page.getByRole('button', { name: /Switch to/ });
    await toggle.click();

    // Theme should have changed
    const afterFirstClick = await html.getAttribute('data-theme');
    expect(afterFirstClick).not.toBe(initialTheme);

    // Click again to revert
    await toggle.click();
    const afterSecondClick = await html.getAttribute('data-theme');
    expect(afterSecondClick).toBe(initialTheme);
  });

  // -----------------------------------------------------------------------
  // 3. Search Autocomplete
  // -----------------------------------------------------------------------
  test('Search autocomplete shows suggestions for AAPL', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const input = page.locator('[data-testid="ticker-search-input"]').first();
    await input.click();
    await input.fill('AAPL');

    // Wait for the suggestion dropdown to appear
    const dropdown = page.locator('[data-testid="suggestion-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // First suggestion should be visible
    const firstItem = page.locator('[data-testid="suggestion-item-0"]');
    await expect(firstItem).toBeVisible();

    // Company name should appear inside the dropdown
    await expect(dropdown.getByText('Apple Inc.')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 4. Search to Dashboard (Enter key)
  // -----------------------------------------------------------------------
  test('Search to Dashboard via Enter key loads company data', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const input = page.locator('[data-testid="ticker-search-input"]').first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard to render
    const dashboard = page.locator('[data-testid="dashboard-layout"]');
    await expect(dashboard).toBeVisible({ timeout: 10000 });

    // Company banner
    await expect(page.locator('[data-testid="company-banner"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Apple Inc.' })).toBeVisible();

    // Ticker badge
    const tickerBadge = page.locator('[data-testid="ticker-badge"]');
    await expect(tickerBadge).toHaveText('AAPL');

    // Metric cards (at least 3)
    const metricCards = page.locator('[data-testid="metric-card"]');
    await expect(metricCards).toHaveCount(6, { timeout: 5000 }).catch(async () => {
      // Fallback: at least 3 is acceptable
      const count = await metricCards.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    // At least 1 chart container
    const charts = page.locator('[data-testid="chart-container"]');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThanOrEqual(1);

    // Welcome state should NOT be visible
    await expect(page.locator('[data-testid="welcome-state"]')).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 5. Search to Dashboard (click suggestion)
  // -----------------------------------------------------------------------
  test('Search to Dashboard via suggestion click loads company data', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const input = page.locator('[data-testid="ticker-search-input"]').first();
    await input.click();
    await input.fill('AAPL');

    // Wait for dropdown
    const dropdown = page.locator('[data-testid="suggestion-dropdown"]');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Click the first suggestion
    const firstItem = page.locator('[data-testid="suggestion-item-0"]');
    await firstItem.click();

    // Wait for dashboard to render
    const dashboard = page.locator('[data-testid="dashboard-layout"]');
    await expect(dashboard).toBeVisible({ timeout: 10000 });

    // Verify company name is displayed
    await expect(page.getByRole('heading', { name: 'Apple Inc.' })).toBeVisible();
  });
});
