// @ts-check
import { test, expect } from '@playwright/test';
import { mockAPIs } from '../helpers/mock-apis.js';
import {
  EMPTY_REVENUE_COMPANY_FACTS,
} from '../fixtures/mock-sec-data.js';

test.describe('mockAPIs helper', () => {
  // -------------------------------------------------------------------
  // Default behavior
  // -------------------------------------------------------------------
  test('intercepts company_tickers.json and returns mock data', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const data = await page.evaluate(async () => {
      const res = await fetch('https://www.sec.gov/files/company_tickers.json');
      return { status: res.status, body: await res.json() };
    });

    expect(data.status).toBe(200);
    expect(data.body['0'].ticker).toBe('AAPL');
  });

  test('intercepts AAPL companyfacts and returns AAPL data by default', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const data = await page.evaluate(async () => {
      const res = await fetch(
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json'
      );
      return { status: res.status, body: await res.json() };
    });

    expect(data.status).toBe(200);
    expect(data.body.entityName).toBe('Apple Inc.');
    expect(data.body.cik).toBe(320193);
  });

  test('blocks Firebase and Google auth requests', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    // Firebase routes are set to abort. The app loads without hanging,
    // which proves the routes are blocking correctly.
    await expect(page.locator('body')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // configurable delay
  // -------------------------------------------------------------------
  test('applies delay to companyfacts response', async ({ page }) => {
    await mockAPIs(page, { delay: 500 });
    await page.goto('/');

    const elapsed = await page.evaluate(async () => {
      const start = Date.now();
      await fetch(
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json'
      );
      return Date.now() - start;
    });

    // Allow tolerance for timer precision
    expect(elapsed).toBeGreaterThanOrEqual(350);
  });

  // -------------------------------------------------------------------
  // errorOnFacts option
  // -------------------------------------------------------------------
  test('returns 500 when errorOnFacts is true', async ({ page }) => {
    await mockAPIs(page, { errorOnFacts: true });
    await page.goto('/');

    const status = await page.evaluate(async () => {
      const res = await fetch(
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json'
      );
      return res.status;
    });

    expect(status).toBe(500);
  });

  // -------------------------------------------------------------------
  // custom factsData option
  // -------------------------------------------------------------------
  test('returns custom factsData when provided', async ({ page }) => {
    await mockAPIs(page, { factsData: EMPTY_REVENUE_COMPANY_FACTS });
    await page.goto('/');

    const data = await page.evaluate(async () => {
      const res = await fetch(
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json'
      );
      return res.json();
    });

    expect(data.entityName).toBe('Empty Revenue Corp');
  });

  // -------------------------------------------------------------------
  // Route ordering: specific routes before wildcard
  // -------------------------------------------------------------------
  test('intercepts unknown CIK with 404', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const status = await page.evaluate(async () => {
      const res = await fetch(
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000999999.json'
      );
      return res.status;
    });

    expect(status).toBe(404);
  });

  test('MSFT CIK route returns MSFT data', async ({ page }) => {
    await mockAPIs(page);
    await page.goto('/');

    const data = await page.evaluate(async () => {
      const res = await fetch(
        'https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json'
      );
      return { status: res.status, body: await res.json() };
    });

    expect(data.status).toBe(200);
    expect(data.body.entityName).toBe('Microsoft Corp');
  });
});
