import * as functions from 'firebase-functions';
import * as https from 'https';
import * as zlib from 'zlib';
import type { Request, Response } from 'express';

const SEC_USER_AGENT = 'edgar-value-miner (contact@example.com)';

const CACHE_DURATION_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Fully server-controlled SEC endpoint URLs. The only variable part — the CIK —
 * is a plain integer re-derived by the server (never a user-supplied string),
 * so no user input flows into the request URL (CodeQL js/request-forgery, #215).
 */
const SEC_ENDPOINTS = {
  tickers: () => 'https://www.sec.gov/files/company_tickers.json',
  companyFacts: (cik: number) =>
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`,
} as const;

/**
 * Performs the actual HTTPS GET to a server-constructed SEC URL, handling GZip.
 * `url` here is always built from SEC_ENDPOINTS (constant host + integer CIK),
 * never from a user-supplied string.
 */
function httpsGetJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
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
 * Fetches a SEC endpoint by server-controlled key. The endpoint URL is built
 * entirely from SEC_ENDPOINTS constants; the only variable — cik — is coerced
 * to a Number so no user-supplied string can influence the request URL.
 * This is the SSRF barrier (CodeQL js/request-forgery, #215): callers never
 * pass a URL, only an allow-listed endpoint key.
 *
 * @param endpoint - 'tickers' | 'companyFacts'
 * @param cik - required numeric CIK for 'companyFacts'
 */
export function fetchFromSec(
  endpoint: keyof typeof SEC_ENDPOINTS,
  cik?: number
): Promise<unknown> {
  if (endpoint === 'companyFacts') {
    if (!Number.isInteger(cik) || (cik as number) < 0) {
      return Promise.reject(new Error('companyFacts requires a non-negative integer CIK'));
    }
    return httpsGetJson(SEC_ENDPOINTS.companyFacts(cik as number));
  }
  return httpsGetJson(SEC_ENDPOINTS.tickers());
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
    const data = await fetchFromSec('tickers');
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
