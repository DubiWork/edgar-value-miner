import { getApps } from 'firebase-admin/app';
import * as https from 'https';
import * as zlib from 'zlib';
import { fetchFromSec } from './secProxy.js';

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT || 'EdgarValueMiner/1.2 (dubigreenfeld@gmail.com)';
const COMPANY_CONTEXT_COLLECTION = 'companyContext';
const EDGAR_CACHE_COLLECTION = 'edgarCache';
const CONTEXT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days (1 quarter)
const SUBMISSIONS_CHECK_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours cheap SEC filing-date check
const TICKERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in-memory directory cache
const DEFAULT_MAX_RETRY_DELAY_MS = 5_000;
const MAX_VALID_CIK = 9_999_999_999;

const MAX_ITEM1_CHARS = 22_000;
const MAX_ITEM1A_CHARS = 12_000;
const MAX_ITEM7_CHARS = 18_000;
const MAX_EARNINGS_CHARS = 18_000;

export interface SourceStatus {
  status: 'ok' | 'fallback_8k' | 'manual' | 'missing' | 'error';
  source?: string;
  form?: string;
  date?: string | null;
  url?: string | null;
  charCount?: number;
  error?: string | null;
}

export interface IngestionStatus {
  tenK: SourceStatus;
  transcript: SourceStatus;
  eightK: SourceStatus;
  lastFetched: string;
}

export interface StoredCompanyContext {
  ticker: string;
  cik: number;
  companyName: string;
  tenK: {
    form: string;
    filingDate: string;
    accessionNumber: string;
    reportUrl: string;
    item1Business: string;
    item1ARiskFactors: string;
    item7Mda: string;
  } | null;
  earnings: {
    source: 'transcript' | '8-K' | 'manual';
    date: string;
    reportUrl: string | null;
    text: string;
  } | null;
  ingestionStatus: IngestionStatus;
  lastFetched: string;
  lastSubmissionsCheck?: string;
}

interface TickerDirectoryEntry {
  cik: number;
  companyName: string;
}

interface TickersDirectoryCache {
  map: Map<string, TickerDirectoryEntry>;
  timestamp: number;
}

const inMemoryContextStore = new Map<string, StoredCompanyContext>();
let memoryTickersCache: TickersDirectoryCache | null = null;

export function clearTickersCacheForTesting(): void {
  memoryTickersCache = null;
}

export function resetInMemoryContextForTesting(): void {
  inMemoryContextStore.clear();
  memoryTickersCache = null;
}

/**
 * Validates and normalizes an optional CIK (number or zero-padded digit string).
 */
export function parsePositiveCik(cik?: number | string | null): number | null {
  if (typeof cik === 'number') {
    return Number.isInteger(cik) && cik > 0 && cik <= MAX_VALID_CIK ? cik : null;
  }
  if (typeof cik === 'string') {
    const trimmed = cik.trim();
    if (!/^\d{1,10}$/.test(trimmed)) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_VALID_CIK ? parsed : null;
  }
  return null;
}

/**
 * Looks up an already-known CIK for the ticker from local memory or Firestore (`companyContext` / `edgarCache`)
 * so warm requests avoid downloading SEC's full company_tickers.json directory.
 */
async function loadKnownCikFromFirestore(
  normTicker: string
): Promise<{ cik: number; companyName?: string } | null> {
  const mem = inMemoryContextStore.get(normTicker);
  const memCik = parsePositiveCik(mem?.cik);
  if (memCik) {
    return {
      cik: memCik,
      ...(mem?.companyName ? { companyName: mem.companyName } : {}),
    };
  }

  if (getApps().length === 0) {
    return null;
  }

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    const ctxSnap = await db.collection(COMPANY_CONTEXT_COLLECTION).doc(normTicker).get();
    if (ctxSnap.exists) {
      const ctxData = ctxSnap.data() as Partial<StoredCompanyContext> | undefined;
      const ctxCik = parsePositiveCik(ctxData?.cik);
      if (ctxCik) {
        return {
          cik: ctxCik,
          ...(typeof ctxData?.companyName === 'string' && ctxData.companyName.trim()
            ? { companyName: ctxData.companyName.trim() }
            : {}),
        };
      }
    }

    const cacheSnap = await db.collection(EDGAR_CACHE_COLLECTION).doc(normTicker).get();
    if (cacheSnap.exists) {
      const cacheData = cacheSnap.data() as Record<string, unknown> | undefined;
      const cacheCik = parsePositiveCik(cacheData?.cik as number | string | null | undefined);
      if (cacheCik) {
        const name =
          typeof cacheData?.companyName === 'string' && cacheData.companyName.trim()
            ? cacheData.companyName.trim()
            : undefined;
        return {
          cik: cacheCik,
          ...(name ? { companyName: name } : {}),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Validates and normalizes a stock ticker symbol.
 */
export function sanitizeTicker(ticker: string): string {
  const clean = (ticker || '').trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,10}$/.test(clean)) {
    throw new Error(`Invalid ticker symbol: ${ticker}`);
  }
  return clean;
}

export interface HttpsGetOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxRetryDelayMs?: number;
  maxRedirects?: number;
  sleep?: (ms: number) => Promise<void>;
  requestFn?: typeof https.get;
}

interface HttpStatusError extends Error {
  statusCode?: number;
  retryAfterHeader?: string | string[];
}

/**
 * Parses an HTTP Retry-After header (integer seconds or HTTP-date) into clamped milliseconds.
 */
export function parseRetryAfterMs(
  headerVal?: string | string[],
  nowMs = Date.now(),
  maxDelayMs = DEFAULT_MAX_RETRY_DELAY_MS
): number | null {
  const firstVal = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (typeof firstVal !== 'string') return null;
  const raw = firstVal.trim();
  if (!raw) return null;

  if (/^\d{1,5}$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return Math.min(maxDelayMs, Math.max(0, ms));
  }

  const parsedMs = Date.parse(raw);
  if (Number.isFinite(parsedMs)) {
    return Math.min(maxDelayMs, Math.max(0, parsedMs - nowMs));
  }

  return null;
}

function httpsGetOnce(
  url: string,
  headers: Record<string, string>,
  redirectsLeft: number,
  requestFn: typeof https.get
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = requestFn(
      url,
      {
        headers: {
          'User-Agent': SEC_USER_AGENT,
          'Accept-Encoding': 'gzip, deflate',
          ...headers,
        },
        timeout: 25_000,
      },
      (res) => {
        const { statusCode, headers: resHeaders } = res;
        if (
          statusCode &&
          statusCode >= 300 &&
          statusCode < 400 &&
          resHeaders.location
        ) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects when fetching ${url}`));
            return;
          }
          let parsedRedirect: URL;
          try {
            parsedRedirect = new URL(resHeaders.location, url);
          } catch {
            reject(new Error(`Invalid redirect URL when fetching ${url}`));
            return;
          }
          if (parsedRedirect.protocol !== 'https:') {
            reject(new Error(`Blocked non-HTTPS redirect to ${parsedRedirect.protocol}`));
            return;
          }
          httpsGetOnce(
            parsedRedirect.toString(),
            headers,
            redirectsLeft - 1,
            requestFn
          ).then(resolve, reject);
          return;
        }

        if (statusCode !== 200) {
          res.resume();
          const err: HttpStatusError = new Error(`HTTP ${statusCode} when fetching ${url}`);
          err.statusCode = statusCode;
          if (resHeaders['retry-after'] !== undefined) {
            err.retryAfterHeader = resHeaders['retry-after'];
          }
          reject(err);
          return;
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
        let totalBytes = 0;
        const maxBytes = 15 * 1024 * 1024; // 15MB safety cap
        stream.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes <= maxBytes) {
            chunks.push(chunk);
          }
        });
        stream.on('error', reject);
        stream.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Low-level HTTPS GET helper with GZip/Deflate decompression and bounded 429/503 retry backoff.
 */
export async function httpsGetRaw(
  url: string,
  headers: Record<string, string> = {},
  options: HttpsGetOptions = {}
): Promise<string> {
  const maxRetries =
    typeof options.maxRetries === 'number' && options.maxRetries >= 0 ? options.maxRetries : 3;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0
      ? options.baseDelayMs
      : 400;
  const maxRetryDelayMs =
    typeof options.maxRetryDelayMs === 'number' && options.maxRetryDelayMs >= 0
      ? options.maxRetryDelayMs
      : DEFAULT_MAX_RETRY_DELAY_MS;
  const maxRedirects =
    typeof options.maxRedirects === 'number' && options.maxRedirects >= 0
      ? options.maxRedirects
      : 5;
  const sleep =
    options.sleep || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const requestFn = options.requestFn || https.get;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await httpsGetOnce(url, headers, maxRedirects, requestFn);
    } catch (err) {
      const httpErr = err as HttpStatusError;
      const statusCode = httpErr?.statusCode;
      const isRetryable = statusCode === 429 || statusCode === 503;
      if (!isRetryable || attempt >= maxRetries) {
        throw err;
      }
      const retryAfterDelay = parseRetryAfterMs(
        httpErr.retryAfterHeader,
        Date.now(),
        maxRetryDelayMs
      );
      const exponentialDelay = Math.min(maxRetryDelayMs, baseDelayMs * Math.pow(2, attempt));
      await sleep(retryAfterDelay ?? exponentialDelay);
    }
  }

  throw new Error(`HTTP request failed for ${url}`);
}

const BLOCK_HTML_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'tr',
  'li',
  'section',
  'br',
]);

const SKIP_CONTENT_TAGS = new Set(['script', 'style', 'ix:header']);

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  '#160': ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
};

function isAsciiAlpha(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isTagNameChar(code: number): boolean {
  return (
    isAsciiAlpha(code) ||
    (code >= 48 && code <= 57) || // 0-9
    code === 58 || // :
    code === 45 // -
  );
}

function isAsciiWhitespace(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12;
}

function findTagEnd(html: string, openIndex: number): number {
  const len = html.length;
  const maxScan = Math.min(len, openIndex + 16384);
  let quote = 0;

  for (let pos = openIndex + 1; pos < maxScan; pos++) {
    const code = html.charCodeAt(pos);
    if (quote !== 0) {
      if (code === quote) {
        quote = 0;
      }
      continue;
    }
    if (code === 34 || code === 39) {
      quote = code;
    } else if (code === 62) {
      return pos;
    }
  }

  const fallbackEnd = html.indexOf('>', openIndex + 1);
  return fallbackEnd === -1 ? len : fallbackEnd;
}

function skipUntilClosingTag(lowerHtml: string, fromIndex: number, tagName: string): number {
  const needle = `</${tagName}`;
  let searchFrom = fromIndex;

  while (searchFrom < lowerHtml.length) {
    const matchIndex = lowerHtml.indexOf(needle, searchFrom);
    if (matchIndex === -1) {
      return lowerHtml.length;
    }
    const afterNameIndex = matchIndex + needle.length;
    if (afterNameIndex >= lowerHtml.length) {
      return lowerHtml.length;
    }
    const nextCode = lowerHtml.charCodeAt(afterNameIndex);
    if (nextCode === 62 || nextCode === 47 || isAsciiWhitespace(nextCode)) {
      const closeBracket = lowerHtml.indexOf('>', afterNameIndex);
      return closeBracket === -1 ? lowerHtml.length : closeBracket + 1;
    }
    searchFrom = afterNameIndex;
  }

  return lowerHtml.length;
}

/**
 * Strips HTML/XBRL tags, scripts, styles, and collapses whitespace into clean prose
 * using a deterministic single-pass scanner and single-pass entity decoder.
 */
export function cleanFilingHtmlToText(html: string): string {
  if (!html) return '';

  const len = html.length;
  const chunks: string[] = [];
  let lowerHtml: string | null = null;
  let i = 0;

  while (i < len) {
    const ltIndex = html.indexOf('<', i);
    if (ltIndex === -1) {
      chunks.push(html.slice(i));
      break;
    }

    if (ltIndex > i) {
      chunks.push(html.slice(i, ltIndex));
    }

    if (html.startsWith('<!--', ltIndex)) {
      const commentEnd = html.indexOf('-->', ltIndex + 4);
      chunks.push(' ');
      i = commentEnd === -1 ? len : commentEnd + 3;
      continue;
    }

    const nextCode = ltIndex + 1 < len ? html.charCodeAt(ltIndex + 1) : 0;
    const startsTag =
      isAsciiAlpha(nextCode) ||
      nextCode === 33 || // !
      nextCode === 63 || // ?
      (nextCode === 47 && ltIndex + 2 < len && isAsciiAlpha(html.charCodeAt(ltIndex + 2)));

    if (!startsTag) {
      chunks.push('<');
      i = ltIndex + 1;
      continue;
    }

    const tagEnd = findTagEnd(html, ltIndex);
    let cursor = ltIndex + 1;
    const isClosing = html.charCodeAt(cursor) === 47;
    if (isClosing) {
      cursor++;
    }

    const nameStart = cursor;
    while (cursor < tagEnd && isTagNameChar(html.charCodeAt(cursor))) {
      cursor++;
    }
    const tagName = html.slice(nameStart, cursor).toLowerCase();

    let scanBack = tagEnd < len ? tagEnd - 1 : len - 1;
    while (scanBack > ltIndex && isAsciiWhitespace(html.charCodeAt(scanBack))) {
      scanBack--;
    }
    const isSelfClosing = !isClosing && scanBack > ltIndex && html.charCodeAt(scanBack) === 47;

    if (!isClosing && !isSelfClosing && SKIP_CONTENT_TAGS.has(tagName)) {
      lowerHtml ??= html.toLowerCase();
      chunks.push(' ');
      i = tagEnd < len ? skipUntilClosingTag(lowerHtml, tagEnd + 1, tagName) : len;
      continue;
    }

    chunks.push(
      (isClosing && BLOCK_HTML_TAGS.has(tagName)) || (!isClosing && tagName === 'br')
        ? '\n'
        : ' '
    );
    i = tagEnd < len ? tagEnd + 1 : len;
  }

  const decoded = chunks.join('').replace(
    /&(nbsp|#160|amp|lt|gt|quot|#39|apos);/gi,
    (match, entity: string) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? match
  );

  return decoded
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts Item 1 (Business), Item 1A (Risk Factors), and Item 7 (MD&A) from cleaned 10-K text.
 * Uses the last matching heading occurrence so Table of Contents entries are skipped in favor
 * of the actual body sections.
 */
export function extract10KSections(cleanText: string): {
  item1Business: string;
  item1ARiskFactors: string;
  item7Mda: string;
} {
  if (!cleanText) {
    return { item1Business: '', item1ARiskFactors: '', item7Mda: '' };
  }

  const findSectionSlice = (
    startPatterns: RegExp[],
    endPatterns: RegExp[],
    maxChars: number
  ): string => {
    let bestStart = -1;

    for (const pattern of startPatterns) {
      const matches = Array.from(cleanText.matchAll(pattern));
      for (const m of matches) {
        if (typeof m.index === 'number' && m.index > bestStart) {
          // Ensure there's substantial content after this heading (not a footer at the very end)
          if (cleanText.length - m.index > 800) {
            bestStart = m.index;
          }
        }
      }
      if (bestStart !== -1) break;
    }

    if (bestStart === -1) {
      return '';
    }

    const afterStart = cleanText.slice(bestStart);
    let endOffset = Math.min(afterStart.length, maxChars);

    for (const endPat of endPatterns) {
      const m = endPat.exec(afterStart.slice(400)); // skip the start heading itself
      if (m && typeof m.index === 'number') {
        const candidateEnd = m.index + 400;
        if (candidateEnd > 600 && candidateEnd < endOffset) {
          endOffset = candidateEnd;
        }
        break;
      }
    }

    return afterStart.slice(0, endOffset).trim();
  };

  const item1Business =
    findSectionSlice(
      [
        /(?:^|\n)\s*ITEM\s+1\.?\s*[—\-–:]?\s*BUSINESS\b/gi,
        /(?:^|\n)\s*Item\s+4\.?\s*[—\-–:]?\s*Information\s+on\s+the\s+Company\b/gi, // 20-F
      ],
      [
        /(?:^|\n)\s*ITEM\s+1A\.?\s*[—\-–:]?\s*RISK\s+FACTORS\b/i,
        /(?:^|\n)\s*ITEM\s+2\.?\s*[—\-–:]?\s*PROPERTIES\b/i,
      ],
      MAX_ITEM1_CHARS
    ) || cleanText.slice(0, MAX_ITEM1_CHARS);

  const item1ARiskFactors = findSectionSlice(
    [
      /(?:^|\n)\s*ITEM\s+1A\.?\s*[—\-–:]?\s*RISK\s+FACTORS\b/gi,
      /(?:^|\n)\s*Risk\s+Factors\b/gi,
    ],
    [
      /(?:^|\n)\s*ITEM\s+1B\.?\s*[—\-–:]?\s*UNRESOLVED\s+STAFF\s+COMMENTS\b/i,
      /(?:^|\n)\s*ITEM\s+2\.?\s*[—\-–:]?\s*PROPERTIES\b/i,
    ],
    MAX_ITEM1A_CHARS
  );

  const item7Mda = findSectionSlice(
    [
      /(?:^|\n)\s*ITEM\s+7\.?\s*[—\-–:]?\s*MANAGEMENT['’]?S\s+DISCUSSION\b/gi,
      /(?:^|\n)\s*Item\s+5\.?\s*[—\-–:]?\s*Operating\s+and\s+Financial\s+Review\b/gi, // 20-F
    ],
    [
      /(?:^|\n)\s*ITEM\s+7A\.?\s*[—\-–:]?\s*QUANTITATIVE\s+AND\s+QUALITATIVE\b/i,
      /(?:^|\n)\s*ITEM\s+8\.?\s*[—\-–:]?\s*FINANCIAL\s+STATEMENTS\b/i,
    ],
    MAX_ITEM7_CHARS
  );

  return {
    item1Business: item1Business.slice(0, MAX_ITEM1_CHARS),
    item1ARiskFactors: item1ARiskFactors.slice(0, MAX_ITEM1A_CHARS),
    item7Mda: item7Mda.slice(0, MAX_ITEM7_CHARS),
  };
}

/**
 * Resolves CIK and company name from SEC company_tickers.json (cached in memory for 24h).
 */
export async function resolveTickerFromSec(
  ticker: string,
  fetcher: typeof httpsGetRaw = httpsGetRaw,
  options: { nowMs?: number } = {}
): Promise<{ cik: number; companyName: string }> {
  const norm = sanitizeTicker(ticker);
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();

  if (!memoryTickersCache || nowMs - memoryTickersCache.timestamp >= TICKERS_CACHE_TTL_MS) {
    const parsed = (
      fetcher === httpsGetRaw
        ? await fetchFromSec('tickers')
        : JSON.parse(
            await fetcher('https://www.sec.gov/files/company_tickers.json', {
              Accept: 'application/json',
            })
          )
    ) as Record<
      string,
      { cik_str?: number | string; cik?: number | string; ticker?: string; title?: string }
    >;

    const map = new Map<string, TickerDirectoryEntry>();
    if (parsed && typeof parsed === 'object') {
      for (const entry of Object.values(parsed)) {
        if (!entry || typeof entry !== 'object' || !entry.ticker) continue;
        const entryCik = parsePositiveCik(entry.cik_str ?? entry.cik);
        if (!entryCik) continue;
        const entryTicker = String(entry.ticker).trim().toUpperCase();
        map.set(entryTicker, {
          cik: entryCik,
          companyName: entry.title ? String(entry.title).trim() : entryTicker,
        });
      }
    }
    memoryTickersCache = { map, timestamp: nowMs };
  }

  const hit =
    memoryTickersCache.map.get(norm) ??
    memoryTickersCache.map.get(norm.replace(/\./g, '-')) ??
    memoryTickersCache.map.get(norm.replace(/-/g, '.'));
  if (hit) {
    return hit;
  }

  throw new Error(`Ticker ${norm} not found in SEC company_tickers.json`);
}

interface SecFilingMeta {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  reportUrl: string;
}

/**
 * Finds the latest 10-K (or 20-F / 40-F) and latest 8-K (Item 2.02) from SEC submissions API.
 */
export async function findLatestSecFilings(
  cik: number,
  fetcher: typeof httpsGetRaw = httpsGetRaw
): Promise<{
  tenK: SecFilingMeta | null;
  eightKEarnings: SecFilingMeta | null;
  companyName?: string;
}> {
  const numericCik = Math.trunc(Number(cik));
  if (!Number.isFinite(numericCik) || numericCik <= 0) {
    throw new Error('Invalid numeric CIK');
  }

  const paddedCik = String(numericCik).padStart(10, '0');
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
  const raw = await fetcher(submissionsUrl, { Accept: 'application/json' });
  const subs = JSON.parse(raw);
  const entityName =
    typeof subs?.name === 'string' && subs.name.trim() ? subs.name.trim() : undefined;
  const recent = subs?.filings?.recent;

  if (!recent || !Array.isArray(recent.form)) {
    return {
      tenK: null,
      eightKEarnings: null,
      ...(entityName ? { companyName: entityName } : {}),
    };
  }

  let tenK: SecFilingMeta | null = null;
  let eightKEarnings: SecFilingMeta | null = null;

  const annualForms = new Set(['10-K', '20-F', '40-F']);

  for (let i = 0; i < recent.form.length; i++) {
    const form = String(recent.form[i] || '');
    const accession = String(recent.accessionNumber?.[i] || '');
    const filingDate = String(recent.filingDate?.[i] || '');
    const primaryDocument = String(recent.primaryDocument?.[i] || '');
    const itemsStr = String(recent.items?.[i] || '');

    if (!accession || !primaryDocument) continue;

    const accNoDashes = accession.replace(/-/g, '');
    const reportUrl = `https://www.sec.gov/Archives/edgar/data/${numericCik}/${accNoDashes}/${primaryDocument}`;

    if (!tenK && annualForms.has(form)) {
      tenK = {
        form,
        filingDate,
        accessionNumber: accession,
        primaryDocument,
        reportUrl,
      };
    }

    if (!eightKEarnings && form === '8-K') {
      const items = itemsStr.split(',').map((s) => s.trim());
      if (items.includes('2.02')) {
        eightKEarnings = {
          form: '8-K',
          filingDate,
          accessionNumber: accession,
          primaryDocument,
          reportUrl,
        };
      }
    }

    if (tenK && eightKEarnings) break;
  }

  return {
    tenK,
    eightKEarnings,
    ...(entityName ? { companyName: entityName } : {}),
  };
}

/**
 * Attempts to scrape a public earnings call transcript (e.g. from Motley Fool's public sitemap/quote page),
 * returning null if none is found so the caller can gracefully fall back to the SEC 8-K (Item 2.02).
 */
export async function tryFetchPublicTranscript(
  ticker: string,
  fetcher: typeof httpsGetRaw = httpsGetRaw
): Promise<{ text: string; date: string; url: string; source: string } | null> {
  const norm = sanitizeTicker(ticker);

  // Optional FMP transcript if FMP_API_KEY is configured in Cloud Functions env
  const fmpKey = process.env.FMP_API_KEY || process.env.VITE_FMP_API_KEY;
  if (fmpKey) {
    try {
      const url = `https://financialmodelingprep.com/api/v3/earning_call_transcript/${norm}?apikey=${encodeURIComponent(
        fmpKey
      )}`;
      const raw = await fetcher(url, { Accept: 'application/json' });
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data[0]?.content) {
        return {
          text: String(data[0].content).slice(0, MAX_EARNINGS_CHARS),
          date: String(data[0].date || new Date().toISOString().slice(0, 10)),
          url: `https://financialmodelingprep.com/api/v3/earning_call_transcript/${norm}`,
          source: 'FMP Transcript',
        };
      }
    } catch {
      // Fall through to Motley Fool / 8-K fallback
    }
  }

  // Try Motley Fool quote page for latest earnings transcript link
  for (const exchange of ['nasdaq', 'nyse']) {
    try {
      const quoteUrl = `https://www.fool.com/quote/${exchange}/${norm.toLowerCase()}/`;
      const html = await fetcher(quoteUrl, {
        'User-Agent': 'Mozilla/5.0 (compatible; EdgarValueMiner/1.0)',
      });
      const match = html.match(
        /href="(\/earnings\/call-transcripts\/\d{4}\/\d{2}\/\d{2}\/[^"]+-earnings-call-transcript\/?)"/i
      );
      if (match?.[1]) {
        const transcriptUrl = `https://www.fool.com${match[1]}`;
        const transcriptHtml = await fetcher(transcriptUrl, {
          'User-Agent': 'Mozilla/5.0 (compatible; EdgarValueMiner/1.0)',
        });
        const clean = cleanFilingHtmlToText(transcriptHtml);
        if (clean.length > 1000) {
          const dateMatch = match[1].match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
          const dateStr = dateMatch
            ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
            : new Date().toISOString().slice(0, 10);
          return {
            text: clean.slice(0, MAX_EARNINGS_CHARS),
            date: dateStr,
            url: transcriptUrl,
            source: 'Motley Fool Transcript',
          };
        }
      }
    } catch {
      // Continue to next exchange or 8-K fallback
    }
  }

  return null;
}

/**
 * Loads cached company context from Firestore (or in-memory store in tests).
 */
export async function loadCachedCompanyContext(
  ticker: string
): Promise<StoredCompanyContext | null> {
  const norm = sanitizeTicker(ticker);

  if (getApps().length === 0) {
    return inMemoryContextStore.get(norm) || null;
  }

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const snap = await db.collection(COMPANY_CONTEXT_COLLECTION).doc(norm).get();
    if (snap.exists) {
      return snap.data() as StoredCompanyContext;
    }
  } catch {
    return inMemoryContextStore.get(norm) || null;
  }

  return null;
}

/**
 * Saves company context to Firestore (and in-memory store).
 */
export async function saveCompanyContext(
  context: StoredCompanyContext
): Promise<void> {
  const norm = sanitizeTicker(context.ticker);
  inMemoryContextStore.set(norm, context);

  if (getApps().length === 0) return;

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    await db.collection(COMPANY_CONTEXT_COLLECTION).doc(norm).set(context, {
      merge: true,
    });
  } catch {
    // Keep in-memory copy if Firestore write fails in test env
  }
}

/**
 * Saves an Admin-supplied manual transcript for a ticker and updates its ingestionStatus.
 */
export async function saveManualTranscriptForTicker(
  ticker: string,
  transcriptText: string,
  periodOrDate?: string
): Promise<StoredCompanyContext> {
  const norm = sanitizeTicker(ticker);
  const cleanText = (transcriptText || '').trim().slice(0, MAX_EARNINGS_CHARS);
  if (!cleanText) {
    throw new Error('Manual transcript text cannot be empty');
  }

  const existing = await loadCachedCompanyContext(norm);
  const nowIso = new Date().toISOString();
  const dateStr = periodOrDate || nowIso.slice(0, 10);

  const updated: StoredCompanyContext = existing
    ? {
        ...existing,
        earnings: {
          source: 'manual',
          date: dateStr,
          reportUrl: null,
          text: cleanText,
        },
        ingestionStatus: {
          ...existing.ingestionStatus,
          transcript: {
            status: 'manual',
            source: 'Admin Manual Upload',
            date: dateStr,
            url: null,
            charCount: cleanText.length,
            error: null,
          },
          lastFetched: nowIso,
        },
      }
    : {
        ticker: norm,
        cik: 0,
        companyName: norm,
        tenK: null,
        earnings: {
          source: 'manual',
          date: dateStr,
          reportUrl: null,
          text: cleanText,
        },
        ingestionStatus: {
          tenK: { status: 'missing', error: 'Not fetched yet' },
          transcript: {
            status: 'manual',
            source: 'Admin Manual Upload',
            date: dateStr,
            url: null,
            charCount: cleanText.length,
            error: null,
          },
          eightK: { status: 'missing', error: 'Not fetched yet' },
          lastFetched: nowIso,
        },
        lastFetched: nowIso,
      };

  await saveCompanyContext(updated);
  return updated;
}

/**
 * Main orchestrator: returns cached L2 companyContext if fresh (<90 days),
 * or fetches 10-K (Item 1, 1A, 7) + Transcript / 8-K from SEC EDGAR, saves to Firestore, and returns.
 */
export async function getOrFetchCompanyContext(
  ticker: string,
  options: {
    forceRefresh?: boolean;
    fetcher?: typeof httpsGetRaw;
    cik?: number | string | null;
    companyName?: string;
  } = {}
): Promise<StoredCompanyContext> {
  const norm = sanitizeTicker(ticker);
  const fetcher = options.fetcher || httpsGetRaw;
  const explicitCik = parsePositiveCik(options.cik);

  if (!options.forceRefresh) {
    const cached = await loadCachedCompanyContext(norm);
    if (cached && cached.lastFetched) {
      const ageMs = Date.now() - new Date(cached.lastFetched).getTime();
      const checkAgeMs =
        Date.now() - new Date(cached.lastSubmissionsCheck || cached.lastFetched).getTime();
      if (ageMs < CONTEXT_TTL_MS && cached.tenK?.item1Business) {
        // When context is already complete and checked within 12h, return immediately (0 HTTP calls).
        if (isContextGroundedComplete(cached) && checkAgeMs < SUBMISSIONS_CHECK_COOLDOWN_MS) {
          return cached;
        }
        // Otherwise verify filing dates cheaply (~$0 LLM cost) before serving cached context
        const freshness = await checkAndRefreshCompanyContext(norm, {
          fetcher,
          cik: explicitCik ?? cached.cik,
        });
        if (freshness.context?.tenK?.item1Business) {
          return freshness.context;
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  const ingestionStatus: IngestionStatus = {
    tenK: { status: 'missing', error: null },
    transcript: { status: 'missing', error: null },
    eightK: { status: 'missing', error: null },
    lastFetched: nowIso,
  };

  let cik = 0;
  let companyName =
    typeof options.companyName === 'string' && options.companyName.trim()
      ? options.companyName.trim()
      : norm;

  try {
    if (explicitCik) {
      cik = explicitCik;
    } else {
      const known = await loadKnownCikFromFirestore(norm);
      if (known) {
        cik = known.cik;
        if (known.companyName && companyName === norm) {
          companyName = known.companyName;
        }
      } else {
        const resolved = await resolveTickerFromSec(norm, fetcher);
        cik = resolved.cik;
        companyName = resolved.companyName || companyName;
      }
    }
  } catch (err) {
    const previous = await loadCachedCompanyContext(norm);
    if (previous?.tenK?.item1Business) {
      return previous;
    }
    const errMsg = (err as Error)?.message || 'Failed to resolve CIK';
    ingestionStatus.tenK = { status: 'error', error: errMsg };
    ingestionStatus.eightK = { status: 'error', error: errMsg };
    const fallbackCtx: StoredCompanyContext = {
      ticker: norm,
      cik: 0,
      companyName,
      tenK: null,
      earnings: null,
      ingestionStatus,
      lastFetched: nowIso,
    };
    await saveCompanyContext(fallbackCtx);
    return fallbackCtx;
  }

  let tenKData: StoredCompanyContext['tenK'] = null;
  let earningsData: StoredCompanyContext['earnings'] = null;

  try {
    const {
      tenK,
      eightKEarnings,
      companyName: subsCompanyName,
    } = await findLatestSecFilings(cik, fetcher);
    if (subsCompanyName && companyName === norm) {
      companyName = subsCompanyName;
    }

    // 1. Fetch & extract 10-K / 20-F sections
    if (tenK) {
      try {
        const raw10KHtml = await fetcher(tenK.reportUrl);
        const clean10K = cleanFilingHtmlToText(raw10KHtml);
        const sections = extract10KSections(clean10K);
        const totalChars =
          sections.item1Business.length +
          sections.item1ARiskFactors.length +
          sections.item7Mda.length;

        tenKData = {
          form: tenK.form,
          filingDate: tenK.filingDate,
          accessionNumber: tenK.accessionNumber,
          reportUrl: tenK.reportUrl,
          ...sections,
        };
        ingestionStatus.tenK = {
          status: 'ok',
          form: tenK.form,
          date: tenK.filingDate,
          url: tenK.reportUrl,
          charCount: totalChars,
          error: null,
        };
      } catch (err) {
        ingestionStatus.tenK = {
          status: 'error',
          form: tenK.form,
          date: tenK.filingDate,
          url: tenK.reportUrl,
          error: (err as Error)?.message || 'Failed to download 10-K HTML',
        };
      }
    } else {
      ingestionStatus.tenK = {
        status: 'missing',
        error: 'No 10-K or 20-F found in recent SEC submissions',
      };
    }

    // 2. Try public transcript first
    const transcript = await tryFetchPublicTranscript(norm, fetcher);
    if (transcript) {
      earningsData = {
        source: 'transcript',
        date: transcript.date,
        reportUrl: transcript.url,
        text: transcript.text,
      };
      ingestionStatus.transcript = {
        status: 'ok',
        source: transcript.source,
        date: transcript.date,
        url: transcript.url,
        charCount: transcript.text.length,
        error: null,
      };
    }

    // 3. Fetch 8-K (Item 2.02) Earnings Release (used as primary if transcript missing, or recorded in status)
    if (eightKEarnings) {
      try {
        const raw8K = await fetcher(eightKEarnings.reportUrl);
        const clean8K = cleanFilingHtmlToText(raw8K).slice(0, MAX_EARNINGS_CHARS);
        ingestionStatus.eightK = {
          status: 'ok',
          form: '8-K (Item 2.02)',
          date: eightKEarnings.filingDate,
          url: eightKEarnings.reportUrl,
          charCount: clean8K.length,
          error: null,
        };

        if (!earningsData && clean8K.length > 200) {
          earningsData = {
            source: '8-K',
            date: eightKEarnings.filingDate,
            reportUrl: eightKEarnings.reportUrl,
            text: clean8K,
          };
          ingestionStatus.transcript = {
            status: 'fallback_8k',
            source: 'SEC 8-K (Item 2.02 Earnings Release)',
            date: eightKEarnings.filingDate,
            url: eightKEarnings.reportUrl,
            charCount: clean8K.length,
            error: 'Transcript not available publicly; using SEC 8-K Item 2.02 fallback',
          };
        }
      } catch (err) {
        ingestionStatus.eightK = {
          status: 'error',
          date: eightKEarnings.filingDate,
          url: eightKEarnings.reportUrl,
          error: (err as Error)?.message || 'Failed to download 8-K',
        };
      }
    } else {
      ingestionStatus.eightK = {
        status: 'missing',
        error: 'No recent 8-K (Item 2.02) found',
      };
    }

    if (!earningsData && ingestionStatus.transcript.status === 'missing') {
      ingestionStatus.transcript = {
        status: 'missing',
        error: 'No public transcript or 8-K Item 2.02 found — Admin manual upload available',
      };
    }
  } catch (err) {
    ingestionStatus.tenK = {
      status: 'error',
      error: (err as Error)?.message || 'SEC submissions lookup failed',
    };
  }

  // Preserve manual transcript if one was previously uploaded by Admin and no live transcript replaced it
  const previous = await loadCachedCompanyContext(norm);
  if (!earningsData && previous?.earnings?.source === 'manual') {
    earningsData = previous.earnings;
    ingestionStatus.transcript = previous.ingestionStatus.transcript;
  }

  const contextDoc: StoredCompanyContext = {
    ticker: norm,
    cik,
    companyName,
    tenK: tenKData,
    earnings: earningsData,
    ingestionStatus,
    lastFetched: nowIso,
    lastSubmissionsCheck: nowIso,
  };

  await saveCompanyContext(contextDoc);
  return contextDoc;
}

/**
 * Returns true only when both 10-K text and 8-K metadata were successfully grounded.
 */
export function isContextGroundedComplete(ctx: StoredCompanyContext | null): boolean {
  if (!ctx) return false;
  return (
    Boolean(ctx.tenK?.item1Business) &&
    ctx.ingestionStatus?.tenK?.status === 'ok' &&
    ctx.ingestionStatus?.eightK?.status === 'ok'
  );
}

/**
 * Cheaply verifies SEC submissions JSON (~$0 LLM cost) against cached context & client dates.
 * Only downloads full 10-K / 8-K filings if filing dates changed or prior ingestion was incomplete.
 */
export async function checkAndRefreshCompanyContext(
  ticker: string,
  options: {
    clientFilingDates?: { tenKDate?: string | null; eightKDate?: string | null } | null;
    fetcher?: typeof httpsGetRaw;
    nowMs?: number;
    cik?: number | string | null;
  } = {}
): Promise<{
  context: StoredCompanyContext | null;
  refreshed: boolean;
  hasNewerFilings: boolean;
  latestFilingDates: { tenKDate: string | null; eightKDate: string | null };
}> {
  const norm = sanitizeTicker(ticker);
  const fetcher = options.fetcher || httpsGetRaw;
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  let current = await loadCachedCompanyContext(norm);
  if (!current) {
    return {
      context: null,
      refreshed: false,
      hasNewerFilings: false,
      latestFilingDates: { tenKDate: null, eightKDate: null },
    };
  }

  let refreshed = false;
  const lastCheckMs = new Date(current.lastSubmissionsCheck || current.lastFetched || 0).getTime();
  const cooldownExpired = nowMs - lastCheckMs >= SUBMISSIONS_CHECK_COOLDOWN_MS;
  const incomplete = !isContextGroundedComplete(current) || current.cik === 0;

  if (incomplete || cooldownExpired) {
    try {
      let cik =
        parsePositiveCik(current.cik) ??
        parsePositiveCik(options.cik) ??
        (await loadKnownCikFromFirestore(norm))?.cik ??
        0;
      if (!cik) {
        const resolved = await resolveTickerFromSec(norm, fetcher);
        cik = resolved.cik;
      }

      const { tenK, eightKEarnings } = await findLatestSecFilings(cik, fetcher);
      const secTenKDate = tenK?.filingDate || null;
      const secEightKDate = eightKEarnings?.filingDate || null;

      const needsTenKRefresh = Boolean(
        secTenKDate &&
          (!current.tenK?.item1Business ||
            current.ingestionStatus?.tenK?.status !== 'ok' ||
            secTenKDate !== current.tenK?.filingDate)
      );
      const needsEightKRefresh = Boolean(
        secEightKDate &&
          (current.ingestionStatus?.eightK?.status !== 'ok' ||
            secEightKDate !== current.ingestionStatus?.eightK?.date)
      );

      if (needsTenKRefresh || needsEightKRefresh) {
        current = await getOrFetchCompanyContext(norm, {
          forceRefresh: true,
          fetcher,
          cik,
        });
        refreshed = true;
      } else {
        current = {
          ...current,
          lastSubmissionsCheck: nowIso,
        };
        await saveCompanyContext(current);
      }
    } catch {
      // Preserve existing context cleanly on transient SEC API error
    }
  }

  const latestTenKDate = current.ingestionStatus?.tenK?.date || current.tenK?.filingDate || null;
  const latestEightKDate = current.ingestionStatus?.eightK?.date || null;
  const clientDates = options.clientFilingDates;

  const hasNewerFilings = Boolean(
    clientDates &&
      ((clientDates.tenKDate !== undefined &&
        latestTenKDate &&
        latestTenKDate !== clientDates.tenKDate) ||
        (clientDates.eightKDate !== undefined &&
          latestEightKDate &&
          latestEightKDate !== clientDates.eightKDate))
  );

  return {
    context: current,
    refreshed,
    hasNewerFilings,
    latestFilingDates: {
      tenKDate: latestTenKDate,
      eightKDate: latestEightKDate,
    },
  };
}

/**
 * Formats the StoredCompanyContext into a compact, structured block to inject into the LLM prompt.
 */
export function buildGroundedContextPromptBlock(
  ctx: StoredCompanyContext | null
): string {
  if (!ctx || (!ctx.tenK && !ctx.earnings)) {
    return '';
  }

  const parts: string[] = [
    `\n\n=== GROUNDED SEC FILINGS & EARNINGS CONTEXT FOR ${ctx.companyName} (${ctx.ticker}) ===`,
  ];

  if (ctx.tenK) {
    parts.push(
      `[SOURCE 1: SEC Form ${ctx.tenK.form} filed on ${ctx.tenK.filingDate} | URL: ${ctx.tenK.reportUrl}]`
    );
    if (ctx.tenK.item1Business) {
      parts.push(`--- ITEM 1 (BUSINESS) ---\n${ctx.tenK.item1Business}`);
    }
    if (ctx.tenK.item7Mda) {
      parts.push(`--- ITEM 7 (MD&A & SEGMENTS) ---\n${ctx.tenK.item7Mda}`);
    }
    if (ctx.tenK.item1ARiskFactors) {
      parts.push(`--- ITEM 1A (RISK FACTORS) ---\n${ctx.tenK.item1ARiskFactors}`);
    }
  }

  if (ctx.earnings) {
    parts.push(
      `[SOURCE 2: Latest Earnings (${ctx.earnings.source}) dated ${ctx.earnings.date}${
        ctx.earnings.reportUrl ? ` | URL: ${ctx.earnings.reportUrl}` : ''
      }]\n${ctx.earnings.text}`
    );
  }

  parts.push('=== END OF GROUNDED FILINGS CONTEXT ===\n');
  return parts.join('\n\n');
}
