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
  CACHE_WRITER_OPTIONS,
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
};

function daysAgo(days: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new (Timestamp as any)(d);
}

function makeCompanyFacts(filed = '2024-11-01', entityName = 'Apple Inc.') {
  return {
    cik: 320193,
    entityName,
    facts: {
      'us-gaap': {
        Assets: {
          units: {
            USD: [{ filed, end: '2024-09-28', val: 364980000000, form: '10-K', accn: '0000320193-24-000123', fy: 2024, fp: 'FY', frame: 'CY2024Q3I' }],
          },
        },
      },
    },
  };
}

function mockSecResponses(facts: any = makeCompanyFacts(), tickers: any = defaultTickersData) {
  mockFetchFromSec.mockImplementation((endpoint: string) => {
    if (endpoint === 'tickers') return Promise.resolve(tickers);
    if (endpoint === 'companyFacts') return Promise.resolve(facts);
    return Promise.resolve({});
  });
}

function makeReq(data: unknown) {
  return { data } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('cacheWriterHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTickersCacheForTesting();
    mockSecResponses();
  });

  it('fetches SEC JSON and writes to Firestore with rawVersion: 1 and companyName when no doc exists', async () => {
    const facts = makeCompanyFacts('2024-11-01', 'Apple Inc.');
    mockSecResponses(facts);
    makeDocRef(false);

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

    expect(mockFetchFromSec).toHaveBeenCalledWith('tickers');
    expect(mockFetchFromSec).toHaveBeenCalledWith('companyFacts', 320193);
    expect(mockSet).toHaveBeenCalledOnce();
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData).toMatchObject({
      ticker: 'AAPL',
      cik: '0000320193',
      companyName: 'Apple Inc.',
      companyFacts: facts,
      latestFiledDate: '2024-11-01',
      rawVersion: 1,
      version: 1,
      needsRefresh: false,
      accessCount: 0,
      lastUpdated: { _isServerTimestamp: true },
    });
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: true });
  });

  it('skips write and returns updated:false when doc already exists and is within 90 days', async () => {
    makeDocRef(true, { lastUpdated: daysAgo(1), latestFiledDate: '2024-11-01' });

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

    expect(mockFetchFromSec).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: false });
  });

  it('normalizes ticker to uppercase', async () => {
    const facts = makeCompanyFacts();
    mockSecResponses(facts);
    makeDocRef(false);

    const result = await cacheWriterHandler(makeReq({ ticker: 'aapl' }));

    expect(result.ticker).toBe('AAPL');
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData.ticker).toBe('AAPL');
  });

  it('throws invalid-argument HttpsError when request data is missing', async () => {
    await expect(
      cacheWriterHandler({} as any)
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument HttpsError when ticker is missing or empty', async () => {
    await expect(
      cacheWriterHandler(makeReq({}))
    ).rejects.toThrow('ticker');

    await expect(
      cacheWriterHandler(makeReq({ ticker: '   ' }))
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws invalid-argument HttpsError when ticker is not a string', async () => {
    await expect(
      cacheWriterHandler(makeReq({ ticker: 12345 }))
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('throws not-found HttpsError when SEC returns 404', async () => {
    mockFetchFromSec.mockImplementation((endpoint: string) => {
      if (endpoint === 'tickers') return Promise.resolve(defaultTickersData);
      return Promise.reject(new Error('SEC API returned status 404 for https://data.sec.gov/...'));
    });
    makeDocRef(false);

    await expect(
      cacheWriterHandler(makeReq({ ticker: 'AAPL' }))
    ).rejects.toMatchObject({
      code: 'not-found',
      message: expect.stringContaining('not found in SEC database'),
    });
  });

  // --- Staleness branches ---

  it('updates timestamp only when stale but latestFiledDate unchanged', async () => {
    const facts = makeCompanyFacts('2024-11-01');
    mockSecResponses(facts);
    makeDocRef(true, { lastUpdated: daysAgo(100), latestFiledDate: '2024-11-01' });

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

    expect(mockFetchFromSec).toHaveBeenCalledWith('companyFacts', 320193);
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledOnce();
    const [updateData] = mockUpdate.mock.calls[0];
    expect(updateData).not.toHaveProperty('companyFacts');
    expect(updateData).toHaveProperty('lastUpdated');
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: false });
  });

  it('replaces full blob with rawVersion: 1 and companyName when stale and latestFiledDate changed', async () => {
    const facts = makeCompanyFacts('2025-02-01', 'Apple Inc.');
    mockSecResponses(facts);
    makeDocRef(true, {
      lastUpdated: daysAgo(100),
      latestFiledDate: '2024-11-01',
      accessCount: 12,
    });

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

    expect(mockFetchFromSec).toHaveBeenCalledWith('companyFacts', 320193);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledOnce();
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData).toMatchObject({
      ticker: 'AAPL',
      cik: '0000320193',
      companyName: 'Apple Inc.',
      companyFacts: facts,
      latestFiledDate: '2025-02-01',
      rawVersion: 1,
      version: 1,
      accessCount: 12,
      lastUpdated: { _isServerTimestamp: true },
    });
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2025-02-01', updated: true });
  });

  it('falls back companyName to ticker if entityName is not provided in companyFacts', async () => {
    const factsWithoutEntity = {
      cik: 320193,
      facts: {
        'us-gaap': {
          Assets: {
            units: {
              USD: [{ filed: '2024-11-01', end: '2024-09-28', val: 100 }],
            },
          },
        },
      },
    };
    mockSecResponses(factsWithoutEntity);
    makeDocRef(false);

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

    expect(result.updated).toBe(true);
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData.companyName).toBe('AAPL');
  });

  it('throws resource-exhausted HttpsError when companyFacts blob exceeds Firestore size limit (>900KB)', async () => {
    const largeFacts = { facts: { 'us-gaap': { x: 'a'.repeat(950_000) } } };
    mockSecResponses(largeFacts);
    makeDocRef(false);

    await expect(
      cacheWriterHandler(makeReq({ ticker: 'AAPL' }))
    ).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: expect.stringContaining('too large for Firestore'),
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('captures dei filing date when newer during handler execution', async () => {
    const multiTaxonomyFacts = {
      cik: 320193,
      entityName: 'Apple Inc.',
      facts: {
        'us-gaap': {
          Assets: {
            units: {
              USD: [{ filed: '2024-11-01', end: '2024-09-28', val: 100 }],
            },
          },
        },
        'dei': {
          EntityCommonStockSharesOutstanding: {
            units: {
              shares: [{ filed: '2024-11-15', end: '2024-10-18', val: 200 }],
            },
          },
        },
      },
    };
    mockSecResponses(multiTaxonomyFacts);
    makeDocRef(false);

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

    expect(result.latestFiledDate).toBe('2024-11-15');
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData.latestFiledDate).toBe('2024-11-15');
  });

  describe('Internal CIK resolution (Issue #281)', () => {
    const mockTickersData = {
      '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
      '1': { cik_str: 789019, ticker: 'MSFT', title: 'Microsoft Corp' },
    };

    it('resolves CIK internally from SEC tickers directory when cik is omitted', async () => {
      mockFetchFromSec.mockImplementation((endpoint: string, cik?: number) => {
        if (endpoint === 'tickers') return Promise.resolve(mockTickersData);
        if (endpoint === 'companyFacts' && cik === 320193) {
          return Promise.resolve(makeCompanyFacts('2024-11-01', 'Apple Inc.'));
        }
        return Promise.reject(new Error(`Unexpected endpoint ${endpoint}`));
      });
      makeDocRef(false);

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      expect(mockFetchFromSec).toHaveBeenCalledWith('tickers');
      expect(mockFetchFromSec).toHaveBeenCalledWith('companyFacts', 320193);
      expect(mockSet).toHaveBeenCalledOnce();
      const [writeData] = mockSet.mock.calls[0];
      expect(writeData.ticker).toBe('AAPL');
      expect(writeData.cik).toBe('0000320193');
      expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: true });
    });

    it('caches the tickers directory in memory across multiple invocations', async () => {
      mockFetchFromSec.mockImplementation((endpoint: string, cik?: number) => {
        if (endpoint === 'tickers') return Promise.resolve(mockTickersData);
        if (endpoint === 'companyFacts') {
          return Promise.resolve(makeCompanyFacts('2024-11-01', 'Test Inc.'));
        }
        return Promise.reject(new Error(`Unexpected endpoint ${endpoint}`));
      });

      makeDocRef(false);
      await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      makeDocRef(false);
      await cacheWriterHandler(makeReq({ ticker: 'MSFT' }));

      // fetchFromSec('tickers') must have been called only once due to 24h in-memory cache
      const tickerCalls = mockFetchFromSec.mock.calls.filter(([ep]) => ep === 'tickers');
      expect(tickerCalls).toHaveLength(1);
    });

    it('throws not-found HttpsError when ticker is not in the SEC tickers directory', async () => {
      mockFetchFromSec.mockImplementation((endpoint: string) => {
        if (endpoint === 'tickers') return Promise.resolve(mockTickersData);
        return Promise.reject(new Error(`Unexpected endpoint ${endpoint}`));
      });
      makeDocRef(false);

      await expect(
        cacheWriterHandler(makeReq({ ticker: 'NONEXISTENT' }))
      ).rejects.toMatchObject({
        code: 'not-found',
        message: expect.stringContaining('NONEXISTENT'),
      });
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('does not resolve CIK from SEC if document is already fresh in Firestore', async () => {
      makeDocRef(true, { lastUpdated: daysAgo(2), latestFiledDate: '2024-11-01' });

      const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL' }));

      // Because doc is fresh (<90 days), SEC is not contacted at all
      expect(mockFetchFromSec).not.toHaveBeenCalled();
      expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: false });
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests for extractLatestFiledDate
// ---------------------------------------------------------------------------
describe('extractLatestFiledDate', () => {
  it('returns null when facts is missing or invalid', () => {
    expect(extractLatestFiledDate({})).toBeNull();
    expect(extractLatestFiledDate({ facts: null } as any)).toBeNull();
    expect(extractLatestFiledDate({ facts: {} })).toBeNull();
    expect(extractLatestFiledDate({ facts: { 'us-gaap': null } } as any)).toBeNull();
  });

  it('extracts date across single taxonomy (us-gaap)', () => {
    const facts = makeCompanyFacts('2024-11-01');
    expect(extractLatestFiledDate(facts)).toBe('2024-11-01');
  });

  it('extracts maximum date across multiple taxonomies (us-gaap and dei)', () => {
    const multiTaxonomyFacts = {
      cik: 320193,
      entityName: 'Apple Inc.',
      facts: {
        'us-gaap': {
          Assets: {
            units: {
              USD: [{ filed: '2024-11-01', end: '2024-09-28', val: 100 }],
            },
          },
        },
        'dei': {
          EntityCommonStockSharesOutstanding: {
            units: {
              shares: [{ filed: '2024-11-20', end: '2024-10-18', val: 200 }],
            },
          },
        },
      },
    };
    expect(extractLatestFiledDate(multiTaxonomyFacts)).toBe('2024-11-20');
  });

  it('extracts date correctly from ifrs-full taxonomy', () => {
    const ifrsFacts = {
      cik: 123456,
      entityName: 'Global Corp',
      facts: {
        'ifrs-full': {
          Revenue: {
            units: {
              EUR: [{ filed: '2024-06-30', end: '2024-03-31', val: 50000 }],
            },
          },
        },
      },
    };
    expect(extractLatestFiledDate(ifrsFacts)).toBe('2024-06-30');
  });

  it('handles empty units gracefully', () => {
    const emptyFacts = {
      facts: {
        'us-gaap': {
          EmptyTag: {
            units: {},
          },
        },
      },
    };
    expect(extractLatestFiledDate(emptyFacts)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Options tests
// ---------------------------------------------------------------------------
describe('CACHE_WRITER_OPTIONS', () => {
  it('specifies memory 512MiB and timeout 60 seconds', () => {
    expect(CACHE_WRITER_OPTIONS).toEqual({
      memory: '512MiB',
      timeoutSeconds: 60,
    });
  });
});

