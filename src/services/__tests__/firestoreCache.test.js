/**
 * Tests for Firestore Global Cache Service
 *
 * Tests cover:
 * - Reading from Firestore global cache
 * - Cache staleness detection
 * - Access count tracking
 * - Write operations (for Cloud Functions)
 * - Cache invalidation (soft delete)
 * - Error handling and graceful degradation
 * - Offline mode handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// =============================================================================
// Mock Firebase BEFORE imports
// =============================================================================

// Mock firebase/firestore module with inline Timestamp class to avoid hoisting issues
vi.mock('firebase/firestore', () => {
  // Define MockTimestamp inside the factory function
  class MockTimestamp {
    constructor(seconds, nanoseconds) {
      this._seconds = seconds;
      this._nanoseconds = nanoseconds;
    }

    toDate() {
      return new Date(this._seconds * 1000);
    }

    toMillis() {
      return this._seconds * 1000 + Math.floor(this._nanoseconds / 1000000);
    }

    static fromDate(date) {
      const seconds = Math.floor(date.getTime() / 1000);
      const nanoseconds = (date.getTime() % 1000) * 1000000;
      return new MockTimestamp(seconds, nanoseconds);
    }
  }

  return {
    doc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    getCountFromServer: vi.fn(),
    increment: vi.fn((n) => ({ _increment: n })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
    Timestamp: MockTimestamp,
  };
});

// Mock firebase lib
vi.mock('../lib/firebase', () => ({
  db: {},
  getCurrentUserId: vi.fn(() => 'test-user-id'),
}));

// NOW import the functions after mocks are set up
import {
  getCompanyFactsFromFirestore,
  checkIfCached,
  getGlobalCacheStats,
  setCompanyFactsToFirestore,
  updateAccessCount,
  invalidateGlobalCache,
  calculateCostSavings,
  getConfig,
  FirestoreCacheError,
  FIRESTORE_CACHE_ERROR_CODES,
} from '../firestoreCache.js';

// Import mocked modules to access mock functions
import * as firestore from 'firebase/firestore';

// Access MockTimestamp from the mocked module for use in tests
const MockTimestamp = firestore.Timestamp;

let mockFirestore;
let mockDocRef;

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

const mockFirestoreDoc = {
  ticker: 'AAPL',
  cik: '0000320193',
  companyName: 'Apple Inc.',
  companyFacts: mockCompanyFacts,
  lastUpdated: MockTimestamp.fromDate(new Date()), // Use current date for fresh cache
  lastFiling: MockTimestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),  // 30 days ago
  accessCount: 42,
  version: 1,
  needsRefresh: false,
};

// =============================================================================
// Firebase Mock
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Create mock document reference
  mockDocRef = {
    id: 'AAPL',
    path: 'edgarCache/AAPL',
  };

  // Configure mock returns for firebase/firestore functions
  firestore.doc.mockReturnValue(mockDocRef);
  firestore.collection.mockReturnValue({ path: 'edgarCache' });

  // Default mock implementations (can be overridden in specific tests)
  firestore.getDoc.mockResolvedValue({
    exists: () => false,
  });

  firestore.setDoc.mockResolvedValue(undefined);
  firestore.updateDoc.mockResolvedValue(undefined);
  firestore.getCountFromServer.mockResolvedValue({
    data: () => ({ count: 0 }),
  });
});

// =============================================================================
// Test Suite
// =============================================================================

describe('firestoreCache', () => {
  // =============================================================================
  // Read Operations Tests
  // =============================================================================

  describe('getCompanyFactsFromFirestore', () => {
    it('should return cached data when found', async () => {
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockFirestoreDoc,
      });

      const result = await getCompanyFactsFromFirestore('AAPL');

      expect(result).not.toBeNull();
      expect(result.ticker).toBe('AAPL');
      expect(result.cik).toBe('0000320193');
      expect(result.companyName).toBe('Apple Inc.');
      expect(result.data).toEqual(mockCompanyFacts);
      expect(result.accessCount).toBe(42);
      expect(result.needsRefresh).toBe(false);
    });

    it('should return null when document not found', async () => {
      firestore.getDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getCompanyFactsFromFirestore('NOTEXIST');
      expect(result).toBeNull();
    });

    it('should normalize ticker to uppercase', async () => {
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockFirestoreDoc,
      });

      const result = await getCompanyFactsFromFirestore('aapl');
      expect(result).not.toBeNull();
    });

    it('should detect stale cache based on needsRefresh flag', async () => {
      const staleDoc = { ...mockFirestoreDoc, needsRefresh: true };
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => staleDoc,
      });

      const result = await getCompanyFactsFromFirestore('AAPL');
      expect(result.needsRefresh).toBe(true);
    });

    it('should detect stale cache based on TTL', async () => {
      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago
      const oldDoc = {
        ...mockFirestoreDoc,
        lastUpdated: MockTimestamp.fromDate(oldDate),
      };
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => oldDoc,
      });

      const result = await getCompanyFactsFromFirestore('AAPL');
      expect(result.needsRefresh).toBe(true);
    });

    it('should attempt to update access count', async () => {
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockFirestoreDoc,
      });
      firestore.updateDoc.mockResolvedValue();

      await getCompanyFactsFromFirestore('AAPL');

      // Access count update is fire-and-forget, so we just check it was called
      // Wait a bit for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      firestore.getDoc.mockRejectedValue(
        new Error('Failed to fetch')
      );

      const result = await getCompanyFactsFromFirestore('AAPL');
      expect(result).toBeNull(); // Should return null instead of throwing
    });

    it('should convert Timestamp objects to Date', async () => {
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockFirestoreDoc,
      });

      const result = await getCompanyFactsFromFirestore('AAPL');

      expect(result.lastUpdated).toBeInstanceOf(Date);
      expect(result.lastFiling).toBeInstanceOf(Date);
    });
  });

  describe('checkIfCached', () => {
    it('should return cache status when document exists', async () => {
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockFirestoreDoc,
      });

      const status = await checkIfCached('AAPL');

      expect(status.exists).toBe(true);
      expect(status.needsRefresh).toBe(false);
      expect(status.lastUpdated).toBeInstanceOf(Date);
      expect(status.accessCount).toBe(42);
    });

    it('should return not exists when document not found', async () => {
      firestore.getDoc.mockResolvedValue({
        exists: () => false,
      });

      const status = await checkIfCached('NOTEXIST');

      expect(status.exists).toBe(false);
      expect(status.needsRefresh).toBe(false);
      expect(status.lastUpdated).toBeNull();
      expect(status.accessCount).toBe(0);
    });

    it('should detect staleness', async () => {
      const staleDoc = { ...mockFirestoreDoc, needsRefresh: true };
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => staleDoc,
      });

      const status = await checkIfCached('AAPL');
      expect(status.needsRefresh).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      firestore.getDoc.mockRejectedValue(new Error('Network error'));

      const status = await checkIfCached('AAPL');

      expect(status.exists).toBe(false);
      expect(status.needsRefresh).toBe(false);
    });
  });

  describe('getGlobalCacheStats', () => {
    it('should return cache statistics', async () => {
      firestore.getCountFromServer.mockResolvedValue({
        data: () => ({ count: 150 }),
      });

      const stats = await getGlobalCacheStats();

      expect(stats.totalCompanies).toBe(150);
      expect(stats.isAvailable).toBe(true);
      expect(stats.costPerLookup).toBe(4.27);
    });

    it('should return default stats on error', async () => {
      firestore.getCountFromServer.mockRejectedValue(
        new Error('Permission denied')
      );

      const stats = await getGlobalCacheStats();

      expect(stats.totalCompanies).toBe(0);
      expect(stats.isAvailable).toBe(false);
    });
  });

  // =============================================================================
  // Write Operations Tests (for Cloud Functions)
  // =============================================================================

  describe('setCompanyFactsToFirestore', () => {
    it('should save company facts to Firestore', async () => {
      firestore.setDoc.mockResolvedValue();

      const result = await setCompanyFactsToFirestore(
        'AAPL',
        mockCompanyFacts,
        '0000320193',
        'Apple Inc.'
      );

      expect(result).toBe(true);
      expect(firestore.setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          ticker: 'AAPL',
          cik: '0000320193',
          companyName: 'Apple Inc.',
          companyFacts: mockCompanyFacts,
          accessCount: 0,
          version: 1,
          needsRefresh: false,
        })
      );
    });

    it('should normalize ticker before saving', async () => {
      firestore.setDoc.mockResolvedValue();

      await setCompanyFactsToFirestore(
        'aapl',
        mockCompanyFacts,
        '0000320193',
        'Apple Inc.'
      );

      expect(firestore.setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({ ticker: 'AAPL' })
      );
    });

    it('should handle optional lastFiling date', async () => {
      firestore.setDoc.mockResolvedValue();

      const lastFiling = new Date('2023-12-01');
      await setCompanyFactsToFirestore(
        'AAPL',
        mockCompanyFacts,
        '0000320193',
        'Apple Inc.',
        { lastFiling }
      );

      expect(firestore.setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({ lastFiling: expect.any(Object) })
      );
    });

    it('should handle permission denied errors gracefully', async () => {
      firestore.setDoc.mockRejectedValue(
        Object.assign(new Error('PERMISSION_DENIED'), { code: 'permission-denied' })
      );

      const result = await setCompanyFactsToFirestore(
        'AAPL',
        mockCompanyFacts,
        '0000320193',
        'Apple Inc.'
      );

      expect(result).toBe(false); // Should not throw, just return false
    });

    it('should handle other errors gracefully', async () => {
      firestore.setDoc.mockRejectedValue(new Error('Unknown error'));

      const result = await setCompanyFactsToFirestore(
        'AAPL',
        mockCompanyFacts,
        '0000320193',
        'Apple Inc.'
      );

      expect(result).toBe(false);
    });
  });

  describe('updateAccessCount', () => {
    it('should increment access count', async () => {
      firestore.updateDoc.mockResolvedValue();

      const result = await updateAccessCount('AAPL');

      expect(result).toBe(true);
      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('should handle permission denied silently', async () => {
      firestore.updateDoc.mockRejectedValue(
        Object.assign(new Error('PERMISSION_DENIED'), { code: 'permission-denied' })
      );

      const result = await updateAccessCount('AAPL');

      expect(result).toBe(false);
    });

    it('should handle not found errors', async () => {
      firestore.updateDoc.mockRejectedValue(
        Object.assign(new Error('Not found'), { code: 'not-found' })
      );

      const result = await updateAccessCount('AAPL');

      expect(result).toBe(false);
    });
  });

  describe('invalidateGlobalCache', () => {
    it('should mark cache as needing refresh', async () => {
      firestore.updateDoc.mockResolvedValue();

      const result = await invalidateGlobalCache('AAPL');

      expect(result).toBe(true);
      expect(firestore.updateDoc).toHaveBeenCalledWith(mockDocRef, {
        needsRefresh: true,
      });
    });

    it('should handle permission denied', async () => {
      firestore.updateDoc.mockRejectedValue(
        Object.assign(new Error('PERMISSION_DENIED'), { code: 'permission-denied' })
      );

      const result = await invalidateGlobalCache('AAPL');

      expect(result).toBe(false);
    });

    it('should handle not found errors', async () => {
      firestore.updateDoc.mockRejectedValue(
        Object.assign(new Error('Not found'), { code: 'not-found' })
      );

      const result = await invalidateGlobalCache('AAPL');

      expect(result).toBe(false);
    });
  });

  // =============================================================================
  // Utility Functions Tests
  // =============================================================================

  describe('calculateCostSavings', () => {
    it('should return 0 for first access', () => {
      expect(calculateCostSavings(1)).toBe(0);
    });

    it('should calculate savings for multiple accesses', () => {
      expect(calculateCostSavings(2)).toBeCloseTo(4.27, 2);
      expect(calculateCostSavings(10)).toBeCloseTo(38.43, 2);
      expect(calculateCostSavings(100)).toBeCloseTo(422.73, 2);
    });

    it('should return 0 for zero accesses', () => {
      expect(calculateCostSavings(0)).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return configuration object', () => {
      const config = getConfig();

      expect(config.COLLECTION_NAME).toBe('edgarCache');
      expect(config.CACHE_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
      expect(config.COST_PER_LOOKUP).toBe(4.27);
      expect(config.SCHEMA_VERSION).toBe(1);
    });

    it('should return a copy of config (not reference)', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });
  });

  // =============================================================================
  // Error Class Tests
  // =============================================================================

  describe('FirestoreCacheError', () => {
    it('should create error with all properties', () => {
      const cause = new Error('Original error');
      const error = new FirestoreCacheError('Test error', 'TEST_CODE', cause);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FirestoreCacheError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.cause).toBe(cause);
    });

    it('should have correct error codes', () => {
      expect(FIRESTORE_CACHE_ERROR_CODES.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(FIRESTORE_CACHE_ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(FIRESTORE_CACHE_ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(FIRESTORE_CACHE_ERROR_CODES.INVALID_DATA).toBe('INVALID_DATA');
      expect(FIRESTORE_CACHE_ERROR_CODES.QUOTA_EXCEEDED).toBe('QUOTA_EXCEEDED');
      expect(FIRESTORE_CACHE_ERROR_CODES.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });

  // =============================================================================
  // Integration Tests
  // =============================================================================

  describe('Integration', () => {
    it('should handle full cache lifecycle', async () => {
      // 1. Check if cached (not found)
      firestore.getDoc.mockResolvedValue({ exists: () => false });
      let status = await checkIfCached('AAPL');
      expect(status.exists).toBe(false);

      // 2. Save to cache
      firestore.setDoc.mockResolvedValue();
      const saved = await setCompanyFactsToFirestore(
        'AAPL',
        mockCompanyFacts,
        '0000320193',
        'Apple Inc.'
      );
      expect(saved).toBe(true);

      // 3. Check if cached (found)
      firestore.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockFirestoreDoc,
      });
      status = await checkIfCached('AAPL');
      expect(status.exists).toBe(true);

      // 4. Get full data
      const data = await getCompanyFactsFromFirestore('AAPL');
      expect(data).not.toBeNull();

      // 5. Update access count
      firestore.updateDoc.mockResolvedValue();
      const updated = await updateAccessCount('AAPL');
      expect(updated).toBe(true);

      // 6. Invalidate
      const invalidated = await invalidateGlobalCache('AAPL');
      expect(invalidated).toBe(true);
    });
  });
});
