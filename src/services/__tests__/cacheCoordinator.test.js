/**
 * Tests for Cache Coordinator (3-tier hybrid cache)
 *
 * Tests cover:
 * - 3-tier cache hierarchy (IndexedDB → Firestore → SEC API)
 * - Cache hit/miss scenarios
 * - Background refresh for stale data
 * - Duplicate prevention
 * - Timeout handling
 * - Cache invalidation across layers
 * - Prefetch operations
 * - Cache statistics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCompanyData,
  invalidateCache,
  getCacheStats,
  prefetchCompanies,
  refreshStaleCache,
  CACHE_SOURCES,
  COORDINATOR_ERROR_CODES,
} from '../cacheCoordinator.js';

// Mock all dependencies
vi.mock('../edgarApi.js', () => ({
  default: {
    fetchCompanyFactsByTicker: vi.fn(),
  },
}));

vi.mock('../edgarCache.js', () => ({
  default: {
    getCompanyFacts: vi.fn(),
    setCompanyFacts: vi.fn(),
    invalidateCache: vi.fn(),
    getCacheStats: vi.fn(),
  },
}));

vi.mock('../firestoreCache.js', () => ({
  default: {
    getCompanyFactsFromFirestore: vi.fn(),
    setCompanyFactsToFirestore: vi.fn(),
    invalidateGlobalCache: vi.fn(),
    getGlobalCacheStats: vi.fn(),
  },
}));

// Import mocked modules
import edgarApi from '../edgarApi.js';
import edgarCache from '../edgarCache.js';
import firestoreCache from '../firestoreCache.js';

// =============================================================================
// Mock Data
// =============================================================================

const mockCompanyFacts = {
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
  });

  // =============================================================================
  // Cache Hierarchy Tests
  // =============================================================================

  describe('3-Tier Cache Hierarchy', () => {
    it('should hit L1 (IndexedDB) first and return immediately', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
        cik: '0000320193',
        needsRefresh: false,
        lastUpdated: Date.now(),
      });

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.INDEXEDDB);
      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data.companyName).toBe('Apple Inc.');

      // Should NOT call Firestore or SEC API
      expect(firestoreCache.getCompanyFactsFromFirestore).not.toHaveBeenCalled();
      expect(edgarApi.fetchCompanyFactsByTicker).not.toHaveBeenCalled();
    });

    it('should fall through to L2 (Firestore) when L1 misses', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null); // L1 miss

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockCompanyFacts,
        cik: '0000320193',
        companyName: 'Apple Inc.',
        needsRefresh: false,
        lastUpdated: new Date(),
      });

      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.FIRESTORE);
      expect(result.metadata.cacheHit).toBe(true);

      // Should backfill L1 cache
      expect(edgarCache.setCompanyFacts).toHaveBeenCalledWith(
        'AAPL',
        mockCompanyFacts,
        '0000320193'
      );

      // Should NOT call SEC API
      expect(edgarApi.fetchCompanyFactsByTicker).not.toHaveBeenCalled();
    });

    it('should fall through to L3 (SEC API) when L1 and L2 miss', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null); // L1 miss
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null); // L2 miss

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      edgarCache.setCompanyFacts.mockResolvedValue(true);
      firestoreCache.setCompanyFactsToFirestore.mockResolvedValue(true);

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
      expect(result.metadata.cacheHit).toBe(false);

      // Should backfill both caches
      expect(edgarCache.setCompanyFacts).toHaveBeenCalled();
      expect(firestoreCache.setCompanyFactsToFirestore).toHaveBeenCalled();
    });

    it('should skip cache and fetch from SEC when forceRefresh=true', async () => {
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      edgarCache.setCompanyFacts.mockResolvedValue(true);

      const result = await getCompanyData('AAPL', { forceRefresh: true });

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);

      // Should NOT check caches
      expect(edgarCache.getCompanyFacts).not.toHaveBeenCalled();
      expect(firestoreCache.getCompanyFactsFromFirestore).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Background Refresh Tests
  // =============================================================================

  describe('Background Refresh', () => {
    it('should trigger background refresh for stale L1 cache', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
        cik: '0000320193',
        needsRefresh: true, // Stale!
        lastUpdated: Date.now() - 1000000,
      });

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      const result = await getCompanyData('AAPL', { backgroundRefresh: true });

      expect(result.success).toBe(true);
      expect(result.metadata.needsRefresh).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.INDEXEDDB);

      // Background refresh should be triggered (async)
      // Wait a bit for async operation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
    });

    it('should NOT trigger background refresh when backgroundRefresh=false', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: Date.now() - 1000000,
      });

      await getCompanyData('AAPL', { backgroundRefresh: false });

      // Should NOT call SEC API
      expect(edgarApi.fetchCompanyFactsByTicker).not.toHaveBeenCalled();
    });

    it('should prevent duplicate background refreshes', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
        cik: '0000320193',
        needsRefresh: true,
        lastUpdated: Date.now() - 1000000,
      });

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      // Fire multiple requests rapidly
      await Promise.all([
        getCompanyData('AAPL', { backgroundRefresh: true }),
        getCompanyData('AAPL', { backgroundRefresh: true }),
        getCompanyData('AAPL', { backgroundRefresh: true }),
      ]);

      // Wait for background operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should only trigger once
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledTimes(1);
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
      edgarApi.fetchCompanyFactsByTicker.mockRejectedValue(new Error('SEC API error'));

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(COORDINATOR_ERROR_CODES.SEC_API_ERROR);
      expect(result.metadata.source).toBe(CACHE_SOURCES.NONE);
    });

    it('should handle L1 errors gracefully and continue to L2', async () => {
      edgarCache.getCompanyFacts.mockRejectedValue(new Error('IndexedDB error'));

      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue({
        data: mockCompanyFacts,
        cik: '0000320193',
        companyName: 'Apple Inc.',
        needsRefresh: false,
        lastUpdated: new Date(),
      });

      const result = await getCompanyData('AAPL');

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.FIRESTORE);
    });

    it('should handle L2 timeout', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);

      // Simulate slow Firestore response
      firestoreCache.getCompanyFactsFromFirestore.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 10000))
      );

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      const result = await getCompanyData('AAPL');

      // Should timeout and fall through to SEC API
      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe(CACHE_SOURCES.SEC_API);
    }, 10000);
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
      firestoreCache.invalidateGlobalCache.mockResolvedValue(false); // Client fails (expected)

      const result = await invalidateCache('AAPL');

      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      edgarCache.invalidateCache.mockRejectedValue(new Error('Cache error'));
      firestoreCache.invalidateGlobalCache.mockResolvedValue(false);

      const result = await invalidateCache('AAPL');

      // Should not throw, just return false
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

      // Should return default values, not throw
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
        data: mockCompanyFacts,
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
        data: mockCompanyFacts,
        cik: '0000320193',
        needsRefresh: false,
      });

      const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META'];

      await prefetchCompanies(tickers, { concurrency: 2 });

      // All should be fetched
      expect(edgarCache.getCompanyFacts).toHaveBeenCalledTimes(6);
    });

    it('should call progress callback', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
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
          data: mockCompanyFacts,
          cik: '0000320193',
          needsRefresh: false,
        };
      });

      // Also mock Firestore and API to fail for the second call
      // So it doesn't fall back and succeed
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);
      edgarApi.fetchCompanyFactsByTicker.mockRejectedValue(new Error('API Error'));

      const result = await prefetchCompanies(['AAPL', 'MSFT', 'GOOGL']);

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
    }, 10000);
  });

  // =============================================================================
  // Refresh Stale Cache Tests
  // =============================================================================

  describe('Refresh Stale Cache', () => {
    it('should start refresh for stale cache', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
        needsRefresh: true,
      });

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      const result = await refreshStaleCache('AAPL');

      expect(result.started).toBe(true);
      expect(result.reason).toContain('stale');

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledWith('AAPL');
    });

    it('should NOT start refresh for fresh cache', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
        needsRefresh: false,
      });

      const result = await refreshStaleCache('AAPL');

      expect(result.started).toBe(false);
      expect(result.reason).toContain('fresh');
      expect(edgarApi.fetchCompanyFactsByTicker).not.toHaveBeenCalled();
    });

    it('should start refresh when no cache exists', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      const result = await refreshStaleCache('AAPL');

      expect(result.started).toBe(true);
      expect(result.reason).toContain('No cached data');
    });

    it('should prevent duplicate refreshes', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
        needsRefresh: true,
      });

      edgarApi.fetchCompanyFactsByTicker.mockResolvedValue({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      // Start first refresh
      const result1 = await refreshStaleCache('AAPL');
      expect(result1.started).toBe(true);

      // Try second refresh immediately
      const result2 = await refreshStaleCache('AAPL');
      expect(result2.started).toBe(false);
      expect(result2.reason).toContain('in progress');
    });
  });

  // =============================================================================
  // Metadata Tests
  // =============================================================================

  describe('Metadata', () => {
    it('should include metadata by default', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue({
        data: mockCompanyFacts,
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
        data: mockCompanyFacts,
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
      // Simulate a slow L1 miss, L2 miss, and L3 fetch
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);

      edgarApi.fetchCompanyFactsByTicker.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              facts: mockCompanyFacts,
              companyInfo: mockCompanyInfo,
            });
          }, 100);
        });
      });

      edgarCache.setCompanyFacts.mockResolvedValue(true);
      firestoreCache.setCompanyFactsToFirestore.mockResolvedValue(true);

      // Fire 3 concurrent requests for the same ticker
      const [result1, result2, result3] = await Promise.all([
        getCompanyData('AAPL'),
        getCompanyData('AAPL'),
        getCompanyData('AAPL'),
      ]);

      // All should succeed with the same data
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
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      edgarCache.setCompanyFacts.mockResolvedValue(true);
      firestoreCache.setCompanyFactsToFirestore.mockResolvedValue(true);

      // Fire concurrent requests for different tickers
      await Promise.all([
        getCompanyData('AAPL'),
        getCompanyData('MSFT'),
      ]);

      // Both should trigger their own SEC API call
      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledTimes(2);
    });

    it('should NOT deduplicate forceRefresh requests', async () => {
      edgarApi.fetchCompanyFactsByTicker.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              facts: mockCompanyFacts,
              companyInfo: mockCompanyInfo,
            });
          }, 50);
        });
      });

      edgarCache.setCompanyFacts.mockResolvedValue(true);
      firestoreCache.setCompanyFactsToFirestore.mockResolvedValue(true);

      // Fire 2 forceRefresh requests - should NOT deduplicate
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
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });

      edgarCache.setCompanyFacts.mockResolvedValue(true);
      firestoreCache.setCompanyFactsToFirestore.mockResolvedValue(true);

      // First request
      await getCompanyData('AAPL');

      // Second request after first completes - should NOT be deduplicated
      await getCompanyData('AAPL');

      expect(edgarApi.fetchCompanyFactsByTicker).toHaveBeenCalledTimes(2);
    });

    it('should clean up in-flight map on error', async () => {
      edgarCache.getCompanyFacts.mockResolvedValue(null);
      firestoreCache.getCompanyFactsFromFirestore.mockResolvedValue(null);

      // First call fails
      edgarApi.fetchCompanyFactsByTicker.mockRejectedValueOnce(new Error('API Error'));

      const result1 = await getCompanyData('AAPL');
      expect(result1.success).toBe(false);

      // Second call should work (not stuck in dedup map)
      edgarApi.fetchCompanyFactsByTicker.mockResolvedValueOnce({
        facts: mockCompanyFacts,
        companyInfo: mockCompanyInfo,
      });
      edgarCache.setCompanyFacts.mockResolvedValue(true);
      firestoreCache.setCompanyFactsToFirestore.mockResolvedValue(true);

      const result2 = await getCompanyData('AAPL');
      expect(result2.success).toBe(true);
    });
  });
});
