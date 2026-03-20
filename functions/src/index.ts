import * as functions from 'firebase-functions';
import { secTickersHandler } from './functions/secProxy';
import { secCompanyFactsHandler } from './functions/secProxy';

/**
 * secTickers — GET proxy for https://www.sec.gov/files/company_tickers.json
 *
 * Bypasses browser CORS restriction. SEC blocks direct browser requests.
 * Adds required User-Agent header server-side.
 * Response cached 24h (SEC updates daily).
 */
export const secTickers = functions.https.onRequest(secTickersHandler);

/**
 * secCompanyFacts — GET proxy for https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
 *
 * Usage: GET /secCompanyFacts?cik=320193
 * Bypasses browser CORS restriction.
 * Adds required User-Agent header server-side.
 * Response cached 24h.
 */
export const secCompanyFacts = functions.https.onRequest(secCompanyFactsHandler);
