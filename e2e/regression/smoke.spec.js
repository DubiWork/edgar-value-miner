import { test, expect } from '@playwright/test';
import { mockAPIs, isIgnoredError } from '../helpers/mock-apis.js';

test('app loads and shows main page', async ({ page }) => {
  await mockAPIs(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});

test('no unexpected console errors on load', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
      errors.push(msg.text());
    }
  });
  await mockAPIs(page);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  expect(errors).toHaveLength(0);
});

test('welcome state renders search', async ({ page }) => {
  await mockAPIs(page);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const searchInput = page.locator('[data-testid="ticker-search"]');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
});
