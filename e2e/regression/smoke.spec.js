import { test, expect } from '@playwright/test';

test('app loads and shows main page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});

test('no console errors on load', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await page.waitForTimeout(2000);
  expect(errors).toHaveLength(0);
});

test('welcome state renders search', async ({ page }) => {
  await page.goto('/');
  const searchInput = page.getByPlaceholderText(/search|ticker|company/i);
  await expect(searchInput).toBeVisible();
});
