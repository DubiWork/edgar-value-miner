import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockSet, mockGet, mockDocFn, mockCollectionFn } = vi.hoisted(() => ({
  mockSet: vi.fn(),
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

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: mockCollectionFn,
  })),
  FieldValue: {
    serverTimestamp: vi.fn(() => ({ _isServerTimestamp: true })),
  },
}));

vi.mock('../functions/secProxy.js', () => ({
  fetchFromSec: mockFetchFromSec,
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------
import { cacheWriterHandler } from '../functions/cacheWriter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeDocRef(exists: boolean) {
  const docRef = {
    get: mockGet,
    set: mockSet,
  };
  mockGet.mockResolvedValue({ exists });
  mockSet.mockResolvedValue(undefined);
  mockDocFn.mockReturnValue(docRef);
  mockCollectionFn.mockReturnValue({ doc: mockDocFn });
  return docRef;
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

  it('skips write and returns updated:false when doc already exists', async () => {
    makeDocRef(true);

    const result = await cacheWriterHandler(makeReq({ ticker: 'AAPL', cik: 320193 }));

    expect(mockFetchFromSec).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(result).toEqual({ ticker: 'AAPL', latestFiledDate: null, updated: false });
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
});
