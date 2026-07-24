import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  logger: { error: vi.fn(), info: vi.fn() },
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
vi.mock('zlib', () => ({
  default: {},
  createGunzip: vi.fn(),
  createInflate: vi.fn(),
}));

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
import { secTickersHandler, secCompanyFactsHandler, fetchFromSec } from '../functions/secProxy.js';

// ---------------------------------------------------------------------------
// Tests: fetchFromSec SSRF host allowlist (#215)
// ---------------------------------------------------------------------------
describe('fetchFromSec SSRF guard', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it.each([
    'http://www.sec.gov/x',            // non-https
    'https://evil.example.com/x',       // disallowed host
    'https://data.sec.gov.evil.com/x',  // suffix trick
    'https://169.254.169.254/latest',   // cloud metadata
    'not a url',                        // unparseable
  ])('rejects non-SEC / unsafe URL %s without calling https.get', async (url) => {
    await expect(fetchFromSec(url)).rejects.toThrow();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it.each([
    'https://www.sec.gov/files/company_tickers.json',
    'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
  ])('permits approved SEC host %s (reaches https.get)', async (url) => {
    // https.get is mocked to never resolve; assert it was invoked, then abort.
    fetchFromSec(url).catch(() => {});
    await Promise.resolve();
    expect(mockGet).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: secTickersHandler
// ---------------------------------------------------------------------------
describe('secTickersHandler', () => {
  beforeEach(() => {
    mockGet.mockReset();
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

  it('returns 502 when SEC API returns an error status', async () => {
    mockSecError(503);

    const req = makeReq('GET');
    const res = makeRes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await secTickersHandler(req as any, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Failed to fetch') });
  });
});

// ---------------------------------------------------------------------------
// Tests: secCompanyFactsHandler
// ---------------------------------------------------------------------------
describe('secCompanyFactsHandler', () => {
  beforeEach(() => {
    mockGet.mockReset();
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
