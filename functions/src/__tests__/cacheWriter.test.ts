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
// Import handler after mocks
// ---------------------------------------------------------------------------
import { cacheWriterHandler } from '../functions/cacheWriter.js';
import { Timestamp } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeDocRef(exists: boolean, data: Record<string, unknown> = {}) {
  const docRef = {
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
  };
  mockGet.mockResolvedValue({ exists, data: () => data });
  mockSet.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockDocFn.mockReturnValue(docRef);
  mockCollectionFn.mockReturnValue({ doc: mockDocFn });
  return docRef;
}

function daysAgo(days: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new (Timestamp as any)(d);
}

function makeCompanyFacts(filed = '2024-11-01') {
  return {
    cik: 320193,
    entityName: 'Apple Inc.',
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

function makeReq(data: unknown) {
  return { data } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('cacheWriterHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches SEC JSON and writes to Firestore when no doc exists', async () => {
    const facts = makeCompanyFacts('2024-11-01');
    mockFetchFromSec.mockResolvedValue(facts);
    makeDocRef(false);

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL', cik: 320193 }));

    expect(mockFetchFromSec).toHaveBeenCalledWith('companyFacts', 320193);
    expect(mockSet).toHaveBeenCalledOnce();
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData).toMatchObject({
      ticker: 'AAPL',
      cik: '0000320193',
      companyFacts: facts,
      latestFiledDate: '2024-11-01',
      needsRefresh: false,
    });
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: true });
  });

  it('skips write and returns updated:false when doc already exists and is within 90 days', async () => {
    makeDocRef(true, { lastUpdated: daysAgo(1), latestFiledDate: '2024-11-01' });

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL', cik: 320193 }));

    expect(mockFetchFromSec).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: false });
  });

  it('normalizes ticker to uppercase', async () => {
    const facts = makeCompanyFacts();
    mockFetchFromSec.mockResolvedValue(facts);
    makeDocRef(false);

    const result = await cacheWriterHandler(makeReq({ ticker: 'aapl', cik: 320193 }));

    expect(result.ticker).toBe('AAPL');
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData.ticker).toBe('AAPL');
  });

  it('throws when ticker is missing', async () => {
    await expect(
      cacheWriterHandler(makeReq({ cik: 320193 }))
    ).rejects.toThrow('ticker');
  });

  it('throws when cik is not a valid integer', async () => {
    await expect(
      cacheWriterHandler(makeReq({ ticker: 'AAPL', cik: 'notanumber' }))
    ).rejects.toThrow('cik');
  });

  // --- Staleness branches ---

  it('updates timestamp only when stale but latestFiledDate unchanged', async () => {
    const facts = makeCompanyFacts('2024-11-01');
    mockFetchFromSec.mockResolvedValue(facts);
    makeDocRef(true, { lastUpdated: daysAgo(100), latestFiledDate: '2024-11-01' });

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL', cik: 320193 }));

    expect(mockFetchFromSec).toHaveBeenCalledOnce();
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledOnce();
    const [updateData] = mockUpdate.mock.calls[0];
    expect(updateData).not.toHaveProperty('companyFacts');
    expect(updateData).toHaveProperty('lastUpdated');
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2024-11-01', updated: false });
  });

  it('replaces full blob when stale and latestFiledDate changed', async () => {
    const facts = makeCompanyFacts('2025-02-01');
    mockFetchFromSec.mockResolvedValue(facts);
    makeDocRef(true, { lastUpdated: daysAgo(100), latestFiledDate: '2024-11-01' });

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL', cik: 320193 }));

    expect(mockFetchFromSec).toHaveBeenCalledOnce();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledOnce();
    const [writeData] = mockSet.mock.calls[0];
    expect(writeData).toMatchObject({
      companyFacts: facts,
      latestFiledDate: '2025-02-01',
    });
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: '2025-02-01', updated: true });
  });

  it('throws when companyFacts blob exceeds Firestore size limit', async () => {
    const largeFacts = { facts: { 'us-gaap': { x: 'a'.repeat(950_000) } } };
    mockFetchFromSec.mockResolvedValue(largeFacts);
    makeDocRef(false);

    await expect(
      cacheWriterHandler(makeReq({ ticker: 'AAPL', cik: 320193 }))
    ).rejects.toThrow('too large for Firestore');
    expect(mockSet).not.toHaveBeenCalled();
  });
});
