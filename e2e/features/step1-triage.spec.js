// @ts-check
import { test, expect } from '@playwright/test';
import { mockAPIs } from '../helpers/mock-apis.js';

test.describe('Step 1 Triage Feature E2E (#310)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAPIs(page);
    await page.goto('');
  });

  test('displays Step 1 Triage with Business Clarity and 4 Fast Fundamentals after searching AAPL', async ({
    page,
  }) => {
    const input = page.locator('[data-testid="ticker-search-input"]').first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Step 1 Header & Stepper progress pills
    await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('10-Second Triage')).toBeVisible();
    await expect(page.getByText('1. Triage')).toBeVisible();
    await expect(page.getByText('2. Moat')).toBeVisible();

    // Section 1: Business Clarity Tear Sheet Card (defaults to Hebrew RTL, toggles to English LTR)
    await expect(page.locator('[data-testid="tear-sheet-blade"]')).toBeVisible();
    await expect(page.getByText('בהירות עסקית (מעגל הכשירות)')).toBeVisible();

    // Section 2: 4 Instant Fundamentals Checks (Hebrew default + sparkline timeline)
    await expect(page.getByText(/בדיקת נתוני בסיס מהירה/)).toBeVisible();
    await expect(page.getByText('צמיחה בהכנסות')).toBeVisible();
    await expect(page.getByText('שולי רווח תפעולי')).toBeVisible();
    await expect(page.getByText('רכישה עצמית / דילול')).toBeVisible();
    await expect(page.getByText('יחס שוטף (נזילות)')).toBeVisible();
    await expect(page.locator('[data-testid="sparkline-timeline-revenue-growth"]')).toBeVisible();

    // Toggling EN translates both Tear Sheet and Section 2 cleanly
    await page.locator('[data-testid="lang-btn-en"]').click();
    await expect(page.getByText('Instant Fundamentals Check')).toBeVisible();
    await expect(page.getByText('Revenue Growth')).toBeVisible();
    await expect(page.getByText('Operating Margins')).toBeVisible();
    await expect(page.getByText('Share Dilution')).toBeVisible();
    await expect(page.getByText('Current Ratio (Liquidity)')).toBeVisible();

    // Section 3: Gatekeeper CTA transitions to Step 2 Dashboard
    const continueBtn = page.getByRole('button', {
      name: /I understand how this company makes money - Continue/i,
    });
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    await expect(page.locator('[data-testid="company-banner"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: 'Apple Inc.' }),
    ).toBeVisible();
  });

  test('renders mobile-safe Step 1 Triage tooltips within 375px phone viewport without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const input = page.locator('[data-testid="ticker-search-input"]').first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    await expect(page.locator('[data-testid="tear-sheet-blade"]')).toBeVisible({
      timeout: 15_000,
    });

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    // Tap first Educational rationale button -> tooltip must fit inside 375px width
    const infoBtn = page.locator('button[aria-label="Educational rationale"]').first();
    await infoBtn.click();
    const openInfoTooltip = infoBtn.locator('..').locator('[role="tooltip"]');
    await expect(openInfoTooltip).toBeVisible();
    const infoBox = await openInfoTooltip.boundingBox();
    expect(infoBox).not.toBeNull();
    expect(infoBox.x).toBeGreaterThanOrEqual(0);
    expect(infoBox.x + infoBox.width).toBeLessThanOrEqual(375);

    await page.locator('button[aria-label="סגור הסבר"]').click();
    await expect(openInfoTooltip).toBeHidden();

    // Tap moat badge -> tooltip must also fit cleanly within 375px viewport
    const moatBadge = page.locator('[data-testid="moat-summary-badge"]');
    await moatBadge.click();
    const openMoatTooltip = moatBadge.locator('..').locator('[role="tooltip"]');
    await expect(openMoatTooltip).toBeVisible();
    const moatBox = await openMoatTooltip.boundingBox();
    expect(moatBox).not.toBeNull();
    expect(moatBox.x).toBeGreaterThanOrEqual(0);
    expect(moatBox.x + moatBox.width).toBeLessThanOrEqual(375);

    await page.keyboard.press('Escape');
    await expect(openMoatTooltip).toBeHidden();
  });
});
