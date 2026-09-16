import { initializeApp } from 'firebase-admin/app';
initializeApp();

import * as functions from 'firebase-functions';
import { https } from 'firebase-functions/v2';
import { secTickersHandler } from './functions/secProxy';
import { secCompanyFactsHandler } from './functions/secProxy';
import { cacheWriterHandler, CACHE_WRITER_OPTIONS } from './functions/cacheWriter';

/**
 * secTickers — GET proxy for https://www.sec.gov/files/company_tickers.json
 */
export const secTickers = functions.https.onRequest(secTickersHandler);

/**
 * secCompanyFacts — GET proxy for https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
 *
 * Usage: GET /secCompanyFacts?cik=320193
 */
export const secCompanyFacts = functions.https.onRequest(secCompanyFactsHandler);

/**
 * cacheWriter — HTTPS callable: fetch SEC companyfacts and write to edgarCache.
 *
 * Usage: call with { ticker: 'AAPL', cik: 320193 }
 * Writes raw blob + latestFiledDate when no doc exists.
 * Returns { ticker, latestFiledDate, updated }.
 */
export const cacheWriter = https.onCall(CACHE_WRITER_OPTIONS, cacheWriterHandler);
