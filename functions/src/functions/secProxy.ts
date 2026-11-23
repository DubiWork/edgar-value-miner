import * as functions from 'firebase-functions';
import { getApps } from 'firebase-admin/app';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as zlib from 'zlib';
import type { Request, Response } from 'express';

const DEFAULT_SEC_USER_AGENT = 'EdgarValueMiner/1.2 (dubigreenfeld@gmail.com)';
const DEFAULT_RETRY_DELAYS_MS = [400, 1000];
const MAX_RETRY_AFTER_MS = 3000;

const CACHE_DURATION_SECONDS = 24 * 60 * 60; // 24 hours
const FRESH_TICKERS_TTL_MS = CACHE_DURATION_SECONDS * 1000;
const FALLBACK_TICKERS_TTL_MS = 15 * 60 * 1000; // 15 minutes when serving stale/snapshot fallback
const FIRESTORE_TICKERS_COLLECTION = 'systemCache';
const FIRESTORE_TICKERS_DOC_ID = 'secTickers';
const BUNDLED_SNAPSHOT_PATH = path.resolve(__dirname, '..', 'data', 'sec-tickers-snapshot.json.gz');

export type SecTickerWireEntry = {
  cik_str: number | string;
  ticker: string;
  title: string;
};

export type SecTickersWireMap = Record<string, SecTickerWireEntry>;
export type CompactTickerTuple = [number, string, string];
export type TickersSource =
  | 'memory'
  | 'firestore'
  | 'sec-live'
  | 'memory-stale'
  | 'firestore-stale'
  | 'bundled-snapshot';

interface HttpStatusError extends Error {
  statusCode?: number;
  retryAfterHeader?: string | string[];
}

interface MemoryTickersState {
  data: SecTickersWireMap;
  expiresAtMs: number;
}

let memoryTickersCache: MemoryTickersState | null = null;
let inFlightTickersPromise: Promise<{ data: SecTickersWireMap; source: TickersSource }> | null = null;
let bundledSnapshotEnabled = true;
let activeRetryDelaysMs: number[] = [...DEFAULT_RETRY_DELAYS_MS];

/**
 * Resets the in-memory tickers directory cache (for deterministic unit tests).
 */
export function clearTickersCacheForTesting(): void {
  memoryTickersCache = null;
  inFlightTickersPromise = null;
}

/**
 * Enables or disables loading the bundled SEC snapshot fallback (for testing 502 paths).
 */
export function setBundledSnapshotEnabledForTesting(enabled: boolean): void {
  bundledSnapshotEnabled = enabled;
}

/**
 * Overrides bounded 429/503 retry backoff delays (pass [] in unit tests that stub single errors).
 */
export function setRetryDelaysForTesting(delays: number[] | null): void {
  activeRetryDelaysMs = delays ? [...delays] : [...DEFAULT_RETRY_DELAYS_MS];
}

function getSecUserAgent(): string {
  return process.env.SEC_USER_AGENT || DEFAULT_SEC_USER_AGENT;
}

/**
 * Fully server-controlled SEC endpoint URLs. The only variable part — the CIK —
 * is a plain integer re-derived by the server (never a user-supplied string),
 * so no user input flows into the request URL (CodeQL js/request-forgery, #215).
 */
const SEC_ENDPOINTS = {
  tickers: () => 'https://www.sec.gov/files/company_tickers.json',
  companyFacts: (cik: number) =>
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`,
  companyConcept: (cik: number, namespace: string, tag: string) =>
    `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(cik).padStart(10, '0')}/${namespace}/${tag}.json`,
} as const;

const VALID_NAMESPACE_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_TAG_REGEX = /^[a-zA-Z0-9_]+$/;

function parseRetryAfterMs(headerVal?: string | string[], maxDelayMs = MAX_RETRY_AFTER_MS): number | null {
  const firstVal = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (typeof firstVal !== 'string') return null;
  const raw = firstVal.trim();
  if (!raw) return null;

  if (/^\d{1,5}$/.test(raw)) {
    return Math.min(maxDelayMs, Math.max(0, Number(raw) * 1000));
  }
  const parsedMs = Date.parse(raw);
  if (Number.isFinite(parsedMs)) {
    return Math.min(maxDelayMs, Math.max(0, parsedMs - Date.now()));
  }
  return null;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGetJsonOnce(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': getSecUserAgent(),
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      timeout: 25_000,
    };

    const req = https.get(url, options, (res) => {
      const { statusCode, headers: resHeaders } = res;

      if (statusCode !== 200) {
        res.resume();
        const err: HttpStatusError = new Error(`SEC API returned status ${statusCode} for ${url}`);
        err.statusCode = statusCode;
        if (resHeaders['retry-after'] !== undefined) {
          err.retryAfterHeader = resHeaders['retry-after'];
        }
        return reject(err);
      }

      const encoding = resHeaders['content-encoding'];
      let stream: NodeJS.ReadableStream = res;

      if (encoding === 'gzip') {
        const gunzip = zlib.createGunzip();
        res.pipe(gunzip);
        stream = gunzip;
      } else if (encoding === 'deflate') {
        const inflate = zlib.createInflate();
        res.pipe(inflate);
        stream = inflate;
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Failed to parse SEC JSON response from ${url}: ${(err as Error).message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Performs the actual HTTPS GET to a server-constructed SEC URL, handling GZip
 * and bounded retries on transient SEC HTTP 429 / 503 rate limits.
 * `url` here is always built from SEC_ENDPOINTS (constant host + integer CIK),
 * never from a user-supplied string.
 */
async function httpsGetJson(url: string): Promise<unknown> {
  const maxRetries = activeRetryDelaysMs.length;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await httpsGetJsonOnce(url);
    } catch (err) {
      lastError = err;
      const statusErr = err as HttpStatusError;
      const isRetryable = statusErr?.statusCode === 429 || statusErr?.statusCode === 503;

      if (!isRetryable || attempt >= maxRetries) {
        throw err;
      }

      const retryAfter = parseRetryAfterMs(statusErr.retryAfterHeader);
      const delayMs = retryAfter !== null ? retryAfter : activeRetryDelaysMs[attempt];
      if (delayMs > 0) {
        await sleepMs(delayMs);
      }
    }
  }

  throw lastError;
}

function expandCompactTickers(compact: CompactTickerTuple[]): SecTickersWireMap {
  const wire: SecTickersWireMap = {};
  for (let i = 0; i < compact.length; i++) {
    const tuple = compact[i];
    if (!Array.isArray(tuple) || tuple.length < 3) continue;
    wire[String(i)] = {
      cik_str: tuple[0],
      ticker: tuple[1],
      title: tuple[2],
    };
  }
  return wire;
}

function compressWireTickers(data: SecTickersWireMap): CompactTickerTuple[] {
  const compact: CompactTickerTuple[] = [];
  for (const entry of Object.values(data)) {
    if (!entry || typeof entry !== 'object' || !entry.ticker) continue;
    const cik = Number(entry.cik_str);
    if (!Number.isInteger(cik) || cik < 0) continue;
    compact.push([cik, String(entry.ticker).trim().toUpperCase(), String(entry.title || '').trim()]);
  }
  return compact;
}

function logWarn(message: string, meta?: Record<string, unknown>): void {
  const fn = functions.logger?.warn ?? functions.logger?.info;
  if (typeof fn === 'function') {
    fn(message, meta);
  }
}

function loadBundledTickersSnapshot(): SecTickersWireMap | null {
  if (!bundledSnapshotEnabled) return null;
  try {
    if (!fs.existsSync(BUNDLED_SNAPSHOT_PATH)) return null;
    const gzBuffer = fs.readFileSync(BUNDLED_SNAPSHOT_PATH);
    const compact = JSON.parse(zlib.gunzipSync(gzBuffer).toString('utf-8')) as CompactTickerTuple[];
    if (!Array.isArray(compact) || compact.length === 0) return null;
    return expandCompactTickers(compact);
  } catch (err) {
    logWarn('Failed to load bundled SEC tickers snapshot', {
      message: (err as Error)?.message,
    });
    return null;
  }
}

async function readTickersFromFirestore(): Promise<{
  fresh: SecTickersWireMap | null;
  stale: SecTickersWireMap | null;
}> {
  if (getApps().length === 0) {
    return { fresh: null, stale: null };
  }
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const snap = await getFirestore()
      .collection(FIRESTORE_TICKERS_COLLECTION)
      .doc(FIRESTORE_TICKERS_DOC_ID)
      .get();

    if (!snap.exists) {
      return { fresh: null, stale: null };
    }

    const doc = snap.data() as {
      gzipBase64?: string;
      updatedAtMs?: number;
      updatedAt?: { toMillis?: () => number };
    } | undefined;

    if (!doc?.gzipBase64 || typeof doc.gzipBase64 !== 'string') {
      return { fresh: null, stale: null };
    }

    const compact = JSON.parse(
      zlib.gunzipSync(Buffer.from(doc.gzipBase64, 'base64')).toString('utf-8')
    ) as CompactTickerTuple[];

    if (!Array.isArray(compact) || compact.length === 0) {
      return { fresh: null, stale: null };
    }

    const wire = expandCompactTickers(compact);
    const updatedAtMs =
      typeof doc.updatedAtMs === 'number'
        ? doc.updatedAtMs
        : typeof doc.updatedAt?.toMillis === 'function'
          ? doc.updatedAt.toMillis()
          : 0;

    if (updatedAtMs > 0 && Date.now() - updatedAtMs < FRESH_TICKERS_TTL_MS) {
      return { fresh: wire, stale: null };
    }
    return { fresh: null, stale: wire };
  } catch (err) {
    logWarn('Failed to read SEC tickers cache from Firestore', {
      message: (err as Error)?.message,
    });
    return { fresh: null, stale: null };
  }
}

async function persistTickersToFirestore(data: SecTickersWireMap): Promise<void> {
  if (getApps().length === 0) return;
  try {
    const compact = compressWireTickers(data);
    if (compact.length === 0) return;
    const gzipBase64 = zlib.gzipSync(Buffer.from(JSON.stringify(compact), 'utf-8')).toString('base64');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    await getFirestore()
      .collection(FIRESTORE_TICKERS_COLLECTION)
      .doc(FIRESTORE_TICKERS_DOC_ID)
      .set({
        gzipBase64,
        entryCount: compact.length,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    logWarn('Failed to persist SEC tickers cache to Firestore', {
      message: (err as Error)?.message,
    });
  }
}

/**
 * Loads the SEC company tickers directory using a 4-tier resilient chain:
 * 1. Fresh in-memory cache (24h TTL) + in-flight request deduplication
 * 2. Firestore shared persistent cache (`systemCache/secTickers`, < 24h)
 * 3. Live SEC EDGAR `company_tickers.json` (with 429/503 retries) + Firestore persistence
 * 4. Graceful stale/snapshot fallbacks (`memory-stale` -> `firestore-stale` -> `bundled-snapshot`)
 */
export async function getSecTickersWithSource(): Promise<{
  data: SecTickersWireMap;
  source: TickersSource;
}> {
  const now = Date.now();
  if (memoryTickersCache && now < memoryTickersCache.expiresAtMs) {
    return { data: memoryTickersCache.data, source: 'memory' };
  }

  if (inFlightTickersPromise) {
    return inFlightTickersPromise;
  }

  const runLoad = async (): Promise<{ data: SecTickersWireMap; source: TickersSource }> => {
    let staleFirestoreData: SecTickersWireMap | null = null;

    if (getApps().length > 0) {
      const firestoreResult = await readTickersFromFirestore();
      if (firestoreResult.fresh) {
        memoryTickersCache = {
          data: firestoreResult.fresh,
          expiresAtMs: Date.now() + FRESH_TICKERS_TTL_MS,
        };
        return { data: firestoreResult.fresh, source: 'firestore' };
      }
      staleFirestoreData = firestoreResult.stale;
    }

    try {
      const liveData = (await httpsGetJson(SEC_ENDPOINTS.tickers())) as SecTickersWireMap;
      memoryTickersCache = {
        data: liveData,
        expiresAtMs: Date.now() + FRESH_TICKERS_TTL_MS,
      };
      await persistTickersToFirestore(liveData);
      return { data: liveData, source: 'sec-live' };
    } catch (liveErr) {
      if (memoryTickersCache?.data) {
        memoryTickersCache = {
          data: memoryTickersCache.data,
          expiresAtMs: Date.now() + FALLBACK_TICKERS_TTL_MS,
        };
        return { data: memoryTickersCache.data, source: 'memory-stale' };
      }

      if (staleFirestoreData) {
        memoryTickersCache = {
          data: staleFirestoreData,
          expiresAtMs: Date.now() + FALLBACK_TICKERS_TTL_MS,
        };
        return { data: staleFirestoreData, source: 'firestore-stale' };
      }

      const snapshot = loadBundledTickersSnapshot();
      if (snapshot) {
        logWarn('Serving bundled SEC tickers snapshot fallback', {
          reason: (liveErr as Error)?.message,
        });
        memoryTickersCache = {
          data: snapshot,
          expiresAtMs: Date.now() + FALLBACK_TICKERS_TTL_MS,
        };
        return { data: snapshot, source: 'bundled-snapshot' };
      }

      throw liveErr;
    }
  };

  const promise = runLoad().finally(() => {
    inFlightTickersPromise = null;
  });
  inFlightTickersPromise = promise;
  return promise;
}

/**
 * Fetches a SEC endpoint by server-controlled key. The endpoint URL is built
 * entirely from SEC_ENDPOINTS constants; the only variables — cik, namespace, tag —
 * are strictly validated (cik is coerced to a Number, namespace and tag are validated
 * against strict alphanumeric allow-lists) so no user-supplied string can influence
 * request host or path traversal.
 * This is the SSRF barrier (CodeQL js/request-forgery, #215): callers never
 * pass a URL, only an allow-listed endpoint key.
 *
 * @param endpoint - 'tickers' | 'companyFacts' | 'companyConcept'
 * @param cik - required numeric CIK for 'companyFacts' and 'companyConcept'
 * @param namespace - required taxonomy namespace for 'companyConcept' (e.g. 'us-gaap')
 * @param tag - required concept tag for 'companyConcept' (e.g. 'Revenues')
 */
export function fetchFromSec(
  endpoint: 'tickers'
): Promise<unknown>;
export function fetchFromSec(
  endpoint: 'companyFacts',
  cik: number
): Promise<unknown>;
export function fetchFromSec(
  endpoint: 'companyConcept',
  cik: number,
  namespace: string,
  tag: string
): Promise<unknown>;
export function fetchFromSec(
  endpoint: keyof typeof SEC_ENDPOINTS,
  cik?: number,
  namespace?: string,
  tag?: string
): Promise<unknown> {
  if (endpoint === 'companyFacts') {
    if (!Number.isInteger(cik) || (cik as number) < 0) {
      return Promise.reject(new Error('companyFacts requires a non-negative integer CIK'));
    }
    return httpsGetJson(SEC_ENDPOINTS.companyFacts(cik as number));
  }
  if (endpoint === 'companyConcept') {
    if (!Number.isInteger(cik) || (cik as number) < 0) {
      return Promise.reject(new Error('companyConcept requires a non-negative integer CIK'));
    }
    if (!namespace || !VALID_NAMESPACE_REGEX.test(namespace)) {
      return Promise.reject(new Error('companyConcept requires a valid alphanumeric namespace'));
    }
    if (!tag || !VALID_TAG_REGEX.test(tag)) {
      return Promise.reject(new Error('companyConcept requires a valid alphanumeric tag'));
    }
    return httpsGetJson(SEC_ENDPOINTS.companyConcept(cik as number, namespace, tag));
  }
  return getSecTickersWithSource().then((result) => result.data);
}

/**
 * Sets CORS headers on the response to allow all origins.
 */
function setCorsHeaders(res: Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * secTickers — GET /api/sec-tickers
 *
 * Proxies https://www.sec.gov/files/company_tickers.json server-side to avoid
 * browser CORS restrictions. SEC requires a User-Agent header that cannot be
 * set from the browser. Response is cached for 24 hours (SEC updates daily).
 *
 * Usage:
 *   GET https://<region>-<project-id>.cloudfunctions.net/secTickers
 */
export async function secTickersHandler(
  req: Request,
  res: Response
): Promise<void> {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { data, source } = await getSecTickersWithSource();
    res.set('X-Tickers-Source', source);
    res.set('Cache-Control', `public, max-age=${CACHE_DURATION_SECONDS}, s-maxage=${CACHE_DURATION_SECONDS}`);
    res.status(200).json(data);
  } catch (err) {
    const message = (err as Error).message;
    functions.logger.error('secTickers proxy error', { message });
    res.status(502).json({ error: 'Failed to fetch SEC tickers', detail: message });
  }
}

/**
 * secCompanyFacts — GET /api/sec-company-facts?cik=<CIK>
 *
 * Proxies https://data.sec.gov/api/xbrl/companyfacts/CIK{paddedCIK}.json
 * server-side to avoid browser CORS restrictions.
 * CIK is zero-padded to 10 digits as required by the SEC API.
 * Response is cached for 24 hours.
 *
 * Usage:
 *   GET https://<region>-<project-id>.cloudfunctions.net/secCompanyFacts?cik=320193
 */
export async function secCompanyFactsHandler(
  req: Request,
  res: Response
): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const cikParam = req.query['cik'];
  if (!cikParam || typeof cikParam !== 'string' || !/^\d+$/.test(cikParam.trim())) {
    res.status(400).json({ error: 'Missing or invalid "cik" query parameter. Must be a numeric CIK.' });
    return;
  }

  // Re-parse to an integer: this is the SSRF barrier. Only a Number (not the
  // user-supplied string) is passed onward; fetchFromSec builds the URL from
  // constants, so no user input can influence the request host or path.
  const cikNumber = Number.parseInt(cikParam.trim(), 10);
  const paddedCik = String(cikNumber).padStart(10, '0');

  try {
    const data = await fetchFromSec('companyFacts', cikNumber);
    res.set('Cache-Control', `public, max-age=${CACHE_DURATION_SECONDS}, s-maxage=${CACHE_DURATION_SECONDS}`);
    res.status(200).json(data);
  } catch (err) {
    const message = (err as Error).message;
    const is404 = message.includes('status 404');

    functions.logger.error('secCompanyFacts proxy error', { cik: paddedCik, message });

    if (is404) {
      res.status(404).json({ error: `Company with CIK ${paddedCik} not found in SEC database.` });
    } else {
      res.status(502).json({ error: 'Failed to fetch SEC company facts', detail: message });
    }
  }
}

/**
 * secCompanyConcept — GET /api/sec-company-concept?cik=<CIK>&namespace=<NAMESPACE>&tag=<TAG>
 *
 * Proxies https://data.sec.gov/api/xbrl/companyconcept/CIK{paddedCIK}/{namespace}/{tag}.json
 * server-side to avoid browser CORS restrictions.
 * CIK is zero-padded to 10 digits as required by the SEC API.
 * Response is cached for 24 hours.
 *
 * Usage:
 *   GET https://<region>-<project-id>.cloudfunctions.net/secCompanyConcept?cik=1594805&namespace=us-gaap&tag=RevenueFromContractWithCustomerExcludingAssessedTax
 */
export async function secCompanyConceptHandler(
  req: Request,
  res: Response
): Promise<void> {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const cikParam = req.query['cik'];
  if (!cikParam || typeof cikParam !== 'string' || !/^\d+$/.test(cikParam.trim())) {
    res.status(400).json({ error: 'Missing or invalid "cik" query parameter. Must be a numeric CIK.' });
    return;
  }

  const namespaceParam = (typeof req.query['namespace'] === 'string' && req.query['namespace'].trim())
    ? req.query['namespace'].trim()
    : 'us-gaap';

  if (!VALID_NAMESPACE_REGEX.test(namespaceParam)) {
    res.status(400).json({ error: 'Invalid "namespace" query parameter. Must contain only alphanumeric characters, dashes, or underscores.' });
    return;
  }

  const tagParam = req.query['tag'];
  if (!tagParam || typeof tagParam !== 'string' || !VALID_TAG_REGEX.test(tagParam.trim())) {
    res.status(400).json({ error: 'Missing or invalid "tag" query parameter. Must be an alphanumeric XBRL concept tag.' });
    return;
  }

  const cleanTag = tagParam.trim();
  const cikNumber = Number.parseInt(cikParam.trim(), 10);
  const paddedCik = String(cikNumber).padStart(10, '0');

  try {
    const data = await fetchFromSec('companyConcept', cikNumber, namespaceParam, cleanTag);
    res.set('Cache-Control', `public, max-age=${CACHE_DURATION_SECONDS}, s-maxage=${CACHE_DURATION_SECONDS}`);
    res.status(200).json(data);
  } catch (err) {
    const message = (err as Error).message;
    const is404 = message.includes('status 404');

    functions.logger.error('secCompanyConcept proxy error', {
      cik: paddedCik,
      namespace: namespaceParam,
      tag: cleanTag,
      message,
    });

    if (is404) {
      res.status(404).json({
        error: `Concept ${namespaceParam}/${cleanTag} for CIK ${paddedCik} not found in SEC database.`,
      });
    } else {
      res.status(502).json({ error: 'Failed to fetch SEC company concept', detail: message });
    }
  }
}

