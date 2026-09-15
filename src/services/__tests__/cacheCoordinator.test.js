/**
 * Tests for Cache Coordinator (3-tier hybrid cache)
 *
 * Tests cover:
 * - 3-tier cache hierarchy (IndexedDB → Firestore → SEC API)
 * - L1 IndexedDB hit returns cached normalized data immediately without Firestore query
 * - L2 Firestore hit normalizes raw blob with fullHistory: true, writes to IDB, returns
 * - L3 Firestore miss invokes cacheWriter Cloud Function, re-reads doc, normalizes with fullHistory: true, stores in IDB, returns
 * - Direct SEC fetch fallback on Firestore read failure or cacheWriter failure (R4 resilience)
 * - In-memory normalization fallback when IndexedDB is unavailable (R4 resilience)
 * - Zero write calls to Firestore from client (setCompanyFactsToFirestore never called)
 * - Background staleness check (>90 days old) triggers cacheWriter and invalidates IDB on updated: true
 * - Cache invalidation across layers
 * - Prefetch operations
 * - Cache statistics
 * - Concurrent request deduplication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCompanyData,
  getCompanyFacts,
  invalidateCache,
  getCacheStats,
  prefetchCompanies,
  refreshStaleCache,
  CACHE_SOURCES,
  COORDINATOR_ERROR_CODES,
} from '../cacheCoordinator.js';

// Mock callable function for cacheWriter Cloud Function
const mockCacheWriterCallable = vi.fn();

// Mock all dependencies
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

// Import mocked modules
import edgarApi from '../edgarApi.js';
import edgarCache from '../edgarCache.js';
import firestoreCache from '../firestoreCache.js';
import { normalizeCompanyFacts } from '../../utils/gaapNormalizer.js';

// =============================================================================
// Mock Data
// =============================================================================

const mockRawFirestoreData = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  facts: {
    'us-gaap': {
      Revenues: {
        label: 'Revenues',
        units: {
          USD: [{ end: '2023-09-30', val: 383285000000 }],
        },
      },
    },
  },
};

const mockNormalizedData = {
  ticker: 'AAPL',
  cik: '0000320193',
  companyName: 'Apple Inc.',
  metrics: { revenue: [{ year: 2023, value: 383285000000, period: 'FY' }] },
  metadata: { normalized: true, currency: 'USD' },
};

const mockCompanyInfo = {
  cik: '0000320193',
  name: 'Apple Inc.',
};

// =============================================================================
// Test Suite
// =============================================================================

describe('cacheCoordinator', () => {
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

  // =============================================================================
  // 3-Tier Cache Hierarchy (R3 & R4 Acceptance Criteria)
  // =============================================================================

  describe('3-Tier Cache Hierarchy', () => {
    it('should hit L1 (IndexedDB) first and return cached normalized data immediately without querying Firestore', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: Date.now(),
      });

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.INDEXEDDB);
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data.companyName).toBe('Apple Inc.');
      expect(result.data.companyFacts).toEqual(mockNormalizedData);

      // Should NOT call Firestore or SEC API or cacheWriter
      expect(firestoreCache.getCompanyFactsFromFirestore).not.toHaveBeenCalled();
      expect(mockCacheWriterCallable).not.toHaveBeenCalled();
      expect(edgarApi.fetchCompanyFactsByTicker).not.toHaveBeenCalled();
      // Verify zero write calls to Firestore
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should fall through to L2 (Firestore) on L1 miss, normalize raw blob with fullHistory: true, write to IDB, and return', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null); // L1 miss

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockRawFirestoreData,
        companyFacts: mockRawFirestoreData,
        cik: '0000320193',
        companyName: 'Apple Inc.',
        needsRefresh: false,
        lastUpdated: new Date(),
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.FIRESTORE);
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data.companyName).toBe('Apple Inc.');

      // Should normalize with fullHistory: true and backfill L1 with normalized data
      expect(normalizeCompanyFacts).toHaveBeenCalledWith(mockRawFirestoreData, { fullHistory: true });
      expect(edgarCache.setCompanyFacts).toHaveBeenCalledWith('AAPL', mockNormalizedData, '0000320193');

      // Should NOT call cacheWriter or SEC API
      expect(mockCacheWriterCallable).not.toHaveBeenCalled();
      expect(edgarApi.fetchCompanyFactsByTicker).not.toHaveBeenCalled();
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should invoke cacheWriter on L1 & L2 miss, re-read raw doc from Firestore, normalize with fullHistory: true, store in IDB, and return', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null); // L1 miss
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce(null); // L2 initial miss

      mockCacheWriterCallable.mockResolvedValue({
        data: {
          ticker: 'AAPL',
          latestFiledDate: '2023-11-03',
          updated: true,
        },
      });

      // Second call (after cacheWriter writes) returns newly written doc
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValueOnce({
        data: mockRawFirestoreData,
        companyFacts: mockRawFirestoreData,
        cik: '0000320193',
        companyName: 'Apple Inc.',
        lastUpdated: new Date(),
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.FIRESTORE);
      expect(result.metadata.cacheHit).toBe(false);
      expect(result.data.companyName).toBe('Apple Inc.');

      // CIK mapped and cacheWriter invoked with integer CIK
      expect(edgarApi.mapTickerToCik).toHaveBeenCalledWith('AAPL');
      expect(mockCacheWriterCallable).toHaveBeenCalledWith({ ticker: 'AAPL', cik: 320193 });

      // Firestore read called twice (initial check + re-read after cacheWriter)
      expect(firestoreCache.getCompanyFactsFromFirestore).toHaveBeenCalledTimes(2);

      // Normalization and IDB write
      expect(normalizeCompanyFacts).toHaveBeenCalledWith(mockRawFirestoreData, { fullHistory: true });
      expect(edgarCache.setCompanyFacts).toHaveBeenCalledWith('AAPL', mockNormalizedData, '0000320193');

      // Should NOT fall back to direct SEC fetch
      expect(edgarApi.fetchCompanyFactsByTicker).not.toHaveBeenCalled();
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should fall back to direct SEC fetch into IndexedDB without unhandled exceptions when Firestore read fails (R4)', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      // Firestore read throws network / connection error
      firestoreCache.getCompanyFactsFromFirestore.mockRejectedValue(new Error('Firestore connection failure'));

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(result.metadata.cacheHit).toBe(false);
      expect(result.data.companyName).toBe('Apple Inc.');

      // Fetched directly from SEC API and normalized with fullHistory: true
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
      expect(normalizeCompanyFacts).toHaveBeenCalledWith(mockRawFirestoreData, { fullHistory: true });
      expect(edgarCache.setCompanyFacts).toHaveBeenCalledWith('AAPL', mockNormalizedData, '0000320193');

      // Zero client writes to Firestore
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should fall back to direct SEC fetch into IndexedDB without unhandled exceptions when cacheWriter fails (R4)', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null); // L2 miss

      // cacheWriter Cloud Function invocation fails
      mockCacheWriterCallable.mockRejectedValue(new Error('Cloud Function deadline exceeded'));

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
      expect(normalizeCompanyFacts).toHaveBeenCalledWith(mockRawFirestoreData, { fullHistory: true });
      expect(edgarCache.setCompanyFacts).toHaveBeenCalledWith('AAPL', mockNormalizedData, '0000320193');
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should fall back to direct SEC fetch into IndexedDB when Firestore re-read after cacheWriter returns null (R4)', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      // Both initial check and re-read return null
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);

      mockCacheWriterCallable.mockResolvedValue({
        data: { ticker: 'AAPL', latestFiledDate: '2023-11-03', updated: true },
      });

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
    });

    it('should normalize directly in-memory from Firestore when IndexedDB is unavailable (R4)', async () => {
      // IndexedDB get throws (e.g. private browsing or unavailable)
      edgarCache.getCompanyFacts.mockRejectedValue(new Error('IndexedDB NotSupportedError'));

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockRawFirestoreData,
        companyFacts: mockRawFirestoreData,
        cik: '0000320193',
        companyName: 'Apple Inc.',
        lastUpdated: new Date(),
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      // IndexedDB set also rejects (storage quota / disabled)
      edgarCache.setCompanyFacts.mockRejectedValue(new Error('QuotaExceededError'));

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.data.companyFacts).toEqual(mockNormalizedData);
      expect(result.metadata.source).toBe(CACHE_SOURCES.FIRESTORE);
      expect(result.error).toBeNull();
    });

    it('should normalize directly in-memory from direct SEC fetch when IndexedDB is unavailable and Firestore fails (R4)', async () => {
      edgarCache.getCompanyFacts.mockRejectedValue(new Error('IndexedDB disabled'));
      firestoreCache.getCompanyFactsFromFirestore.mockRejectedValue(new Error('Firestore unavailable'));
      edgarCache.setCompanyFacts.mockRejectedValue(new Error('QuotaExceededError'));

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.data.companyFacts).toEqual(mockNormalizedData);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(result.error).toBeNull();
    });

    it('should verify ZERO write calls to Firestore from client (setCompanyFactsToFirestore not called)', async () => {
      // 1. IndexedDB hit
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: Date.now(),
      });
      await getCompanyData('AAPL');

      // 2. Firestore hit
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockRawFirestoreData,
        companyFacts: mockRawFirestoreData,
        cik: '0000320193',
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      await getCompanyData('MSFT');

      // 3. Fallback to SEC
      firestoreCache.getCompanyFactsFromFirestore.mockRejectedValue(new Error('down'));
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });
      await getCompanyData('GOOGL');

      // Ensure setCompanyFactsToFirestore was NEVER called in any flow
      expect(firestoreCache.setCompanyFactsToFirestore).not.toHaveBeenCalled();
    });

    it('should skip cache and fetch from SEC when forceRefresh=true', async () => {
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL', { forceRefresh: true });

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);

      // Should NOT check caches or call cacheWriter
      expect(edgarCache.getCompanyFacts).not.toHaveBeenCalled();
      expect(firestoreCache.getCompanyFactsFromFirestore).not.toHaveBeenCalled();
      expect(mockCacheWriterCallable).not.toHaveBeenCalled();
    });

    it('should export getCompanyFacts as an alias to getCompanyData', () => {
      expect(getCompanyFacts).toBe(getCompanyData);
    });
  });

  // =============================================================================
  // Background Refresh & Staleness Check (R3 Acceptance Criteria)
  // =============================================================================

  describe('Background Staleness Check & Invalidation', () => {
    it('should trigger cacheWriter for IndexedDB entry older than 90 days and invalidate IndexedDB on updated: true', async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyOneDaysAgo,
      });

      mockCacheWriterCallable.mockResolvedValue({
        data: {
          ticker: 'AAPL',
          latestFiledDate: '2024-01-15',
          updated: true,
        },
      });

      edgarCache.invalidateCache.mockResolvedValue(true);

      // Returns cached data immediately without blocking
      const result = await getCompanyData('AAPL', { backgroundRefresh: true });

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.INDEXEDDB);
      expect(result.metadata.needsRefresh).toBe(true);

      // Wait for non-blocking background task
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockCacheWriterCallable).toHaveBeenCalledWith({ ticker: 'AAPL', cik: 320193 });
      expect(edgarCache.invalidateCache).toHaveBeenCalledWith('AAPL');
    });

    it('should trigger cacheWriter but NOT invalidate IndexedDB when updated: false', async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyOneDaysAgo,
      });

      mockCacheWriterCallable.mockResolvedValue({
        data: {
          ticker: 'AAPL',
          latestFiledDate: '2023-11-03',
          updated: false,
        },
      });

      const result = await getCompanyData('AAPL', { backgroundRefresh: true });
      expect(result.success).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockCacheWriterCallable).toHaveBeenCalledWith({ ticker: 'AAPL', cik: 320193 });
      // Should NOT invalidate if cacheWriter reports no updates
      expect(edgarCache.invalidateCache).not.toHaveBeenCalled();
    });

    it('should NOT trigger background cacheWriter check when IndexedDB entry is fresh (< 90 days)', async () => {
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: tenDaysAgo,
      });

      await getCompanyData('AAPL', { backgroundRefresh: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockCacheWriterCallable).not.toHaveBeenCalled();
    });

    it('should NOT trigger background cacheWriter check when backgroundRefresh=false', async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyOneDaysAgo,
      });

      await getCompanyData('AAPL', { backgroundRefresh: false });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockCacheWriterCallable).not.toHaveBeenCalled();
    });

    it('should prevent duplicate background refreshes', async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyOneDaysAgo,
      });

      // Fire multiple concurrent requests
      await Promise.all([
        getCompanyData('AAPL', { backgroundRefresh: true }),
        getCompanyData('AAPL', { backgroundRefresh: true }),
        getCompanyData('AAPL', { backgroundRefresh: true }),
      ]);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should only trigger cacheWriter once
      expect(mockCacheWriterCallable).toHaveBeenCalledTimes(1);
    });

    it('should handle background cacheWriter errors gracefully without throwing', async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: ninetyOneDaysAgo,
      });

      mockCacheWriterCallable.mockRejectedValue(new Error('Cloud Function unavailable'));

      const result = await getCompanyData('AAPL', { backgroundRefresh: true });

      expect(result.success).toBe(true);

      // Waiting should not cause unhandled rejections
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockCacheWriterCallable).toHaveBeenCalled();
    });

    it('should resolve CIK from ticker mapping during background refresh if not present in cached entry', async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: null, // CIK not cached in IDB entry
        needsRefresh: true,
        lastUpdated: ninetyOneDaysAgo,
      });

      edgarApi.mapTickerToCik.mockResolvedValue({
        cik: '0000320193',
        name: 'Apple Inc.',
      });

      await getCompanyData('AAPL', { backgroundRefresh: true });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(edgarApi.mapTickerToCik).toHaveBeenCalledWith('AAPL');
      expect(mockCacheWriterCallable).toHaveBeenCalledWith({ ticker: 'AAPL', cik: 320193 });
    });
  });

  // =============================================================================
  // Refresh Stale Cache API
  // =============================================================================

  describe('Refresh Stale Cache', () => {
    it('should start refresh for stale cache via cacheWriter', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
      });

      const result = await refreshStaleCache('AAPL');

      expect(result.started).toBe(true);
      expect(result.reason).toContain('stale');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockCacheWriterCallable).toHaveBeenCalledWith({ ticker: 'AAPL', cik: 320193 });
    });

    it('should NOT start refresh for fresh cache', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: Date.now() - 10000,
      });

      const result = await refreshStaleCache('AAPL');

      expect(result.started).toBe(false);
      expect(result.reason).toContain('fresh');
      expect(mockCacheWriterCallable).not.toHaveBeenCalled();
    });

    it('should start refresh when no cache exists', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);

      const result = await refreshStaleCache('AAPL');

      expect(result.started).toBe(true);
      expect(result.reason).toContain('No cached data');
    });

    it('should prevent duplicate refreshes', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: true,
      });

      const result1 = await refreshStaleCache('AAPL');
      expect(result1.started).toBe(true);

      const result2 = await refreshStaleCache('AAPL');
      expect(result2.started).toBe(false);
      expect(result2.reason).toContain('in progress');
    });
  });

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('Error Handling', () => {
    it('should validate ticker format', async () => {
      const result = await getCompanyData('');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(COORDINATOR_ERROR_CODES.INVALID_TICKER);
    });

    it('should validate ticker length', async () => {
      const result = await getCompanyData('TOOLONGTICKERX');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(COORDINATOR_ERROR_CODES.INVALID_TICKER);
    });

    it('should return error when all layers fail', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);
      mockCacheWriterCallable.mockRejectedValue(new Error('Cloud Function down'));
      edgarApi.fetchCompanyFactsByTicker.mockRejectedValue(new Error('SEC API error'));

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(COORDINATOR_ERROR_CODES.SEC_API_ERROR);
      expect(result.metadata.source).toBe(CACHE_SOURCES.NONE);
    });

    it('should handle L1 errors gracefully and continue to L2', async () => {
      edgarCache.getCompanyFacts.mockRejectedValue(new Error('IndexedDB error'));

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockRawFirestoreData,
        companyFacts: mockRawFirestoreData,
        cik: '0000320193',
        companyName: 'Apple Inc.',
        needsRefresh: false,
        lastUpdated: new Date(),
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.FIRESTORE);
    });

    it('should fall through to SEC API when normalizeCompanyFacts throws on L2', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockRawFirestoreData,
        companyFacts: mockRawFirestoreData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: new Date(),
      });
      normalizeCompanyFacts.mockImplementationOnce(() => { throw new Error('normalize error'); });

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
    });

    it('should return SEC_API_ERROR when normalizeCompanyFacts throws on SEC API fetch', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);
      mockCacheWriterCallable.mockRejectedValue(new Error('cacheWriter failed'));
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockImplementation(() => { throw new Error('normalize error'); });

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(COORDINATOR_ERROR_CODES.SEC_API_ERROR);
    });

    it('should handle L2 timeout and fall back to SEC API', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);

      // Simulate slow Firestore response that exceeds timeout
      firestoreCache.getCompanyFactsFromFirestore.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 10000))
      );

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
    }, 15000);
  });

  // =============================================================================
  // Cache Invalidation Tests
  // =============================================================================

  describe('Cache Invalidation', () => {
    it('should invalidate both L1 and L2 caches', async () => {
      edgarCache.invalidateCache.mockResolvedValue(true);
      firestoreCache.invalidateGlobalCache.mockResolvedValue(true);

      const result = await invalidateCache('AAPL');

      expect(result.success).toBe(true);
      expect(result.layers.indexeddb).toBe(true);
      expect(result.layers.firestore).toBe(true);

      expect(edgarCache.invalidateCache).toHaveBeenCalledWith('AAPL');
      expect(firestoreCache.invalidateGlobalCache).toHaveBeenCalledWith('AAPL');
    });

    it('should normalize ticker before invalidating', async () => {
      edgarCache.invalidateCache.mockResolvedValue(true);
      firestoreCache.invalidateGlobalCache.mockResolvedValue(true);

      await invalidateCache('aapl');

      expect(edgarCache.invalidateCache).toHaveBeenCalledWith('AAPL');
      expect(firestoreCache.invalidateGlobalCache).toHaveBeenCalledWith('AAPL');
    });

    it('should succeed if at least one layer invalidates', async () => {
      edgarCache.invalidateCache.mockResolvedValue(true);
      firestoreCache.invalidateGlobalCache.mockResolvedValue(false);

      const result = await invalidateCache('AAPL');

      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      edgarCache.invalidateCache.mockRejectedValue(new Error('Cache error'));
      firestoreCache.invalidateGlobalCache.mockResolvedValue(false);

      const result = await invalidateCache('AAPL');

      expect(result.success).toBe(false);
    });
  });

  // =============================================================================
  // Cache Statistics Tests
  // =============================================================================

  describe('Cache Statistics', () => {
    it('should aggregate stats from all layers', async () => {
      edgarCache.getCacheStats.mockResolvedValue({
        companyFacts: { count: 5, estimatedSizeBytes: 50000 },
        tickerMappings: { count: 10, estimatedSizeBytes: 2000 },
        totalCount: 15,
        totalEstimatedSizeBytes: 52000,
        isSupported: true,
      });

      firestoreCache.getGlobalCacheStats.mockResolvedValue({
        totalCompanies: 1000,
        totalAccessCount: 5000,
        estimatedSavings: 21350,
        costPerLookup: 4.27,
        isAvailable: true,
      });

      const stats = await getCacheStats();

      expect(stats.indexeddb.totalCount).toBe(15);
      expect(stats.firestore.totalCompanies).toBe(1000);
      expect(stats.summary.localCacheEntries).toBe(5);
      expect(stats.summary.globalCacheEntries).toBe(1000);
      expect(stats.summary.totalEstimatedSavings).toBe(21350);
    });

    it('should handle errors in stats fetching', async () => {
      edgarCache.getCacheStats.mockRejectedValue(new Error('Cache error'));
      firestoreCache.getGlobalCacheStats.mockRejectedValue(new Error('Firestore error'));

      const stats = await getCacheStats();

      expect(stats.indexeddb.totalCount).toBe(0);
      expect(stats.firestore.totalCompanies).toBe(0);
    });
  });

  // =============================================================================
  // Prefetch Tests
  // =============================================================================

  describe('Prefetch', () => {
    it('should prefetch multiple tickers', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
      });

      const result = await prefetchCompanies(['AAPL', 'MSFT', 'GOOGL']);

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should respect concurrency limit', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
      });

      const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META'];

      await prefetchCompanies(tickers, { concurrency: 2 });

      expect(edgarCache.getCompanyFacts).toHaveBeenCalledTimes(6);
    });

    it('should call progress callback', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
      });

      const progressCalls = [];
      const onProgress = (completed, total) => {
        progressCalls.push({ completed, total });
      };

      await prefetchCompanies(['AAPL', 'MSFT', 'GOOGL'], { onProgress });

      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[2]).toEqual({ completed: 3, total: 3 });
    });

    it('should handle empty ticker list', async () => {
      const result = await prefetchCompanies([]);

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(0);
    });

    it('should track successful and failed fetches', async () => {
      let callCount = 0;
      edgarCache.getCompanyFacts.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Failed');
        }
        return {
          data: mockNormalizedData,
          cik: '0000320193',
          needsRefresh: false,
        };
      });

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);
      mockCacheWriterCallable.mockRejectedValue(new Error('Cloud Function error'));
      edgarApi.fetchCompanyFactsByTicker.mockRejectedValue(new Error('API Error'));

      const result = await prefetchCompanies(['AAPL', 'MSFT', 'GOOGL']);

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
    }, 10000);
  });

  // =============================================================================
  // Metadata Tests
  // =============================================================================

  describe('Metadata', () => {
    it('should include metadata by default', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: Date.now(),
      });

      const result = await getCompanyData('AAPL');

      expect(result.metadata).toBeDefined();
      expect(result.metadata.source).toBe(CACHE_SOURCES.INDEXEDDB);
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.metadata.lastUpdated).toBeInstanceOf(Date);
      expect(result.metadata.costSaved).toBe(4.27);
    });

    it('should exclude metadata when includeMetadata=false', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockNormalizedData,
        cik: '0000320193',
        needsRefresh: false,
      });

      const result = await getCompanyData('AAPL', { includeMetadata: false });

      expect(result.metadata).toBeNull();
    });
  });

  // =============================================================================
  // Concurrent Request Deduplication Tests
  // =============================================================================

  describe('Concurrent Request Deduplication', () => {
    it('should deduplicate concurrent requests for the same ticker', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);

      edgarApi.fetchCompanyFactsByTicker.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              facts: mockRawFirestoreData,
              companyInfo: mockCompanyInfo,
            });
          }, 100);
        });
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      // Fire 3 concurrent requests for the same ticker
      const [result1, result2, result3] = await Promise.all([
        getCompanyData('AAPL'),
        getCompanyData('AAPL'),
        getCompanyData('AAPL'),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // SEC API should only be called ONCE (deduplicated)
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledTimes(1);
    });

    it('should NOT deduplicate requests for different tickers', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      // Fire concurrent requests for different tickers
      await Promise.all([
        getCompanyData('AAPL'),
        getCompanyData('MSFT'),
      ]);

      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledTimes(2);
    });

    it('should NOT deduplicate forceRefresh requests', async () => {
      edgarApi.fetchCompanyFactsByTicker.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              facts: mockRawFirestoreData,
              companyInfo: mockCompanyInfo,
            });
          }, 50);
        });
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      await Promise.all([
        getCompanyData('AAPL', { forceRefresh: true }),
        getCompanyData('AAPL', { forceRefresh: true }),
      ]);

      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledTimes(2);
    });

    it('should allow new requests after in-flight request completes', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });

      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      // First request
      await getCompanyData('AAPL');

      // Second request after first completes - should NOT be deduplicated
      await getCompanyData('AAPL');

      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledTimes(2);
    });

    it('should clean up in-flight map on error', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);
      mockCacheWriterCallable.mockRejectedValue(new Error('Cloud Function error'));

      // First call fails
      edgarApi.fetchCompanyFactsByTicker.mockRejectedValueOnce(new Error('API Error'));

      const result1 = await getCompanyData('AAPL');
      expect(result1.success).toBe(false);

      // Second call should work (not stuck in dedup map)
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValueOnce({
        facts: mockRawFirestoreData,
        companyInfo: mockCompanyInfo,
      });
      normalizeCompanyFacts.mockReturnValue(mockNormalizedData);
      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result2 = await getCompanyData('AAPL');
      expect(result2.success).toBe(true);
    });
  });
});
