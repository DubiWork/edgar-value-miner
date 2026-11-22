import { initializeApp } from 'firebase-admin/app';
initializeApp();

import * as functions from 'firebase-functions';
import { https } from 'firebase-functions/v2';
import type { CallableOptions } from 'firebase-functions/v2/https';

const CACHE_WRITER_OPTIONS: CallableOptions = {
  memory: '512MiB',
  timeoutSeconds: 60,
};

const GENERATE_AI_SUMMARY_OPTIONS: CallableOptions = {
  memory: '512MiB',
  timeoutSeconds: 120,
};

/**
 * secTickers — GET proxy for https://www.sec.gov/files/company_tickers.json
 */
export const secTickers = functions.https.onRequest(async (req, res) => {
  const { secTickersHandler } = await import('./functions/secProxy');
  return secTickersHandler(req, res);
});

/**
 * secCompanyFacts — GET proxy for https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
 *
 * Usage: GET /secCompanyFacts?cik=320193
 */
export const secCompanyFacts = functions.https.onRequest(async (req, res) => {
  const { secCompanyFactsHandler } = await import('./functions/secProxy');
  return secCompanyFactsHandler(req, res);
});

/**
 * secCompanyConcept — GET proxy for https://data.sec.gov/api/xbrl/companyconcept/CIK{cik}/{namespace}/{tag}.json
 *
 * Usage: GET /secCompanyConcept?cik=1594805&namespace=us-gaap&tag=Revenues
 */
export const secCompanyConcept = functions.https.onRequest(async (req, res) => {
  const { secCompanyConceptHandler } = await import('./functions/secProxy');
  return secCompanyConceptHandler(req, res);
});

/**
 * cacheWriter — HTTPS callable: fetch SEC companyfacts and write to edgarCache.
 *
 * Usage: call with { ticker: 'AAPL', cik: 320193 }
 * Writes raw blob + latestFiledDate when no doc exists.
 * Returns { ticker, latestFiledDate, updated }.
 */
export const cacheWriter = https.onCall(CACHE_WRITER_OPTIONS, async (req) => {
  const { cacheWriterHandler } = await import('./functions/cacheWriter');
  return cacheWriterHandler(req);
});

/**
 * generateAiSummary — HTTPS callable: generate AI summary text via Vertex AI Gemini.
 *
 * Usage: call with { prompt: '...', ticker?: 'MSFT' }
 * Returns { text, ingestionStatus? }.
 */
export const generateAiSummary = https.onCall(GENERATE_AI_SUMMARY_OPTIONS, async (req) => {
  const { generateAiSummaryHandler } = await import('./functions/generateAiSummary');
  return generateAiSummaryHandler(req);
});
