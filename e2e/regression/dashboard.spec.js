// @ts-check
import { test, expect } from '@playwright/test';
import { mockAPIs } from '../helpers/mock-apis.js';
import { SELECTORS } from '../helpers/selectors.js';
import { VIEWPORTS } from '../helpers/viewports.js';

// ---------------------------------------------------------------------------
// Dashboard Flow E2E Tests (RT-20 to RT-24)
//
// Covers dashboard layout rendering, responsive behaviour, loading skeletons,
// and error boundary display.
// ---------------------------------------------------------------------------

/** Helper: build a data-testid locator from a SELECTORS string value. */
const tid = (page, id) => page.getByTestId(id);

test.describe('Dashboard Flow', () => {
  // -----------------------------------------------------------------------
  // RT-20: Dashboard layout renders all expected panels after search
  // -----------------------------------------------------------------------
  test('RT-20: Dashboard layout renders all sections after search', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    // Perform search
    const input = tid(page, SELECTORS.tickerSearch.input).first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard to fully render
    await expect(tid(page, SELECTORS.dashboard.layout)).toBeVisible({ timeout: 10_000 });

    // Banner section
    await expect(tid(page, SELECTORS.companyBanner.root)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Apple Inc.' })).toBeVisible();

    // Ticker badge
    await expect(page.locator('[data-testid="ticker-badge"]')).toHaveText('AAPL');

    // Metric cards (at least 3 expected)
    const metricCards = tid(page, SELECTORS.metricCard.root);
    await expect(metricCards.first()).toBeVisible();
    const metricCount = await metricCards.count();
    expect(metricCount).toBeGreaterThanOrEqual(3);

    // Chart containers (at least 1 expected)
    const chartContainers = tid(page, SELECTORS.charts.container);
    await expect(chartContainers.first()).toBeVisible();
    const chartCount = await chartContainers.count();
    expect(chartCount).toBeGreaterThanOrEqual(1);

    // Welcome state should be gone
    await expect(tid(page, SELECTORS.app.welcomeState)).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // RT-21: Mobile layout (375px) -- single column, no horizontal overflow
  // -----------------------------------------------------------------------
  test('RT-21: Mobile layout is single column with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await mockAPIs(page);
    await page.goto('/');

    // Perform search
    const input = tid(page, SELECTORS.tickerSearch.input).first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard
    await expect(tid(page, SELECTORS.dashboard.layout)).toBeVisible({ timeout: 10_000 });

    // All major sections should be visible
    await expect(tid(page, SELECTORS.companyBanner.root)).toBeVisible();
    await expect(tid(page, SELECTORS.metricCard.root).first()).toBeVisible();
    await expect(tid(page, SELECTORS.charts.container).first()).toBeVisible();

    // No horizontal overflow: document scroll width should not exceed viewport
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  // -----------------------------------------------------------------------
  // RT-22: Tablet layout (768px) -- 2-column metric cards, stacked charts
  // -----------------------------------------------------------------------
  test('RT-22: Tablet layout shows 2-column metrics and stacked charts', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await mockAPIs(page);
    await page.goto('/');

    // Perform search
    const input = tid(page, SELECTORS.tickerSearch.input).first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard
    await expect(tid(page, SELECTORS.dashboard.layout)).toBeVisible({ timeout: 10_000 });

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

  // -----------------------------------------------------------------------
  // RT-23: Loading skeletons appear during data fetch
  // -----------------------------------------------------------------------
  test('RT-23: Loading skeletons appear while data is loading', async ({ page }) => {
    // Use delayed API responses to observe loading state
    await mockAPIs(page, { delay: 2000 });
    await page.goto('/');

    // Perform search
    const input = tid(page, SELECTORS.tickerSearch.input).first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Skeletons should appear while API is delayed
    const skeleton = tid(page, SELECTORS.dashboard.skeleton);
    await expect(skeleton).toBeVisible({ timeout: 5_000 });

    // Verify individual skeleton components are present
    await expect(tid(page, SELECTORS.companyBanner.skeleton)).toBeVisible();
    await expect(tid(page, SELECTORS.metricCard.skeleton).first()).toBeVisible();
    await expect(tid(page, SELECTORS.charts.containerSkeleton).first()).toBeVisible();

    // After the delay resolves, the real dashboard should replace skeletons.
    // Wait for the real company banner (only rendered when data loads) rather
    // than dashboard-layout (which also exists inside DashboardSkeleton).
    await expect(tid(page, SELECTORS.companyBanner.root)).toBeVisible({ timeout: 15_000 });
    await expect(skeleton).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // RT-24: Error boundary displays when API returns error
  // -----------------------------------------------------------------------
  test('RT-24: Error boundary displays with retry when API errors', async ({ page }) => {
    // Mock APIs to return 500 on companyfacts
    await mockAPIs(page, { errorOnFacts: true });
    await page.goto('/');

    // Perform search
    const input = tid(page, SELECTORS.tickerSearch.input).first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Error state should appear
    const errorState = tid(page, SELECTORS.app.errorState);
    await expect(errorState).toBeVisible({ timeout: 10_000 });

    // Dashboard should NOT be visible
    await expect(tid(page, SELECTORS.dashboard.layout)).not.toBeVisible();

    // A retry button should be available (btn-primary with RefreshCw icon)
    const retryButton = errorState.locator('button.btn-primary');
    await expect(retryButton).toBeVisible();

    // A "Go Home" button should also be present
    const goHomeButton = errorState.locator('button.btn-secondary');
    await expect(goHomeButton).toBeVisible();
  });
});
