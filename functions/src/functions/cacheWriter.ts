import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest, CallableOptions } from 'firebase-functions/v2/https';
import { fetchFromSec } from './secProxy.js';

export const CACHE_WRITER_OPTIONS: CallableOptions = {
  memory: '512MiB',
  timeoutSeconds: 60,
};

/**
 * Extracts the maximum filing date across all taxonomies in companyFacts.facts
 * (e.g. 'us-gaap', 'dei', 'ifrs-full', 'invest', etc.).
 */
export function extractLatestFiledDate(companyFacts: Record<string, unknown>): string | null {
  const facts = (companyFacts as any)?.facts;
  if (!facts || typeof facts !== 'object') return null;

  let max: string | null = null;
  for (const taxonomy of Object.values(facts) as any[]) {
    if (!taxonomy || typeof taxonomy !== 'object') continue;
    for (const tag of Object.values(taxonomy) as any[]) {
      if (!tag || typeof tag !== 'object') continue;
      const units = tag.units;
      if (!units || typeof units !== 'object') continue;
      for (const entries of Object.values(units) as any[]) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          const filed = entry?.filed;
          if (typeof filed === 'string' && filed) {
            if (max === null || filed > max) {
              max = filed;
            }
          }
        }
      }
    }
  }
  return max;
}

const COLLECTION = 'edgarCache';

export type PaddedCik = string;

export interface CacheWriterData {
  ticker: string;
}

export interface CacheWriterResult {
  ticker: string;
  latestFiledDate: string | null;
  updated: boolean;
}

export const STALENESS_DAYS = 90;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Firestore document hard limit is 1 MB; reject blobs approaching it
export const MAX_BLOB_BYTES = 900_000;

/**
 * In-memory cache for the SEC company tickers directory.
 *
 * Caching strategy:
 * Fetching company_tickers.json on every invocation of cacheWriter would add ~200-500ms
 * network latency and risk exhausting the SEC rate limit (10 req/sec max).
 * Since company ticker-to-CIK mappings change infrequently, we cache the parsed Map
 * in memory for 24 hours (matching CACHE_DURATION_SECONDS in secProxy.ts).
 */
interface TickersCache {
  map: Map<string, number>;
  timestamp: number;
}

let memoryTickersCache: TickersCache | null = null;
const TICKERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function clearTickersCacheForTesting(): void {
  memoryTickersCache = null;
}

async function resolveCikFromTicker(ticker: string): Promise<number> {
  const now = Date.now();
  if (!memoryTickersCache || now - memoryTickersCache.timestamp > TICKERS_CACHE_TTL_MS) {
    const rawData = (await fetchFromSec('tickers')) as Record<string, any>;
    const map = new Map<string, number>();
    if (rawData && typeof rawData === 'object') {
      for (const entry of Object.values(rawData)) {
        if (
          entry &&
          typeof entry === 'object' &&
          entry.ticker &&
          (entry.cik_str !== undefined || entry.cik !== undefined)
        ) {
          const t = String(entry.ticker).trim().toUpperCase();
          const cikNum = Number(entry.cik_str ?? entry.cik);
          if (Number.isInteger(cikNum) && cikNum >= 0) {
            map.set(t, cikNum);
          }
        }
      }
    }
    memoryTickersCache = { map, timestamp: now };
  }

  const cik = memoryTickersCache.map.get(ticker);
  if (cik === undefined) {
    throw new HttpsError('not-found', `Ticker '${ticker}' not found in SEC company directory.`);
  }
  return cik;
}

function assertBlobSize(companyFacts: Record<string, unknown>): void {
  const blobBytes = Buffer.byteLength(JSON.stringify(companyFacts), 'utf8');
  if (blobBytes > MAX_BLOB_BYTES) {
    throw new HttpsError(
      'resource-exhausted',
      `companyFacts blob too large for Firestore (${blobBytes} bytes)`
    );
  }
}

function isStale(lastUpdated: Timestamp | null): boolean {
  if (!lastUpdated) return true;
  const ageMs = Math.max(0, Date.now() - lastUpdated.toDate().getTime());
  return ageMs > STALENESS_DAYS * MS_PER_DAY;
}

function buildDocPayload(
  ticker: string,
  paddedCik: PaddedCik,
  companyName: string,
  companyFacts: Record<string, unknown>,
  latestFiledDate: string | null,
  accessCount = 0
) {
  assertBlobSize(companyFacts);
  return {
    ticker,
    cik: paddedCik,
    companyName,
    companyFacts,
    latestFiledDate,
    rawVersion: 1,
    version: 1,
    lastUpdated: FieldValue.serverTimestamp(),
    needsRefresh: false,
    accessCount,
  };
}

export async function cacheWriterHandler(
  req: CallableRequest<CacheWriterData>
): Promise<CacheWriterResult> {
  const data = req.data;

  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Request data is required');
  }
  if (!data.ticker || typeof data.ticker !== 'string' || !data.ticker.trim()) {
    throw new HttpsError('invalid-argument', 'ticker is required and must be a non-empty string');
  }

  const ticker = data.ticker.trim().toUpperCase();

  const db = getFirestore();
  const docRef = db.collection(COLLECTION).doc(ticker);
  const snap = await docRef.get();

  // Tier 1 staleness check: if doc exists and is fresh (< 90 days), return immediately without calling SEC
  if (snap.exists) {
    const docData = snap.data() ?? {};
    const storedLastUpdated = docData.lastUpdated instanceof Timestamp ? docData.lastUpdated : null;
    const storedLatestFiledDate = typeof docData.latestFiledDate === 'string' ? docData.latestFiledDate : null;

    if (!isStale(storedLastUpdated)) {
      return { ticker, latestFiledDate: storedLatestFiledDate, updated: false };
    }
  }

  // Resolve CIK internally from SEC tickers directory
  const cik = await resolveCikFromTicker(ticker);
  const paddedCik: PaddedCik = String(cik).padStart(10, '0');

  // Tier 2 staleness check: doc missing or older than 90 days -> fetch from SEC
  let companyFacts: Record<string, unknown>;
  try {
    companyFacts = (await fetchFromSec('companyFacts', cik)) as Record<string, unknown>;
  } catch (err) {
    const msg = (err as Error)?.message || '';
    if (msg.includes('status 404')) {
      throw new HttpsError('not-found', `Company with CIK ${paddedCik} not found in SEC database.`);
    }
    throw err;
  }

  const newLatestFiledDate = extractLatestFiledDate(companyFacts);
  const companyName =
    typeof (companyFacts as any)?.entityName === 'string' && (companyFacts as any).entityName.trim()
      ? (companyFacts as any).entityName.trim()
      : ticker;

  if (snap.exists) {
    const docData = snap.data() ?? {};
    const storedLatestFiledDate = typeof docData.latestFiledDate === 'string' ? docData.latestFiledDate : null;

    // Check if new SEC data has a newer filing date
    const isNewer =
      storedLatestFiledDate === null
        ? newLatestFiledDate !== null
        : newLatestFiledDate !== null && newLatestFiledDate > storedLatestFiledDate;

    if (!isNewer) {
      // Document exists and latestFiledDate matches or is not newer: update lastUpdated timestamp only
      await docRef.update({ lastUpdated: FieldValue.serverTimestamp() });
      return { ticker, latestFiledDate: storedLatestFiledDate, updated: false };
    }

    // Document exists but new filing arrived: overwrite full document
    const accessCount = typeof docData.accessCount === 'number' ? docData.accessCount : 0;
    await docRef.set(
      buildDocPayload(ticker, paddedCik, companyName, companyFacts, newLatestFiledDate, accessCount)
    );

    return { ticker, latestFiledDate: newLatestFiledDate, updated: true };
  }

  // Document does not exist: fresh fetch
  await docRef.set(
    buildDocPayload(ticker, paddedCik, companyName, companyFacts, newLatestFiledDate, 0)
  );

  return { ticker, latestFiledDate: newLatestFiledDate, updated: true };
}
