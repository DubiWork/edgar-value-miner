import * as functions from 'firebase-functions';
import * as https from 'https';
import * as zlib from 'zlib';
import type { Request, Response } from 'express';

const SEC_USER_AGENT = 'edgar-value-miner (contact@example.com)';

const CACHE_DURATION_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Hostnames this proxy is permitted to fetch from. Prevents SSRF: even though
 * callers build URLs from validated input, fetchFromSec independently rejects
 * any URL whose host is not an approved SEC endpoint (CodeQL js/request-forgery, #215).
 */
const ALLOWED_SEC_HOSTS = new Set(['www.sec.gov', 'data.sec.gov']);

/**
 * Fetches a URL from the SEC EDGAR API server-side, handling GZip decompression.
 * Sets the required User-Agent header (SEC blocks requests without it).
 *
 * Exported for unit testing of the SSRF host allowlist.
 *
 * @param url - The SEC URL to fetch
 * @returns Parsed JSON response
 */
export function fetchFromSec(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // SSRF guard: only allow HTTPS requests to approved SEC hosts.
    // (Both www.sec.gov — tickers — and data.sec.gov — company facts.)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error('Invalid SEC URL'));
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_SEC_HOSTS.has(parsed.hostname)) {
      return reject(new Error(`Refusing to fetch non-SEC URL: ${parsed.hostname}`));
    }

    const options = {
      headers: {
        'User-Agent': SEC_USER_AGENT,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
    };

    https.get(url, options, (res) => {
      const { statusCode, headers: resHeaders } = res;

      if (statusCode !== 200) {
        res.resume();
        return reject(new Error(`SEC API returned status ${statusCode} for ${url}`));
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
    }).on('error', reject);
  });
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
    const data = await fetchFromSec('https://www.sec.gov/files/company_tickers.json');
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

  const paddedCik = cikParam.trim().padStart(10, '0');
  const secUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;

  try {
    const data = await fetchFromSec(secUrl);
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
