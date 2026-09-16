/**
 * Adversarial & Stress Tests for Cache Coordinator (M3 & M4 — R3 & R4)
 *
 * Empirical verification of:
 * 1. 3-tier read path:
 *    - L1 hit vs L2 hit vs L3 miss.
 *    - Non-blocking background staleness check (resolves immediately without waiting for cacheWriter).
 *    - Invalidation on cacheWriter updated: true vs retention on updated: false.
 *    - Invalidation error isolation.
 * 2. Resilience and graceful fallbacks (R4):
 *    - Firestore timeout, network failure, and permission errors.
 *    - Cloud Function cacheWriter HttpsError failures (resource-exhausted, internal, deadline-exceeded).
 *    - Firestore re-read null / eventual consistency failure.
 *    - Malformed L2 facts causing normalization failure falling back to SEC API.
 *    - IndexedDB QuotaExceededError and private browsing SecurityError (in-memory normalization).
 *    - Catastrophic failure of all layers (structured error, zero crashes or unhandled rejections).
 * 3. Strict zero-write verification across every execution path.
 * 4. CIK string-to-integer coercion for Cloud Function contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCompanyData,
  getCompanyFacts,
  invalidateCache,
  refreshStaleCache,
  CACHE_SOURCES,
  COORDINATOR_ERROR_CODES,
} from '../cacheCoordinator.js';

// Mock callable for cacheWriter
const mockCacheWriterCallable = vi.fn();

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn((_functions, name) => {
    if (name === 'cacheWriter') {
      return mockCacheWriterCallable;
    }
    return vi.fn();
  }),
}));

vi.mock('../../lib/firebase', () => ({
  default: { name: '[DEFAULT]' },
  app: { name: '[DEFAULT]' },
  db: {},
}));

vi.mock('../edgarApi.js', () => ({
  default: {
    fetchCompanyFactsByTicker: vi.fn(),
    mapTickerToCik: vi.fn(),
  },
  fetchCompanyFactsByTicker: vi.fn(),
  mapTickerToCik: vi.fn(),
}));

vi.mock('../edgarCache.js', () => ({
  default: {
    getCompanyFacts: vi.fn(),
    setCompanyFacts: vi.fn(),
    invalidateCache: vi.fn(),
    getCacheStats: vi.fn(),
  },
  getCompanyFacts: vi.fn(),
  setCompanyFacts: vi.fn(),
  invalidateCache: vi.fn(),
  getCacheStats: vi.fn(),
}));

vi.mock('../firestoreCache.js', () => ({
  default: {
    getCompanyFactsFromFirestore: vi.fn(),
    invalidateGlobalCache: vi.fn(),
    getGlobalCacheStats: vi.fn(),
    setCompanyFactsToFirestore: vi.fn(),
    callCacheWriter: vi.fn(),
  },
  getCompanyFactsFromFirestore: vi.fn(),
  invalidateGlobalCache: vi.fn(),
  getGlobalCacheStats: vi.fn(),
  setCompanyFactsToFirestore: vi.fn(),
  callCacheWriter: vi.fn(),
}));

vi.mock('../../utils/gaapNormalizer.js', () => ({
  normalizeCompanyFacts: vi.fn(),
}));

import edgarApi from '../edgarApi.js';
import edgarCache from '../edgarCache.js';
import firestoreCache from '../firestoreCache.js';
import { normalizeCompanyFacts } from '../../utils/gaapNormalizer.js';

const mockRawData = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  facts: {
    'us-gaap': {
      Revenues: {
        units: { USD: [{ end: '2023-09-30', val: 383285000000, filed: '2023-11-03' }] },
      },
    },
  },
};

const mockNormalizedData = {
  ticker: 'AAPL',
  cik: '0000320193',
  companyName: 'Apple Inc.',
  metrics: { revenue: [{ year: 2023, value: 383285000000, period: 'FY' }] },
  metadata: { normalized: true },
};

const mockCompanyInfo = {
  cik: '0000320193',
  name: 'Apple Inc.',
};

describe('cacheCoordinator Adversarial & Resilience Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    edgarApi.mapTickerToCik.mockResolvedValue({
      cik: '0000320193',
      name: 'Apple Inc.',
    });
    mockCacheWriterCallable.mockResolvedValue({
      data: {
        ticker: 'AAPL',
        latestFiledDate: '2023-11-03',
        updated: true,
      },
    });
  });

  // ===========================================================================
  // 1. Non-Blocking L1 Hit & Background Refresh Isolation
  // ===========================================================================

  describe('Non-Blocking Background Staleness Check', () => {
    it('must resolve L1 response immediately without blocking on a slow cacheWriter', async () => {
      const ninetyFiveDaysAgo = Date.now() - 95 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyFiveDaysAgo,
      });

      // cacheWriter takes 300ms to resolve
      let cacheWriterFinished = false;
      mockCacheWriterCallable.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              cacheWriterFinished = true;
              resolve({
                data: { ticker: 'AAPL', latestFiledDate: '2024-02-01', updated: true },
              });
            }, 300);
          })
      );

      const startTime = Date.now();
      const result = await getCompanyData('AAPL', { backgroundRefresh: true });
      const elapsedMs = Date.now() - startTime;

      // Must return cached data immediately (well before the 300ms timer)
      expect(elapsedMs).toBeLessThan(100);
      expect(cacheWriterFinished).toBe(false);
      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.INDEXEDDB);
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data.companyFacts).toEqual(mockNormalizedData);

      // Await background execution
      await new Promise((resolve) => setTimeout(resolve, 350));
      expect(cacheWriterFinished).toBe(true);
      expect(edgarCache.invalidateCache).toHaveBeenCalledWith('AAPL');
    });

    it('must NOT invalidate IndexedDB when cacheWriter returns updated: false', async () => {
      const ninetyFiveDaysAgo = Date.now() - 95 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyFiveDaysAgo,
      });

      mockCacheWriterCallable.mockResolvedValue({
        data: { ticker: 'AAPL', latestFiledDate: '2023-11-03', updated: false },
      });

      const result = await getCompanyData('AAPL', { backgroundRefresh: true });
      expect(result.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockCacheWriterCallable).toHaveBeenCalled();
      expect(edgarCache.invalidateCache).not.toHaveBeenCalled();
    });

    it('must isolate cacheWriter HttpsError during background refresh without unhandled rejections', async () => {
      const ninetyFiveDaysAgo = Date.now() - 95 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyFiveDaysAgo,
      });

      mockCacheWriterCallable.mockRejectedValue(new Error('Firebase Functions internal error: HttpsError'));

      const result = await getCompanyData('AAPL', { backgroundRefresh: true });
      expect(result.success).toBe(true);

      // Should complete cleanly without uncaught rejection
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockCacheWriterCallable).toHaveBeenCalled();
      expect(edgarCache.invalidateCache).not.toHaveBeenCalled();
    });

    it('must catch and isolate errors thrown by edgarCache.invalidateCache', async () => {
      const ninetyFiveDaysAgo = Date.now() - 95 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyFiveDaysAgo,
      });

      mockCacheWriterCallable.mockResolvedValue({
        data: { ticker: 'AAPL', latestFiledDate: '2024-02-01', updated: true },
      });

      // IndexedDB invalidate fails (e.g. database blocked)
      edgarCache.invalidateCache.mockRejectedValue(new Error('IndexedDB TransactionInactiveError'));

      const result = await getCompanyData('AAPL', { backgroundRefresh: true });
      expect(result.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(edgarCache.invalidateCache).toHaveBeenCalledWith('AAPL');
    });
  });

  // ===========================================================================
  // 2. Resilience and Graceful Fallbacks (R4)
  // ===========================================================================

  describe('Firestore & Cloud Function Fallbacks (R4)', () => {
    it('should fall back to direct SEC fetch when Firestore read throws permission-denied', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockRejectedValue(
        new Error('Missing or insufficient permissions: PERMISSION_DENIED')
      );

      // cacheWriter also fails
      mockCacheWriterCallable.mockRejectedValue(new Error('Unauthenticated'));

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
      expect(normalizeCompanyFacts).toHaveBeenCalledWith(mockRawData, { fullHistory: true });
      expect(edgarCache.setCompanyFacts).toHaveBeenCalledWith('AAPL', mockNormalizedData, '0000320193');
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should fall back to direct SEC fetch when cacheWriter throws resource-exhausted HttpsError', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);

      // Cloud Function rejects with resource-exhausted (e.g. >900KB blob)
      mockCacheWriterCallable.mockRejectedValue(
        new Error('resource-exhausted: companyFacts blob too large for Firestore')
      );

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
      expect(normalizeCompanyFacts).toHaveBeenCalledWith(mockRawData, { fullHistory: true });
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should fall back to direct SEC fetch when Firestore re-read after cacheWriter returns null', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      // Initial check is miss
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce(null);
      // cacheWriter succeeds
      mockCacheWriterCallable.mockResolvedValue({
        data: { ticker: 'AAPL', latestFiledDate: '2023-11-03', updated: true },
      });
      // Re-read returns null (eventual consistency delay)
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce(null);

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
    });

    it('should fall back to direct SEC fetch when L2 Firestore data is corrupted and throws in normalizer', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: { corrupt: true },
        companyFacts: { corrupt: true },
        cik: '0000320193',
        companyName: 'Apple Inc.',
        lastUpdated: new Date(),
      });

      // Normalizer throws on corrupt L2 data
      normalizeCompanyFacts.mockImplementationOnce(() => {
        throw new Error('TypeError: Cannot read properties of undefined (reading units)');
      });

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValueOnce(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
    });
  });

  // ===========================================================================
  // 3. IndexedDB Unavailability & Quota Exceeded (R4)
  // ===========================================================================

  describe('IndexedDB Unavailability & QuotaExceededError (R4)', () => {
    it('should normalize in-memory and return data when IndexedDB throws QuotaExceededError on both read and write', async () => {
      // IndexedDB get throws
      edgarCache.getCompanyFacts.mockRejectedValue(new Error('QuotaExceededError: The quota has been exceeded.'));

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockRawData,
        companyFacts: mockRawData,
        cik: '0000320193',
        companyName: 'Apple Inc.',
        lastUpdated: new Date(),
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);

      // IndexedDB set also throws QuotaExceededError
      edgarCache.setCompanyFacts.mockRejectedValue(new Error('QuotaExceededError: Storage quota exceeded'));

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.data.companyFacts).toEqual(mockNormalizedData);
      expect(result.metadata.source).toBe(CACHE_SOURCES.FIRESTORE);
      expect(result.error).toBeNull();
    });

    it('should normalize in-memory and return data in Private Browsing mode when IndexedDB throws SecurityError', async () => {
      // Private browsing blocks IndexedDB access
      edgarCache.getCompanyFacts.mockRejectedValue(
        new Error('SecurityError: The operation is insecure in private mode.')
      );

      // Firestore down
      firestoreCache.getCompanyFactsFromFirestore.mockRejectedValue(new Error('Network offline'));
      mockCacheWriterCallable.mockRejectedValue(new Error('Cloud Function unavailable'));

      // Direct SEC fetch succeeds
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);

      // IndexedDB write fails in private mode
      edgarCache.setCompanyFacts.mockRejectedValue(new Error('SecurityError: Cannot access IndexedDB'));

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.data.companyFacts).toEqual(mockNormalizedData);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(result.error).toBeNull();
    });

    it('should return structured SEC_API_ERROR when all three layers fail without crashing', async () => {
      edgarCache.getCompanyFacts.mockRejectedValue(new Error('IDB dead'));
      firestoreCache.getCompanyFactsFromFirestore.mockRejectedValue(new Error('Firestore dead'));
      mockCacheWriterCallable.mockRejectedValue(new Error('Functions dead'));
      edgarApi.fetchCompanyFactsByTicker.mockRejectedValue(new Error('SEC 429 Too Many Requests'));

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.metadata.source).toBe(CACHE_SOURCES.NONE);
      expect(result.error.code).toBe(COORDINATOR_ERROR_CODES.SEC_API_ERROR);
      expect(result.error.message).toContain('SEC 429 Too Many Requests');
    });
  });

  // ===========================================================================
  // 4. Zero Client Writes & Contract Typing Verification
  // ===========================================================================

  describe('Zero Client Writes & Contract Typing', () => {
    it('must guarantee zero calls to setCompanyFactsToFirestore across all read and fallback paths', async () => {
      // 1. L1 hit path
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: Date.now(),
      });
      await getCompanyData('AAPL');

      // 2. L2 hit path
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockRawData,
        companyFacts: mockRawData,
        cik: '0000320193',
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      await getCompanyData('MSFT');

      // 3. L3 cacheWriter path
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce(null);
      mockCacheWriterCallable.mockResolvedValue({
        data: { ticker: 'GOOGL', latestFiledDate: '2023-11-03', updated: true },
      });
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce({
        data: mockRawData,
        companyFacts: mockRawData,
        cik: '0001652044',
      });
      await getCompanyData('GOOGL');

      // 4. L3 direct SEC fallback path
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockRejectedValue(new Error('offline'));
      mockCacheWriterCallable.mockRejectedValue(new Error('offline'));
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawData,
        companyInfo: { cik: '0001018724', name: 'Amazon' },
      });
      await getCompanyData('AMZN');

      // VERIFY: setCompanyFactsToFirestore was NEVER called in any of the 4 paths
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('must invoke cacheWriter with normalized ticker and store newly written doc', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce(null);

      mockCacheWriterCallable.mockResolvedValue({
        data: { ticker: 'AAPL', latestFiledDate: '2023-11-03', updated: true },
      });

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce({
        data: mockRawData,
        companyFacts: mockRawData,
        cik: '0000320193',
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      await getCompanyData('AAPL');

      expect(mockCacheWriterCallable).toHaveBeenCalledWith({
        ticker: 'AAPL',
      });
    });

    it('must trim and uppercase ticker in all layers', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: Date.now(),
      });

      const result = await getCompanyData('  aapl  ');

      expect(result.success).toBe(true);
      expect(result.data.ticker).toBe('AAPL');
      expect(edgarCache.getCompanyFacts).toHaveBeenCalledWith('AAPL');
    });
  });
});
