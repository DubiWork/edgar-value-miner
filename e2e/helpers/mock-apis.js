/**
 * Shared API mocking helper for Playwright E2E tests.
 *
 * Intercepts all external SEC EDGAR and Firebase/Google requests so
 * tests run entirely against mock data with zero real network calls.
 *
 * MUST be called before `page.goto()` in every test.
 *
 * @example
 *   // Default: AAPL data, no delay
 *   await mockAPIs(page);
 *
 *   // Loading skeleton test: add 2s delay
 *   await mockAPIs(page, { delay: 2000 });
 *
 *   // Error boundary test: return 500 for company facts
 *   await mockAPIs(page, { errorOnFacts: true });
 *
 *   // Empty revenue test: override facts data
 *   await mockAPIs(page, { factsData: EMPTY_REVENUE_COMPANY_FACTS });
 */

import {
  COMPANY_TICKERS,
  AAPL_COMPANY_FACTS,
  MSFT_COMPANY_FACTS,
} from '../fixtures/mock-sec-data.js';
import { SEC_ERROR_RESPONSES } from '../fixtures/mock-error-data.js';

/**
 * @param {import('@playwright/test').Page} page
 * @param {Object} [options]
 * @param {number} [options.delay] — artificial delay in ms before responding with facts
 * @param {boolean} [options.errorOnFacts] — if true, return 500 for company facts
 * @param {Object} [options.factsData] — override the default AAPL facts payload
 */
export async function mockAPIs(page, options = {}) {
  const { delay = 0, errorOnFacts = false, factsData } = options;

  // -----------------------------------------------------------------------
  // 1. Company tickers (used by useTickerAutocomplete and edgarApi)
  //    In development, Vite proxies /api/sec-tickers to SEC, so we must
  //    intercept both the proxy path and the direct SEC URL.
  // -----------------------------------------------------------------------
  const fulfillTickers = (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(COMPANY_TICKERS),
    });

  // Direct SEC URL (production builds)
  await page.route(
    '**/www.sec.gov/files/company_tickers.json',
    fulfillTickers,
  );

  // Vite dev-server proxy path (development builds)
  await page.route('**/api/sec-tickers', fulfillTickers);

  // -----------------------------------------------------------------------
  // 2. Company facts
  //    Playwright matches routes in LIFO order (last registered wins).
  //    Register the wildcard FIRST, then specific CIK overrides AFTER
  //    so they take priority.
  // -----------------------------------------------------------------------

  // Wildcard: any unknown CIK returns 404 (registered first = lowest priority)
  await page.route(
    '**/data.sec.gov/api/xbrl/companyfacts/CIK*.json',
    (route) =>
      route.fulfill({
        status: SEC_ERROR_RESPONSES.notFound.status,
        contentType: SEC_ERROR_RESPONSES.notFound.contentType,
        body: SEC_ERROR_RESPONSES.notFound.body,
      }),
  );

  // MSFT (CIK 0000789019)
  await page.route(
    '**/data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json',
    async (route) => {
      if (errorOnFacts) {
        return route.fulfill({
          status: SEC_ERROR_RESPONSES.serverError.status,
          contentType: SEC_ERROR_RESPONSES.serverError.contentType,
          body: SEC_ERROR_RESPONSES.serverError.body,
        });
      }

      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MSFT_COMPANY_FACTS),
      });
    },
  );

  // AAPL (CIK 0000320193) — registered last = highest priority
  await page.route(
    '**/data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
    async (route) => {
      if (errorOnFacts) {
        return route.fulfill({
          status: SEC_ERROR_RESPONSES.serverError.status,
          contentType: SEC_ERROR_RESPONSES.serverError.contentType,
          body: SEC_ERROR_RESPONSES.serverError.body,
        });
      }

      const payload = factsData || AAPL_COMPANY_FACTS;

      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
    },
  );

  // -----------------------------------------------------------------------
  // 3. Block all Firebase / Firestore / Google auth requests
  // -----------------------------------------------------------------------
  await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.abort());
  await page.route('**/securetoken.googleapis.com/**', (route) => route.abort());
  await page.route('**/googleapis.com/v1/**', (route) => route.abort());
}
