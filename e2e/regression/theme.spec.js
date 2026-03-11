// @ts-check
import { test, expect } from '@playwright/test';
import { mockAPIs } from '../helpers/mock-apis.js';
import { SELECTORS } from '../helpers/selectors.js';
import { VIEWPORTS } from '../helpers/viewports.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Locator for the theme toggle button via its aria-label pattern. */
function getToggle(page) {
  return page.getByRole('button', { name: /Switch to/ });
}

/**
 * Reads a CSS custom property from the document element.
 * Returns the value as a string (e.g. "rgb(15, 25, 35)").
 */
async function getCSSVar(page, varName) {
  return page.evaluate((name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, varName);
}

// ---------------------------------------------------------------------------
// RT-10 to RT-17: Theme Flow Regression Tests
// ---------------------------------------------------------------------------
test.describe('Theme Flow', () => {

  // -----------------------------------------------------------------------
  // RT-10: Fresh browser with OS dark mode -> dark theme applied, no FOUC
  // -----------------------------------------------------------------------
  test('RT-10: App respects OS dark mode preference on first load', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();

    await mockAPIs(page);

    // Collect style flashes: record any frame where data-theme is missing
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const theme = document.documentElement.getAttribute('data-theme');
        if (!theme) {
          // @ts-ignore
          window.__foucDetected = true;
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });

    await page.goto('/');
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    // Verify dark theme is applied
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Verify background color matches dark theme
    const bgColor = await getCSSVar(page, '--color-bg-primary');
    expect(bgColor).toBe('#0f1923');

    // No FOUC: data-theme should never have been absent after initial set
    const hadFouc = await page.evaluate(() => {
      // @ts-ignore
      return window.__foucDetected === true;
    });
    expect(hadFouc).toBeFalsy();

    await context.close();
  });

  // -----------------------------------------------------------------------
  // RT-11: Fresh browser with OS light mode -> light theme applied, no FOUC
  // -----------------------------------------------------------------------
  test('RT-11: App respects OS light mode preference on first load', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();

    await mockAPIs(page);

    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        const theme = document.documentElement.getAttribute('data-theme');
        if (!theme) {
          // @ts-ignore
          window.__foucDetected = true;
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });

    await page.goto('/');
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    // Verify light theme is applied
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // html should NOT have .dark class
    const classAttr = await page.locator('html').getAttribute('class') || '';
    expect(classAttr).not.toMatch(/\bdark\b/);

    // Verify background color matches light theme
    const bgColor = await getCSSVar(page, '--color-bg-primary');
    expect(bgColor).toBe('#f8fafc');

    // No FOUC
    const hadFouc = await page.evaluate(() => {
      // @ts-ignore
      return window.__foucDetected === true;
    });
    expect(hadFouc).toBeFalsy();

    await context.close();
  });

  // -----------------------------------------------------------------------
  // RT-12: In dark mode, click theme toggle -> switches to light
  // -----------------------------------------------------------------------
  test('RT-12: Theme toggle switches from dark to light', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();

    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    // Confirm starting in dark mode
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Toggle button should say "Switch to light theme"
    const toggle = getToggle(page);
    await expect(toggle).toHaveAccessibleName('Switch to light theme');

    // Click to switch to light
    await toggle.click();

    // Verify switch to light
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const classAfter = await page.locator('html').getAttribute('class') || '';
    expect(classAfter).not.toMatch(/\bdark\b/);

    // Button label should now indicate dark option
    await expect(toggle).toHaveAccessibleName('Switch to dark theme');

    // Background color should be light
    const bgColor = await getCSSVar(page, '--color-bg-primary');
    expect(bgColor).toBe('#f8fafc');

    await context.close();
  });

  // -----------------------------------------------------------------------
  // RT-13: In light mode, click theme toggle -> switches to dark
  // -----------------------------------------------------------------------
  test('RT-13: Theme toggle switches from light to dark', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();

    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    // Confirm starting in light mode
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Toggle button should say "Switch to dark theme"
    const toggle = getToggle(page);
    await expect(toggle).toHaveAccessibleName('Switch to dark theme');

    // Click to switch to dark
    await toggle.click();

    // Verify switch to dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Button label should now indicate light option
    await expect(toggle).toHaveAccessibleName('Switch to light theme');

    // Background color should be dark
    const bgColor = await getCSSVar(page, '--color-bg-primary');
    expect(bgColor).toBe('#0f1923');

    await context.close();
  });

  // -----------------------------------------------------------------------
  // RT-14: Toggle to light, reload -> light mode persisted (localStorage)
  // -----------------------------------------------------------------------
  test('RT-14: Theme preference persists across page reload via localStorage', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();

    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    // Start in dark, toggle to light
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await getToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Verify localStorage was written
    const storedTheme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(storedTheme).toBe('light');

    // Reload the page (mockAPIs routes persist across reloads within the same context)
    await page.reload();
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    // Theme should still be light after reload
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const classAfterReload = await page.locator('html').getAttribute('class') || '';
    expect(classAfterReload).not.toMatch(/\bdark\b/);

    await context.close();
  });

  // -----------------------------------------------------------------------
  // RT-15: Tab to theme toggle, press Enter -> theme switches, accessible
  // -----------------------------------------------------------------------
  test('RT-15: Theme toggle is keyboard accessible (Tab + Enter)', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();

    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    // Confirm starting in light mode
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const toggle = getToggle(page);

    // Focus the toggle via keyboard (Tab until we reach it)
    await toggle.focus();
    await expect(toggle).toBeFocused();

    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Theme should have switched to dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Verify the button has an accessible name after toggle
    await expect(toggle).toHaveAccessibleName('Switch to light theme');

    // Press Space to toggle back (Space also activates buttons)
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await context.close();
  });

  // -----------------------------------------------------------------------
  // RT-16: Mobile viewport 375px -> toggle is 44x44px, theme changes, no layout break
  // -----------------------------------------------------------------------
  test('RT-16: Mobile viewport theme toggle meets 44x44px touch target', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      viewport: VIEWPORTS.mobile,
    });
    const page = await context.newPage();

    await mockAPIs(page);
    await page.goto('/');
    await expect(page.locator(`[data-testid="${SELECTORS.app.welcomeState}"]`)).toBeVisible();

    const toggle = getToggle(page);
    await expect(toggle).toBeVisible();

    // Verify touch target size is at least 44x44px (WCAG 2.1 AA)
    const box = await toggle.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    // Toggle should work on mobile
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // No horizontal overflow (no layout break)
    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowX).toBe(false);

    // Toggle back
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Still no overflow
    const overflowXAfter = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowXAfter).toBe(false);

    await context.close();
  });

  // -----------------------------------------------------------------------
  // RT-17: Theme toggle with chart visible -> chart colors update
  // -----------------------------------------------------------------------
  test('RT-17: Chart colors update when theme changes', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();

    await mockAPIs(page);
    await page.goto('/');

    // Search for AAPL to load dashboard with charts
    const input = page.locator(`[data-testid="${SELECTORS.tickerSearch.input}"]`).first();
    await input.click();
    await input.fill('AAPL');
    await input.press('Enter');

    // Wait for dashboard to render
    await expect(
      page.locator(`[data-testid="${SELECTORS.dashboard.layout}"]`)
    ).toBeVisible({ timeout: 10_000 });

    // Verify at least one chart container is visible
    const chartContainers = page.locator(`[data-testid="${SELECTORS.charts.container}"]`);
    await expect(chartContainers.first()).toBeVisible();

    // Read chart-1 CSS variable in light mode
    const lightChart1 = await getCSSVar(page, '--chart-1');
    expect(lightChart1).toBe('#0284c7');

    // Toggle to dark
    await getToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Chart-1 CSS variable should now be the dark theme value
    const darkChart1 = await getCSSVar(page, '--chart-1');
    expect(darkChart1).toBe('#38bdf8');

    // Verify multiple chart color variables changed
    const darkChart2 = await getCSSVar(page, '--chart-2');
    expect(darkChart2).toBe('#a78bfa');

    // Toggle back to light and verify colors revert
    await getToggle(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const revertedChart1 = await getCSSVar(page, '--chart-1');
    expect(revertedChart1).toBe('#0284c7');

    await context.close();
  });
});
