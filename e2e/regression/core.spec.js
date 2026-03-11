// @ts-check
import { test, expect } from '@playwright/test';
import { mockAPIs, isIgnoredError } from '../helpers/mock-apis.js';
import { SELECTORS } from '../helpers/selectors.js';

// =============================================================================
// Core Flow E2E Tests
//
// Covers the critical app-load and initial search-to-dashboard flow (P0).
// RT-01 and RT-02 from the regression test plan.
// =============================================================================

test.describe('Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');
  });

  // ---------------------------------------------------------------------------
  // RT-01: App loads without console errors, header visible
  // ---------------------------------------------------------------------------
  test('RT-01: App loads without console errors, header visible', async ({
    page,
  }) => {
    // Collect unexpected console errors
    const unexpectedErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
        unexpectedErrors.push(msg.text());
      }
    });

    // Navigate again so the console listener is active for the full load
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Header should be visible with the app name
    await expect(page.getByText('EDGAR Value Miner')).toBeVisible();

    // Welcome state should be rendered (initial state)
    await expect(
      page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`),
    ).toBeVisible();

    // Hero heading
    await expect(
      page.getByRole('heading', { name: 'Find gems in the market' }),
    ).toBeVisible();

    // Footer
    await expect(page.getByText('Data powered by SEC EDGAR')).toBeVisible();

    // No unexpected console errors
    expect(unexpectedErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // RT-02: Type "AAPL" in search, wait for results, verify company data appears
  // ---------------------------------------------------------------------------
  test('RT-02: Search AAPL and verify company data appears on dashboard', async ({
    page,
  }) => {
    // Locate the hero search input
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await expect(input).toBeVisible();

    // Type AAPL and submit
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Dashboard should render (allow extra time for cache-layer fallthrough)
    await expect(
      page.locator(`[data-testid="${SELECTORS.dashboard.layout}"]`),
    ).toBeVisible({ timeout: 15_000 });

    // Company banner with name (wait for real data after cache-layer fallthrough)
    await expect(
      page.locator(`[data-testid="${SELECTORS.companyBanner.root}"]`),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: 'Apple Inc.' }),
    ).toBeVisible();

    // Ticker badge
    await expect(
      page.locator(`[data-testid="${SELECTORS.companyBanner.ticker}"]`),
    ).toHaveText('AAPL');

    // At least one chart container
    const charts = page.locator(
      `[data-testid="${SELECTORS.charts.container}"]`,
    );
    await expect(charts.first()).toBeVisible({ timeout: 5_000 });

    // Welcome state should no longer be visible
    await expect(
      page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`),
    ).not.toBeVisible();
  });
});
