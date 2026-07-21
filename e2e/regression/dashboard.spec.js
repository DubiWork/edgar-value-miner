// @ts-check
import { test, expect } from '@playwright/test';
import { SELECTORS } from '../helpers/selectors.js';
import { VIEWPORTS } from '../helpers/viewports.js';

// ---------------------------------------------------------------------------
// Dashboard Flow E2E Tests (RT-20 to RT-22) — REAL (no API mocks)
//
// Runs against live staging: BASE_URL=https://edgar-value-miner-staging.web.app
// All tests hit real Cloud Functions (secTickers, secCompanyFacts).
// RT-23 (loading skeleton) and RT-24 (error boundary) require induced
// conditions that cannot be created against live infra — those tests live in
// the local vitest layer: src/__tests__/loadingSkeleton.integration.test.jsx
// and src/__tests__/errorBoundary.integration.test.jsx
// ---------------------------------------------------------------------------

test.describe('Dashboard Flow', () => {
  // -----------------------------------------------------------------------
  // RT-20: Dashboard layout renders all expected panels after search
  // -----------------------------------------------------------------------
  test('RT-20: Dashboard layout renders all sections after search', async ({ page }) => {
    await page.goto('/');

    // Perform search
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard to fully render
    const dashboard = page.locator(
      `[data-testid="${SELECTORS.dashboard.layout}"]`,
    );
    await expect(dashboard).toBeVisible({ timeout: 35_000 });

    // Banner section (only renders after real Cloud Function data loads)
    const banner = page.locator(
      `[data-testid="${SELECTORS.companyBanner.root}"]`,
    );
    await expect(banner).toBeVisible({ timeout: 35_000 });
    await expect(
      page.getByRole('heading', { name: 'Apple Inc.' }),
    ).toBeVisible();

    // Ticker badge
    const tickerBadge = page.locator(
      `[data-testid="${SELECTORS.companyBanner.ticker}"]`,
    );
    await expect(tickerBadge).toHaveText('AAPL');

    // Metric cards (at least 3 expected)
    const metricCards = page.locator(
      `[data-testid="${SELECTORS.metricCard.root}"]`,
    );
    await expect(metricCards.first()).toBeVisible();
    const metricCount = await metricCards.count();
    expect(metricCount).toBeGreaterThanOrEqual(3);

    // Chart containers (at least 1 expected)
    const chartContainers = page.locator(
      `[data-testid="${SELECTORS.charts.container}"]`,
    );
    await expect(chartContainers.first()).toBeVisible();
    const chartCount = await chartContainers.count();
    expect(chartCount).toBeGreaterThanOrEqual(1);

    // Welcome state should be gone
    await expect(
      page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`),
    ).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // RT-21: Mobile layout (375px) — single column, no horizontal overflow
  // -----------------------------------------------------------------------
  test('RT-21: Mobile layout is single column with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    // Perform search
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard
    const dashboard = page.locator(
      `[data-testid="${SELECTORS.dashboard.layout}"]`,
    );
    await expect(dashboard).toBeVisible({ timeout: 35_000 });

    // All major sections should be visible (live Cloud Function latency)
    await expect(
      page.locator(`[data-testid="${SELECTORS.companyBanner.root}"]`),
    ).toBeVisible({ timeout: 35_000 });
    await expect(
      page.locator(`[data-testid="${SELECTORS.metricCard.root}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="${SELECTORS.charts.container}"]`).first(),
    ).toBeVisible();

    // No horizontal overflow: document scroll width should not exceed viewport
    const hasOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      );
    });
    expect(hasOverflow).toBe(false);
  });

  // -----------------------------------------------------------------------
  // RT-22: Tablet layout (768px) — 2-column metric cards, stacked charts
  // -----------------------------------------------------------------------
  test('RT-22: Tablet layout shows 2-column metrics and stacked charts', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/');

    // Perform search
    const input = page
      .locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`)
      .first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard
    const dashboard = page.locator(
      `[data-testid="${SELECTORS.dashboard.layout}"]`,
    );
    await expect(dashboard).toBeVisible({ timeout: 35_000 });

    // Verify metrics grid is 2-column at 768px
    // The CSS rule at 768px: grid-template-columns: repeat(2, 1fr)
    const metricsGrid = page.locator('.dashboard-layout__metrics-grid');
    await expect(metricsGrid).toBeVisible();
    const gridColumns = await metricsGrid.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue('grid-template-columns'),
    );
    // Should contain exactly 2 column values (e.g. "352px 352px")
    const columnCount = gridColumns.trim().split(/\s+/).length;
    expect(columnCount).toBe(2);

    // Charts grid should be single column at 768px (2-col only at 1024px+)
    const chartsGrid = page.locator('.dashboard-layout__charts-grid');
    const chartsGridVisible = await chartsGrid.isVisible();
    if (chartsGridVisible) {
      const chartsColumns = await chartsGrid.evaluate((el) =>
        window.getComputedStyle(el).getPropertyValue('grid-template-columns'),
      );
      const chartsColumnCount = chartsColumns.trim().split(/\s+/).length;
      expect(chartsColumnCount).toBe(1);
    }
  });
});
