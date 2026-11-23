import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Declare mockGet with vi.hoisted so it is available when vi.mock factories run
// (vi.mock calls are hoisted to the top of the file by Vitest's transformer).
// ---------------------------------------------------------------------------
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

// ---------------------------------------------------------------------------
// Mock firebase-functions before any imports that pull it in
// ---------------------------------------------------------------------------
vi.mock('firebase-functions', () => ({
  default: {},
  https: { onRequest: vi.fn() },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock the Node.js https module to avoid real network calls.
// ---------------------------------------------------------------------------
vi.mock('https', () => ({
  default: { get: mockGet },
  get: mockGet,
}));

// ---------------------------------------------------------------------------
// Mock zlib
// ---------------------------------------------------------------------------
vi.mock('zlib', async () => {
  const actual = await vi.importActual<typeof import('zlib')>('zlib');
  return {
    ...actual,
    default: actual,
    createGunzip: vi.fn(),
    createInflate: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Helpers to build mock req/res objects
// ---------------------------------------------------------------------------
function makeReq(method = 'GET', query: Record<string, string> = {}): {
  method: string;
  query: Record<string, string>;
} {
  return { method, query };
}

type MockRes = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (code: number) => MockRes;
  json: (body: unknown) => MockRes;
  send: (body: unknown) => MockRes;
  set: (key: string, value: string) => MockRes;
};

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
    set(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Helpers to simulate SEC HTTP responses via the mockGet stub
// ---------------------------------------------------------------------------
type MockIncomingMessage = EventEmitter & {
  statusCode: number;
  headers: Record<string, string>;
  resume?: () => void;
};

function mockSecSuccess(payload: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGet.mockImplementationOnce((_url: any, _opts: any, cb: (res: MockIncomingMessage) => void) => {
    const body = JSON.stringify(payload);
    const resEmitter = new EventEmitter() as MockIncomingMessage;
    resEmitter.statusCode = 200;
    resEmitter.headers = {};

    process.nextTick(() => {
      cb(resEmitter);
      resEmitter.emit('data', Buffer.from(body));
      resEmitter.emit('end');
    });

    const reqEmitter = new EventEmitter();
    return reqEmitter;
  });
}

function mockSecError(statusCode: number): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGet.mockImplementationOnce((_url: any, _opts: any, cb: (res: MockIncomingMessage) => void) => {
    const resEmitter = new EventEmitter() as MockIncomingMessage;
    resEmitter.statusCode = statusCode;
    resEmitter.headers = {};
    resEmitter.resume = vi.fn();

    process.nextTick(() => cb(resEmitter));

    return new EventEmitter();
  });
}

// ---------------------------------------------------------------------------
// Import handlers AFTER mocks are in place
// ---------------------------------------------------------------------------
import {
  secTickersHandler,
  secCompanyFactsHandler,
  secCompanyConceptHandler,
  fetchFromSec,
  getSecTickersWithSource,
  clearTickersCacheForTesting,
  setBundledSnapshotEnabledForTesting,
  setRetryDelaysForTesting,
} from '../functions/secProxy.js';

function mockSecErrorWithHeaders(statusCode: number, headers: Record<string, string>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGet.mockImplementationOnce((_url: any, _opts: any, cb: (res: MockIncomingMessage) => void) => {
    const resEmitter = new EventEmitter() as MockIncomingMessage;
    resEmitter.statusCode = statusCode;
    resEmitter.headers = headers;
    resEmitter.resume = vi.fn();

    process.nextTick(() => cb(resEmitter));

    return new EventEmitter();
  });
}

// ---------------------------------------------------------------------------
// Tests: fetchFromSec is SSRF-safe by construction (#215)
// Callers pass a server-controlled endpoint key + a numeric CIK — never a URL.
// ---------------------------------------------------------------------------
describe('fetchFromSec SSRF-safe endpoint API', () => {
  beforeEach(() => {
    mockGet.mockReset();
    clearTickersCacheForTesting();
    setBundledSnapshotEnabledForTesting(false);
    setRetryDelaysForTesting([]);
  });

  afterEach(() => {
    setBundledSnapshotEnabledForTesting(true);
    setRetryDelaysForTesting(null);
  });

  it('builds the tickers URL from constants (host www.sec.gov)', () => {
    fetchFromSec('tickers').catch(() => {});
    expect(mockGet).toHaveBeenCalled();
    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://www.sec.gov/files/company_tickers.json');
  });

  it('builds the companyFacts URL from a numeric CIK (host data.sec.gov, padded)', () => {
    fetchFromSec('companyFacts', 320193).catch(() => {});
    expect(mockGet).toHaveBeenCalled();
    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json');
  });

  it.each([
    undefined,
    -1,
    1.5,
    NaN,
  ])('rejects a non-integer/negative CIK (%s) without calling https.get', async (badCik) => {
    await expect(fetchFromSec('companyFacts', badCik as number)).rejects.toThrow();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('builds the companyConcept URL from numeric CIK, namespace, and tag', () => {
    fetchFromSec('companyConcept', 1594805, 'us-gaap', 'Revenues').catch(() => {});
    expect(mockGet).toHaveBeenCalled();
    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://data.sec.gov/api/xbrl/companyconcept/CIK0001594805/us-gaap/Revenues.json');
  });

  it.each([
    ['invalid namespace with slash', 1594805, 'us/gaap', 'Revenues'],
    ['namespace path traversal', 1594805, '../evil', 'Revenues'],
    ['invalid tag with slash', 1594805, 'us-gaap', 'Revenues/extra'],
    ['tag path traversal', 1594805, 'us-gaap', '../../secret'],
    ['empty tag', 1594805, 'us-gaap', ''],
  ])('rejects malicious or invalid concept input: %s', async (_name, cik, ns, tag) => {
    await expect(fetchFromSec('companyConcept', cik, ns, tag)).rejects.toThrow();
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: secTickersHandler
// ---------------------------------------------------------------------------
describe('secTickersHandler', () => {
  beforeEach(() => {
    mockGet.mockReset();
    clearTickersCacheForTesting();
    setBundledSnapshotEnabledForTesting(false);
    setRetryDelaysForTesting([]);
  });

  afterEach(() => {
    setBundledSnapshotEnabledForTesting(true);
    setRetryDelaysForTesting(null);
  });

  it('returns 405 for non-GET methods', async () => {
    const req = makeReq('POST');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({ error: 'Method Not Allowed' });
  });

  it('responds to OPTIONS preflight with 204', async () => {
    const req = makeReq('OPTIONS');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.statusCode).toBe(204);
  });

  it('sets CORS headers on every response', async () => {
    const req = makeReq('OPTIONS');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('returns 200 with SEC tickers data on success', async () => {
    const payload = { '0': { cik_str: '320193', ticker: 'AAPL', title: 'Apple Inc.' } };
    mockSecSuccess(payload);

    const req = makeReq('GET');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
  });

  it('sets Cache-Control header for 24 hours on success', async () => {
    const payload = { '0': { cik_str: '320193', ticker: 'AAPL', title: 'Apple Inc.' } };
    mockSecSuccess(payload);

    const req = makeReq('GET');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.headers['Cache-Control']).toContain('max-age=86400');
  });

  it('returns 502 when SEC API returns an error status and fallback snapshot is disabled', async () => {
    mockSecError(503);

    const req = makeReq('GET');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Failed to fetch') });
  });

  it('serves subsequent requests from 24h in-memory cache without re-calling SEC', async () => {
    const payload = { '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' } };
    mockSecSuccess(payload);

    const req1 = makeReq('GET');
    const res1 = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req1 as any, res1 as any);

    expect(res1.statusCode).toBe(200);
    expect(res1.headers['X-Tickers-Source']).toBe('sec-live');

    const req2 = makeReq('GET');
    const res2 = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req2 as any, res2 as any);

    expect(res2.statusCode).toBe(200);
    expect(res2.headers['X-Tickers-Source']).toBe('memory');
    expect(res2.body).toEqual(payload);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent in-flight ticker directory requests', async () => {
    const payload = { '0': { cik_str: 789019, ticker: 'MSFT', title: 'Microsoft Corp' } };
    mockSecSuccess(payload);

    const [r1, r2] = await Promise.all([getSecTickersWithSource(), getSecTickersWithSource()]);

    expect(r1.data).toEqual(payload);
    expect(r2.data).toEqual(payload);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('retries transient SEC 429 responses and succeeds on subsequent 200', async () => {
    setRetryDelaysForTesting([1, 1]);
    const payload = { '0': { cik_str: 1000184, ticker: 'SAP', title: 'SAP SE' } };
    mockSecErrorWithHeaders(429, { 'retry-after': '0' });
    mockSecSuccess(payload);

    const req = makeReq('GET');
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Tickers-Source']).toBe('sec-live');
    expect(res.body).toEqual(payload);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('falls back to bundled gzip snapshot returning 200 with SAP and BRK-B when SEC returns 429', async () => {
    setBundledSnapshotEnabledForTesting(true);
    mockSecError(429);

    const req = makeReq('GET');
    const res = makeRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Tickers-Source']).toBe('bundled-snapshot');
    const entries = Object.values(res.body as Record<string, { cik_str: number; ticker: string; title: string }>);
    expect(entries.length).toBeGreaterThan(5000);
    expect(entries.some((e) => e.ticker === 'SAP' && e.cik_str === 1000184)).toBe(true);
    expect(entries.some((e) => e.ticker === 'BRK-B' && e.cik_str === 1067983)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: secCompanyFactsHandler
// ---------------------------------------------------------------------------
describe('secCompanyFactsHandler', () => {
  beforeEach(() => {
    mockGet.mockReset();
    setRetryDelaysForTesting([]);
  });

  afterEach(() => {
    setRetryDelaysForTesting(null);
  });

  it('returns 400 when cik query param is missing', async () => {
    const req = makeReq('GET', {});
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('cik') });
  });

  it('returns 400 when cik is not numeric', async () => {
    const req = makeReq('GET', { cik: 'AAPL' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
  });

  it('returns 405 for non-GET methods', async () => {
    const req = makeReq('POST', { cik: '320193' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(405);
  });

  it('responds to OPTIONS preflight with 204', async () => {
    const req = makeReq('OPTIONS', {});
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(204);
  });

  it('pads CIK to 10 digits and fetches correct URL', async () => {
    const payload = { facts: {}, cik: 320193 };
    mockSecSuccess(payload);

    const req = makeReq('GET', { cik: '320193' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(mockGet).toHaveBeenCalledOnce();
    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toContain('CIK0000320193.json');
  });

  it('returns 200 with company facts data on success', async () => {
    const payload = { facts: { 'us-gaap': {} }, cik: 320193 };
    mockSecSuccess(payload);

    const req = makeReq('GET', { cik: '320193' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
  });

  it('sets Cache-Control header for 24 hours on success', async () => {
    const payload = { facts: {}, cik: 320193 };
    mockSecSuccess(payload);

    const req = makeReq('GET', { cik: '320193' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.headers['Cache-Control']).toContain('max-age=86400');
  });

  it('returns 404 when SEC returns 404 for unknown CIK', async () => {
    mockSecError(404);

    const req = makeReq('GET', { cik: '9999999999' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining('not found') });
  });

  it('returns 502 when SEC returns a server error', async () => {
    mockSecError(503);

    const req = makeReq('GET', { cik: '320193' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(502);
  });

  it('sets CORS headers on every response', async () => {
    const req = makeReq('OPTIONS', {});
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('accepts a CIK that is already 10 digits', async () => {
    const payload = { facts: {}, cik: 320193 };
    mockSecSuccess(payload);

    const req = makeReq('GET', { cik: '0000320193' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyFactsHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toContain('CIK0000320193.json');
  });
});

// ---------------------------------------------------------------------------
// Tests: secCompanyConceptHandler
// ---------------------------------------------------------------------------
describe('secCompanyConceptHandler', () => {
  beforeEach(() => {
    mockGet.mockReset();
    setRetryDelaysForTesting([]);
  });

  afterEach(() => {
    setRetryDelaysForTesting(null);
  });

  it('returns 405 for non-GET methods', async () => {
    const req = makeReq('POST');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({ error: 'Method Not Allowed' });
  });

  it('responds to OPTIONS preflight with 204', async () => {
    const req = makeReq('OPTIONS');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(204);
  });

  it('sets CORS headers on every response', async () => {
    const req = makeReq('OPTIONS');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('returns 400 when cik query param is missing', async () => {
    const req = makeReq('GET', { tag: 'Revenues' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('numeric CIK') });
  });

  it.each(['abc', '-1', '12.34', '   '])(
    'returns 400 when cik query param is non-numeric (%s)',
    async (badCik) => {
      const req = makeReq('GET', { cik: badCik, tag: 'Revenues' });
      const res = makeRes();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await secCompanyConceptHandler(req as any, res as any);

      expect(res.statusCode).toBe(400);
    }
  );

  it('returns 400 when namespace contains invalid characters', async () => {
    const req = makeReq('GET', { cik: '1594805', namespace: '../bad/ns', tag: 'Revenues' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Invalid "namespace"') });
  });

  it('returns 400 when tag query param is missing', async () => {
    const req = makeReq('GET', { cik: '1594805', namespace: 'us-gaap' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Missing or invalid "tag"') });
  });

  it.each(['', '   ', '../evil', 'tag/slash', 'tag.json'])(
    'returns 400 when tag is invalid (%s)',
    async (badTag) => {
      const req = makeReq('GET', { cik: '1594805', namespace: 'us-gaap', tag: badTag });
      const res = makeRes();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await secCompanyConceptHandler(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ error: expect.stringContaining('tag') });
    }
  );

  it('defaults namespace to us-gaap when namespace param is omitted', async () => {
    const payload = { tag: 'Revenues', units: {} };
    mockSecSuccess(payload);

    const req = makeReq('GET', { cik: '1594805', tag: 'Revenues' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(mockGet).toHaveBeenCalledOnce();
    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://data.sec.gov/api/xbrl/companyconcept/CIK0001594805/us-gaap/Revenues.json');
  });

  it('pads CIK to 10 digits in outbound SEC request', async () => {
    const payload = { tag: 'Revenues' };
    mockSecSuccess(payload);

    const req = makeReq('GET', { cik: '320193', namespace: 'us-gaap', tag: 'Revenues' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    const calledUrl = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toContain('CIK0000320193/us-gaap/Revenues.json');
  });

  it('returns 200 with company concept data on success', async () => {
    const payload = { entityName: 'Shopify Inc.', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax', units: {} };
    mockSecSuccess(payload);

    const req = makeReq('GET', {
      cik: '1594805',
      namespace: 'us-gaap',
      tag: 'RevenueFromContractWithCustomerExcludingAssessedTax',
    });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
  });

  it('sets Cache-Control header for 24 hours on success', async () => {
    const payload = { tag: 'Revenues' };
    mockSecSuccess(payload);

    const req = makeReq('GET', { cik: '1594805', tag: 'Revenues' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.headers['Cache-Control']).toContain('max-age=86400');
  });

  it('returns 404 when SEC returns 404 for unknown concept or CIK', async () => {
    mockSecError(404);

    const req = makeReq('GET', { cik: '1594805', namespace: 'us-gaap', tag: 'NonExistentTag' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ error: expect.stringContaining('not found') });
  });

  it('returns 502 when SEC returns a server error', async () => {
    mockSecError(500);

    const req = makeReq('GET', { cik: '1594805', tag: 'Revenues' });
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secCompanyConceptHandler(req as any, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Failed to fetch SEC company concept') });
  });
});

