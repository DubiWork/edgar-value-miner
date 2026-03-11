// @ts-check
import { test, expect } from '@playwright/test';
import { mockAPIs } from '../helpers/mock-apis.js';
import { SELECTORS } from '../helpers/selectors.js';
import { VIEWPORTS } from '../helpers/viewports.js';

// ---------------------------------------------------------------------------
// Responsive Flow E2E Tests (RT-30, RT-31, RT-32)
//
// Verifies that the app layout adapts correctly across mobile, tablet, and
// desktop viewports. Tests target the welcome state (no search performed)
// and assert actual layout dimensions/positions rather than CSS classes.
// ---------------------------------------------------------------------------

test.describe('Responsive layout', () => {
  // -----------------------------------------------------------------------
  // RT-30: Mobile viewport (375px) — single-column, no horizontal overflow
  // -----------------------------------------------------------------------
  test('RT-30: Mobile viewport (375px) — single-column layout, stacked components', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await mockAPIs(page);
    await page.goto('/');

    // Wait for the welcome state to be fully rendered
    const welcomeState = page.locator(
      `[data-testid="${SELECTORS.app.welcomeState}"]`,
    );
    await expect(welcomeState).toBeVisible();

    // -- No horizontal overflow --
    const hasNoOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(hasNoOverflow).toBe(true);

    // -- Key layout elements visible --
    await expect(page.getByText('EDGAR Value Miner')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Find gems in the market' }),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="${SELECTORS.tickerSearch.root}"]`),
    ).toBeVisible();
    await expect(page.getByText('Data powered by SEC EDGAR')).toBeVisible();

    // -- Feature cards are stacked vertically (single column) --
    // At 375px the grid has no md: breakpoint, so all cards share similar x
    const featureCards = page.locator(
      `[data-testid="${SELECTORS.app.welcomeState}"] .card`,
    );
    await expect(featureCards.first()).toBeVisible();
    const cardCount = await featureCards.count();
    expect(cardCount).toBe(3);

    // Verify single-column: all cards have similar left (x) positions
    // and each subsequent card has a greater top (y) position
    const boxes = [];
    for (let i = 0; i < cardCount; i++) {
      const box = await featureCards.nth(i).boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box);
    }

    // All cards should share approximately the same x position (tolerance 5px)
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].x - boxes[0].x)).toBeLessThan(5);
    }

    // Each card should be below the previous one (stacked vertically)
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
    }
  });

  // -----------------------------------------------------------------------
  // RT-31: Tablet viewport (768px) — multi-column grid, navigation visible
  // -----------------------------------------------------------------------
  test('RT-31: Tablet viewport (768px) — appropriate grid layout, visible navigation', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await mockAPIs(page);
    await page.goto('/');

    // Wait for the welcome state to be fully rendered
    const welcomeState = page.locator(
      `[data-testid="${SELECTORS.app.welcomeState}"]`,
    );
    await expect(welcomeState).toBeVisible();

    // -- No horizontal overflow --
    const hasNoOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(hasNoOverflow).toBe(true);

    // -- Key layout elements visible --
    await expect(page.getByText('EDGAR Value Miner')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Find gems in the market' }),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="${SELECTORS.tickerSearch.root}"]`),
    ).toBeVisible();
    await expect(page.getByText('Data powered by SEC EDGAR')).toBeVisible();

    // -- Navigation / header elements visible --
    // ThemeToggle uses aria-label, not data-testid
    await expect(
      page.getByRole('button', { name: /Switch to/ }),
    ).toBeVisible();

    // -- Feature cards in multi-column layout (md:grid-cols-3 at 768px) --
    const featureCards = page.locator(
      `[data-testid="${SELECTORS.app.welcomeState}"] .card`,
    );
    await expect(featureCards.first()).toBeVisible();
    const cardCount = await featureCards.count();
    expect(cardCount).toBe(3);

    const boxes = [];
    for (let i = 0; i < cardCount; i++) {
      const box = await featureCards.nth(i).boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box);
    }

    // At 768px the md:grid-cols-3 breakpoint activates.
    // Cards should be arranged in columns (different x positions).
    // Verify at least two cards have different x positions (multi-column).
    const uniqueXPositions = new Set(
      boxes.map((box) => Math.round(box.x)),
    );
    expect(uniqueXPositions.size).toBeGreaterThanOrEqual(2);
  });

  // -----------------------------------------------------------------------
  // RT-32: Desktop viewport (1280px) — full multi-column dashboard layout
  // -----------------------------------------------------------------------
  test('RT-32: Desktop viewport (1280px) — full desktop layout', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await mockAPIs(page);
    await page.goto('/');

    // Wait for the welcome state to be fully rendered
    const welcomeState = page.locator(
      `[data-testid="${SELECTORS.app.welcomeState}"]`,
    );
    await expect(welcomeState).toBeVisible();

    // -- No horizontal overflow --
    const hasNoOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(hasNoOverflow).toBe(true);

    // -- All key layout elements visible --
    await expect(page.getByText('EDGAR Value Miner')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Find gems in the market' }),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="${SELECTORS.tickerSearch.root}"]`),
    ).toBeVisible();
    // ThemeToggle uses aria-label, not data-testid
    await expect(
      page.getByRole('button', { name: /Switch to/ }),
    ).toBeVisible();
    await expect(page.getByText('Data powered by SEC EDGAR')).toBeVisible();

    // -- Feature cards in full 3-column layout --
    const featureCards = page.locator(
      `[data-testid="${SELECTORS.app.welcomeState}"] .card`,
    );
    await expect(featureCards.first()).toBeVisible();
    const cardCount = await featureCards.count();
    expect(cardCount).toBe(3);

    const boxes = [];
    for (let i = 0; i < cardCount; i++) {
      const box = await featureCards.nth(i).boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box);
    }

    // All 3 cards on the same row (similar y positions, tolerance 5px)
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].y - boxes[0].y)).toBeLessThan(5);
    }

    // All 3 cards have distinct x positions (3 separate columns)
    const uniqueXPositions = new Set(
      boxes.map((box) => Math.round(box.x)),
    );
    expect(uniqueXPositions.size).toBe(3);

    // -- Desktop utilizes available width --
    // The content area should use a reasonable portion of the viewport
    const welcomeBox = await welcomeState.boundingBox();
    expect(welcomeBox).not.toBeNull();
    expect(welcomeBox.width).toBeGreaterThan(VIEWPORTS.desktop.width * 0.5);
  });
});
