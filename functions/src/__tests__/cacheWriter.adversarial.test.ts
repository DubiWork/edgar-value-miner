import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockSet, mockUpdate, mockGet, mockDocFn, mockCollectionFn } = vi.hoisted(() => ({
  mockSet: vi.fn(),
  mockUpdate: vi.fn(),
  mockGet: vi.fn(),
  mockDocFn: vi.fn(),
  mockCollectionFn: vi.fn(),
}));

const { mockFetchFromSec } = vi.hoisted(() => ({
  mockFetchFromSec: vi.fn(),
}));

vi.mock('firebase-functions', () => ({
  default: {},
  https: { onRequest: vi.fn() },
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('firebase-admin/firestore', () => {
  class MockTimestamp {
    constructor(private _date: Date) {}
    toDate() { return this._date; }
  }
  return {
    getFirestore: vi.fn(() => ({
      collection: mockCollectionFn,
    })),
    FieldValue: {
      serverTimestamp: vi.fn(() => ({ _isServerTimestamp: true })),
    },
    Timestamp: MockTimestamp,
  };
});

vi.mock('../functions/secProxy.js', () => ({
  fetchFromSec: mockFetchFromSec,
}));

// ---------------------------------------------------------------------------
// Import handler and utilities after mocks
// ---------------------------------------------------------------------------
import {
  cacheWriterHandler,
  extractLatestFiledDate,
  CacheWriterResult,
  MS_PER_DAY,
  clearTickersCacheForTesting,
} from '../functions/cacheWriter.js';
import { Timestamp } from 'firebase-admin/firestore';
import { setupDocRefMock } from './testHelpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeDocRef = (exists: boolean, data: Record<string, unknown> = {}) =>
  setupDocRefMock({ mockGet, mockSet, mockUpdate, mockDocFn, mockCollectionFn }, exists, data);

const defaultTickersData = {
  '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
  '1': { cik_str: 789019, ticker: 'MSFT', title: 'Microsoft Corp' },
  '2': { cik_str: 1840000, ticker: 'FFC', title: 'Foreign Filer Corp' },
  '3': { cik_str: 0, ticker: 'ZERO', title: 'Zero Cik Corp' },
};

function mockSecResponses(facts: any = {}, tickers = defaultTickersData) {
  mockFetchFromSec.mockImplementation((endpoint: string) => {
    if (endpoint === 'tickers') return Promise.resolve(tickers);
    if (endpoint === 'companyFacts') return Promise.resolve(facts);
    return Promise.resolve({});
  });
}

function timestampDaysAgo(days: number, extraMs = 0): Timestamp {
  const d = new Date(Date.now() - (days * MS_PER_DAY + extraMs));
  return new (Timestamp as any)(d);
}

function makeReq(data: unknown) {
  return { data } as any;
}

// ---------------------------------------------------------------------------
// Adversarial & Boundary Test Suite
// ---------------------------------------------------------------------------
describe('cacheWriter Adversarial Challenge Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTickersCacheForTesting();
    mockSecResponses();
  });

  // =========================================================================
  // Challenge 1: Taxonomy Boundary Conditions (facts with no us-gaap, DEI only)
  // =========================================================================
  describe('Challenge 1: Taxonomy & Date Extraction Boundaries', () => {
    it('extracts latest filing date when facts has NO us-gaap but has dei facts', async () => {
      const deiOnlyFacts = {
        cik: 320193,
        entityName: 'Apple Inc.',
        facts: {
          dei: {
            EntityCommonStockSharesOutstanding: {
              units: {
                shares: [
                  { filed: '2024-10-15', end: '2024-10-10', val: 15000000 },
                  { filed: '2024-10-25', end: '2024-10-18', val: 15200000 },
                ],
              },
            },
          },
        },
      };

      const extractedDate = extractLatestFiledDate(deiOnlyFacts);
      expect(extractedDate).toBe('2024-10-25');

      // Now verify end-to-end execution in cacheWriterHandler
      mockSecResponses(deiOnlyFacts);
      makeDocRef(false);

      const result: CacheWriterResult = await cacheWriterHandler(
        makeReq({ ticker: 'AAPL' })
      );

      expect(result).toEqual({
        ticker: 'AAPL',
        latestFiledDate: '2024-10-25',
        updated: true,
      });

      expect(mockSet).toHaveBeenCalledOnce();
      const [docData] = mockSet.mock.calls[0];
      expect(docData.latestFiledDate).toBe('2024-10-25');
    });

    it('extracts latest filing date from ifrs-full when us-gaap is absent (Foreign Private Issuer)', async () => {
      const ifrsOnlyFacts = {
        cik: 1840000,
        entityName: 'Foreign Filer Corp',
        facts: {
          'ifrs-full': {
            ProfitLoss: {
              units: {
                EUR: [
                  { filed: '2023-06-30', end: '2023-03-31', val: 100000 },
                  { filed: '2024-03-31', end: '2023-12-31', val: 400000 },
                ],
              },
            },
          },
        },
      };

      expect(extractLatestFiledDate(ifrsOnlyFacts)).toBe('2024-03-31');

      mockSecResponses(ifrsOnlyFacts);
      makeDocRef(false);

      const result = await cacheWriterHandler(makeReq({ ticker: 'FFC' }));
      expect(result.latestFiledDate).toBe('2024-03-31');
      expect(result.updated).toBe(true);
    });

    it('handles facts with arbitrary custom taxonomy and malformed unit entries gracefully', () => {
      const complexFacts = {
        facts: {
          'custom-extension': {
            CustomMetric: {
              units: {
                items: [
                  null, // null entry
                  {}, // entry without filed
                  { filed: 12345 }, // invalid non-string filed
                  { filed: '' }, // empty string filed
                  { filed: '2024-08-01' }, // valid date
                ],
              },
            },
          },
          'malformed-tax': 'not-an-object',
          'null-tax': null,
          'empty-tax': {},
        },
      };

      expect(extractLatestFiledDate(complexFacts as any)).toBe('2024-08-01');
    });
  });

  // =========================================================================
  // Challenge 2: Company Facts Blob Size (900KB vs 900,001 bytes)
  // =========================================================================
  describe('Challenge 2: Blob Size Boundary Conditions (900,000 vs 900,001 bytes)', () => {
    function generatePayloadOfSize(targetBytes: number) {
      // Base shell
      const base = {
        cik: 320193,
        entityName: 'Apple Inc.',
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2024-11-01', val: 1 }] } } }, pad: '' },
      };
      const baseLen = Buffer.byteLength(JSON.stringify(base), 'utf8');
      const neededPad = targetBytes - baseLen;
      (base.facts as any).pad = 'x'.repeat(neededPad);
      return base;
    }

    it('accepts a company facts blob of exactly 900,000 bytes', async () => {
      const exact900k = generatePayloadOfSize(900_000);
      expect(Buffer.byteLength(JSON.stringify(exact900k), 'utf8')).toBe(900_000);

      mockSecResponses(exact900k);
      makeDocRef(false);

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));
      expect(result.updated).toBe(true);
      expect(mockSet).toHaveBeenCalledOnce();
    });

    it('rejects a company facts blob of exactly 900,001 bytes with resource-exhausted HttpsError on write', async () => {
      const over900k = generatePayloadOfSize(900_001);
      expect(Buffer.byteLength(JSON.stringify(over900k), 'utf8')).toBe(900_001);

      mockSecResponses(over900k);
      makeDocRef(false);

      await expect(
        cacheWriterHandler(makeReq({ ticker: 'AAPL' }))
      ).rejects.toMatchObject({
        code: 'resource-exhausted',
        message: expect.stringContaining('(900001 bytes)'),
      });

      expect(mockSet).not.toHaveBeenCalled();
    });

    it('bypasses blob size check when doc is stale but filing date has NOT changed (timestamp-only update)', async () => {
      // Over 900KB blob returned by SEC, but latestFiledDate is unchanged ('2024-11-01')
      const over900k = generatePayloadOfSize(900_001);
      mockSecResponses(over900k);
      makeDocRef(true, {
        lastUpdated: timestampDaysAgo(95),
        latestFiledDate: '2024-11-01',
      });

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      // Does NOT throw resource-exhausted because the blob is not written to Firestore!
      expect(result).toEqual({
        ticker: 'AAPL',
        latestFiledDate: '2024-11-01',
        updated: false,
      });
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Challenge 3: Staleness Boundary Conditions (89 days vs 90 days vs 91 days)
  // =========================================================================
  describe('Challenge 3: Staleness Boundary Conditions (89 vs 90 vs 91 days)', () => {
    it('treats 89 days ago as fresh (< 90 days), skipping SEC fetch completely', async () => {
      makeDocRef(true, {
        lastUpdated: timestampDaysAgo(89),
        latestFiledDate: '2024-11-01',
      });

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      expect(mockFetchFromSec).not.toHaveBeenCalled();
      expect(mockSet).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result).toEqual({
        ticker: 'AAPL',
        latestFiledDate: '2024-11-01',
        updated: false,
      });
    });

    it('treats exactly 90 days ago (0 ms past) as fresh (strict > 90 days check)', async () => {
      makeDocRef(true, {
        lastUpdated: timestampDaysAgo(90, 0),
        latestFiledDate: '2024-11-01',
      });

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      expect(mockFetchFromSec).not.toHaveBeenCalled();
      expect(result.updated).toBe(false);
    });

    it('treats 90 days + 1 ms ago as stale, triggering Tier 2 SEC fetch', async () => {
      mockSecResponses({
        cik: 320193,
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2024-11-01', val: 10 }] } } } },
      });
      makeDocRef(true, {
        lastUpdated: timestampDaysAgo(90, 1),
        latestFiledDate: '2024-11-01',
      });

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      expect(mockFetchFromSec).toHaveBeenCalledWith('companyFacts', 320193);
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(result.updated).toBe(false);
    });

    it('treats 91 days ago as stale, triggering Tier 2 SEC fetch', async () => {
      mockSecResponses({
        cik: 320193,
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2024-11-01', val: 10 }] } } } },
      });
      makeDocRef(true, {
        lastUpdated: timestampDaysAgo(91),
        latestFiledDate: '2024-11-01',
      });

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      expect(mockFetchFromSec).toHaveBeenCalledWith('companyFacts', 320193);
      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(result.updated).toBe(false);
    });

    it('handles future lastUpdated (clock skew) gracefully without treating as stale', async () => {
      // Document with timestamp 5 days into future
      const futureTimestamp = new (Timestamp as any)(new Date(Date.now() + 5 * MS_PER_DAY));
      makeDocRef(true, {
        lastUpdated: futureTimestamp,
        latestFiledDate: '2024-11-01',
      });

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      expect(mockFetchFromSec).not.toHaveBeenCalled();
      expect(result.updated).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 4: SEC Status Code Handling (404 vs 500 vs 429)
  // =========================================================================
  describe('Challenge 4: SEC Status Code Handling', () => {
    it('maps SEC 404 to HttpsError not-found with human-readable message', async () => {
      mockFetchFromSec.mockImplementation((endpoint: string) => {
        if (endpoint === 'tickers') return Promise.resolve(defaultTickersData);
        return Promise.reject(
          new Error('SEC API returned status 404 for https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json')
        );
      });
      makeDocRef(false);

      await expect(
        cacheWriterHandler(makeReq({ ticker: 'AAPL' }))
      ).rejects.toMatchObject({
        code: 'not-found',
        message: 'Company with CIK 0000320193 not found in SEC database.',
      });
    });

    it('propagates SEC 500 internal server error for client fallback handling', async () => {
      mockFetchFromSec.mockImplementation((endpoint: string) => {
        if (endpoint === 'tickers') return Promise.resolve(defaultTickersData);
        return Promise.reject(
          new Error('SEC API returned status 500 for https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json')
        );
      });
      makeDocRef(false);

      await expect(
        cacheWriterHandler(makeReq({ ticker: 'AAPL' }))
      ).rejects.toThrow('SEC API returned status 500');
    });

    it('propagates SEC 429 rate limit exceeded error for client fallback handling', async () => {
      mockFetchFromSec.mockImplementation((endpoint: string) => {
        if (endpoint === 'tickers') return Promise.resolve(defaultTickersData);
        return Promise.reject(
          new Error('SEC API returned status 429 for https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json')
        );
      });
      makeDocRef(false);

      await expect(
        cacheWriterHandler(makeReq({ ticker: 'AAPL' }))
      ).rejects.toThrow('SEC API returned status 429');
    });

    it('propagates network connection reset/timeout errors', async () => {
      mockFetchFromSec.mockImplementation((endpoint: string) => {
        if (endpoint === 'tickers') return Promise.resolve(defaultTickersData);
        return Promise.reject(new Error('connect ETIMEDOUT 192.0.2.1:443'));
      });
      makeDocRef(false);

      await expect(
        cacheWriterHandler(makeReq({ ticker: 'AAPL' }))
      ).rejects.toThrow('connect ETIMEDOUT');
    });
  });

  // =========================================================================
  // Challenge 5: Ticker Normalization & Case Insensitivity
  // =========================================================================
  describe('Challenge 5: Ticker Normalization & Case Insensitivity', () => {
    it('normalizes lowercase ticker to uppercase in Firestore query, write, and return payload', async () => {
      mockSecResponses({
        cik: 320193,
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2024-11-01', val: 1 }] } } } },
      });
      makeDocRef(false);

      const result = await cacheWriterHandler(makeReq({ ticker: 'aapl' }));

      expect(mockDocFn).toHaveBeenCalledWith('AAPL');
      expect(result.ticker).toBe('AAPL');
      const [docData] = mockSet.mock.calls[0];
      expect(docData.ticker).toBe('AAPL');
    });

    it('trims leading and trailing whitespace while uppercasing', async () => {
      mockSecResponses({
        cik: 789019,
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2024-11-01', val: 1 }] } } } },
      });
      makeDocRef(false);

      const result = await cacheWriterHandler(makeReq({ ticker: '   msft   ' }));

      expect(mockDocFn).toHaveBeenCalledWith('MSFT');
      expect(result.ticker).toBe('MSFT');
    });
  });

  // =========================================================================
  // Challenge 6: Contract Return Structure & Firestore Document Schema
  // =========================================================================
  describe('Challenge 6: Contract Return Structure & Firestore Document Schema', () => {
    it('strictly satisfies { ticker, latestFiledDate, updated } contract structure across all 4 execution paths', async () => {
      const facts = {
        cik: 320193,
        entityName: 'Apple Inc.',
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2024-11-01', val: 1 }] } } } },
      };
      mockSecResponses(facts);

      // Path 1: Fresh doc creation
      makeDocRef(false);
      const res1 = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));
      expect(Object.keys(res1).sort()).toEqual(['latestFiledDate', 'ticker', 'updated']);
      expect(res1).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: true });

      // Path 2: Fresh doc hit (<90 days)
      makeDocRef(true, { lastUpdated: timestampDaysAgo(10), latestFiledDate: '2024-11-01' });
      const res2 = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));
      expect(Object.keys(res2).sort()).toEqual(['latestFiledDate', 'ticker', 'updated']);
      expect(res2).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: false });

      // Path 3: Stale doc hit (>90 days), SEC date unchanged
      makeDocRef(true, { lastUpdated: timestampDaysAgo(100), latestFiledDate: '2024-11-01' });
      const res3 = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));
      expect(Object.keys(res3).sort()).toEqual(['latestFiledDate', 'ticker', 'updated']);
      expect(res3).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: false });

      // Path 4: Stale doc hit (>90 days), SEC date newer
      mockSecResponses({
        cik: 320193,
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2025-01-15', val: 2 }] } } } },
      });
      makeDocRef(true, { lastUpdated: timestampDaysAgo(100), latestFiledDate: '2024-11-01' });
      const res4 = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));
      expect(Object.keys(res4).sort()).toEqual(['latestFiledDate', 'ticker', 'updated']);
      expect(res4).toEqual({ ticker: 'AAPL', latestFiledDate: '2025-01-15', updated: true });
    });

    it('writes all required schema properties matching EdgarCacheDoc specification', async () => {
      const facts = {
        cik: 320193,
        entityName: 'Apple Inc.',
        facts: { 'us-gaap': { Assets: { units: { USD: [{ filed: '2024-11-01', val: 1 }] } } } },
      };
      mockSecResponses(facts);
      makeDocRef(false);

      await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      const [writtenDoc] = mockSet.mock.calls[0];
      expect(writtenDoc).toEqual({
        ticker: 'AAPL',
        cik: '0000320193',
        companyName: 'Apple Inc.',
        companyFacts: facts,
        latestFiledDate: '2024-11-01',
        rawVersion: 1,
        version: 1,
        lastUpdated: { _isServerTimestamp: true },
        needsRefresh: false,
        accessCount: 0,
      });
    });
  });

  // =========================================================================
  // Challenge 7: CIK Validation & Boundary Checks
  // =========================================================================
  describe('Challenge 7: CIK Validation & Boundary Checks', () => {
    it('accepts cik: 0 and zero-pads to 10 zeros', async () => {
      mockSecResponses({ cik: 0, facts: {} });
      makeDocRef(false);

      const res = await cacheWriterHandler(makeReq({ ticker: 'ZERO' }));
      expect(res.updated).toBe(true);
      const [writtenDoc] = mockSet.mock.calls[0];
      expect(writtenDoc.cik).toBe('0000000000');
    });

    it('rejects missing or empty ticker', async () => {
      await expect(
        cacheWriterHandler(makeReq({}))
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        cacheWriterHandler(makeReq({ ticker: '   ' }))
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('rejects non-string ticker', async () => {
      await expect(
        cacheWriterHandler(makeReq({ ticker: 320193 }))
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });
});
