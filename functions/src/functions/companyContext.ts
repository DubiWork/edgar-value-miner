import { getApps } from 'firebase-admin/app';
import * as https from 'https';
import * as zlib from 'zlib';

const SEC_USER_AGENT = 'edgar-value-miner (contact@example.com)';
const COMPANY_CONTEXT_COLLECTION = 'companyContext';
const CONTEXT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days (1 quarter)

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
}

const inMemoryContextStore = new Map<string, StoredCompanyContext>();

export function resetInMemoryContextForTesting(): void {
  inMemoryContextStore.clear();
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

/**
 * Low-level HTTPS GET helper with GZip/Deflate decompression.
 */
export function httpsGetRaw(
  url: string,
  headers: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
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
          const redirectUrl = resHeaders.location.startsWith('http')
            ? resHeaders.location
            : new URL(resHeaders.location, url).toString();
          httpsGetRaw(redirectUrl, headers).then(resolve, reject);
          return;
        }

        if (statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${statusCode} when fetching ${url}`));
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
 * Strips HTML/XBRL tags, scripts, styles, and collapses whitespace into clean prose.
 */
export function cleanFilingHtmlToText(html: string): string {
  if (!html) return '';

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<ix:header[\s\S]*?<\/ix:header>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|tr|li|section|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
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
 * Resolves CIK and company name from SEC company_tickers.json.
 */
export async function resolveTickerFromSec(
  ticker: string,
  fetcher: typeof httpsGetRaw = httpsGetRaw
): Promise<{ cik: number; companyName: string }> {
  const norm = sanitizeTicker(ticker);
  const raw = await fetcher('https://www.sec.gov/files/company_tickers.json', {
    Accept: 'application/json',
  });
  const parsed = JSON.parse(raw) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;

  for (const entry of Object.values(parsed)) {
    if (entry.ticker?.toUpperCase() === norm) {
      return {
        cik: Number(entry.cik_str),
        companyName: entry.title || norm,
      };
    }
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
}> {
  const numericCik = Math.trunc(Number(cik));
  if (!Number.isFinite(numericCik) || numericCik <= 0) {
    throw new Error('Invalid numeric CIK');
  }

  const paddedCik = String(numericCik).padStart(10, '0');
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
  const raw = await fetcher(submissionsUrl, { Accept: 'application/json' });
  const subs = JSON.parse(raw);
  const recent = subs?.filings?.recent;

  if (!recent || !Array.isArray(recent.form)) {
    return { tenK: null, eightKEarnings: null };
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

  return { tenK, eightKEarnings };
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
  } = {}
): Promise<StoredCompanyContext> {
  const norm = sanitizeTicker(ticker);
  const fetcher = options.fetcher || httpsGetRaw;

  if (!options.forceRefresh) {
    const cached = await loadCachedCompanyContext(norm);
    if (cached && cached.lastFetched) {
      const ageMs = Date.now() - new Date(cached.lastFetched).getTime();
      if (ageMs < CONTEXT_TTL_MS && cached.tenK?.item1Business) {
        return cached;
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
  let companyName = norm;

  try {
    const resolved = await resolveTickerFromSec(norm, fetcher);
    cik = resolved.cik;
    companyName = resolved.companyName;
  } catch (err) {
    const errMsg = (err as Error)?.message || 'Failed to resolve CIK';
    ingestionStatus.tenK = { status: 'error', error: errMsg };
    ingestionStatus.eightK = { status: 'error', error: errMsg };
    const fallbackCtx: StoredCompanyContext = {
      ticker: norm,
      cik: 0,
      companyName: norm,
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
    const { tenK, eightKEarnings } = await findLatestSecFilings(cik, fetcher);

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
  };

  await saveCompanyContext(contextDoc);
  return contextDoc;
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
