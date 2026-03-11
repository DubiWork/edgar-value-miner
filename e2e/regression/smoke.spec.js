import { test, expect } from '@playwright/test';

// Known non-critical console errors to ignore on deployed environments
const IGNORED_ERRORS = [
  'Firebase',
  'firestore',
  'googleapis',
  'Failed to load resource',
  'net::ERR',
  'ChunkLoadError',
  'Loading chunk',
  'dynamically imported module',
  // SEC.gov does not serve CORS headers — browser blocks the request,
  // but the app handles this gracefully via try/catch fallback.
  'sec.gov',
  'CORS',
  'Cross-Origin',
];

function isIgnoredError(text) {
  return IGNORED_ERRORS.some(pattern => text.includes(pattern));
}

test('app loads and shows main page', async ({ page }) => {
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
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toHaveLength(0);
});

test('welcome state renders search', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const searchInput = page.locator('[data-testid="ticker-search"]');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
});
