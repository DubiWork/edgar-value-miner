/**
 * Tests for useCompanySearch hook
 *
 * Covers:
 * - searchCompany reference stability (stale closure fix)
 * - Deduplication (same ticker while loading is rejected)
 * - Sequential search (abort first, complete second)
 * - Error categorization (network error, API error)
 * - clearError resets error state
 * - reset cancels in-flight requests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCompanySearch } from '../useCompanySearch';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../services/cacheCoordinator', () => ({
  default: {
    getCompanyData: vi.fn(),
  },
}));

vi.mock('../../utils/gaapNormalizer', () => ({
  default: {
    normalizeCompanyFacts: vi.fn((facts) => facts ?? {}),
  },
}));

import cacheCoordinator from '../../services/cacheCoordinator';
import gaapNormalizer from '../../utils/gaapNormalizer';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockCompanyFacts = {
  revenues: [{ year: 2023, value: 383285000000 }],
  netIncome: [{ year: 2023, value: 96995000000 }],
};

const mockSuccessResult = {
  success: true,
  data: {
    ticker: 'AAPL',
    cik: '0000320193',
    companyName: 'Apple Inc.',
    companyFacts: mockCompanyFacts,
  },
  metadata: {
    source: 'indexeddb',
    cacheHit: true,
    needsRefresh: false,
    lastUpdated: new Date('2024-01-01'),
    costSaved: 0.05,
  },
};

// =============================================================================
// Tests
// =============================================================================

describe('useCompanySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gaapNormalizer.normalizeCompanyFacts.mockImplementation((facts) => facts ?? {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Reference stability (stale closure fix)
  // ---------------------------------------------------------------------------

  describe('searchCompany reference stability', () => {
    it('searchCompany reference is stable when loading toggles true → false', async () => {
      // Arrange: first call resolves, so loading goes true then false
      cacheCoordinator.getCompanyData.mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useCompanySearch());

      const refBefore = result.current.searchCompany;

      // Act: trigger a search (loading: false → true → false)
      await act(async () => {
        await result.current.searchCompany('AAPL');
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const refAfter = result.current.searchCompany;

      // Assert: same function reference — no stale closure caused recreation
      expect(refBefore).toBe(refAfter);
    });

    it('searchCompany reference is stable across multiple re-renders triggered by state changes', async () => {
      cacheCoordinator.getCompanyData.mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useCompanySearch());
      const initialRef = result.current.searchCompany;

      // Trigger two complete search cycles
      await act(async () => {
        await result.current.searchCompany('AAPL');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      cacheCoordinator.getCompanyData.mockResolvedValue({
        ...mockSuccessResult,
        data: { ...mockSuccessResult.data, ticker: 'MSFT' },
      });

      await act(async () => {
        await result.current.searchCompany('MSFT');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Reference must remain the same throughout
      expect(result.current.searchCompany).toBe(initialRef);
    });
  });

  // ---------------------------------------------------------------------------
  // Deduplication
  // ---------------------------------------------------------------------------

  describe('deduplication', () => {
    it('rejects a second call for the same ticker while the first is still loading', async () => {
      // First call never resolves so loading stays true
      let resolveFirst;
      const pending = new Promise((resolve) => { resolveFirst = resolve; });
      cacheCoordinator.getCompanyData.mockReturnValueOnce(pending);

      const { result } = renderHook(() => useCompanySearch());

      // Start first search (will stay loading)
      act(() => {
        result.current.searchCompany('AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(true));

      // Second call for the same ticker should be a no-op
      act(() => {
        result.current.searchCompany('AAPL');
      });

      // cacheCoordinator should only have been called once
      expect(cacheCoordinator.getCompanyData).toHaveBeenCalledTimes(1);

      // Cleanup: resolve the pending request
      resolveFirst(mockSuccessResult);
    });

    it('allows a new search for a different ticker while loading', async () => {
      let resolveFirst;
      const pending = new Promise((resolve) => { resolveFirst = resolve; });
      cacheCoordinator.getCompanyData
        .mockReturnValueOnce(pending)
        .mockResolvedValueOnce({
          ...mockSuccessResult,
          data: { ...mockSuccessResult.data, ticker: 'MSFT', companyName: 'Microsoft' },
        });

      const { result } = renderHook(() => useCompanySearch());

      act(() => {
        result.current.searchCompany('AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(true));

      // Different ticker while loading — should proceed
      await act(async () => {
        await result.current.searchCompany('MSFT');
      });

      // Two calls to cacheCoordinator: AAPL + MSFT
      expect(cacheCoordinator.getCompanyData).toHaveBeenCalledTimes(2);

      resolveFirst(mockSuccessResult);
    });
  });

  // ---------------------------------------------------------------------------
  // Sequential search (abort first, complete second)
  // ---------------------------------------------------------------------------

  describe('sequential search', () => {
    it('aborts the first request and completes the second when called sequentially', async () => {
      let resolveFirst;
      const firstPending = new Promise((resolve) => { resolveFirst = resolve; });

      cacheCoordinator.getCompanyData
        .mockReturnValueOnce(firstPending)
        .mockResolvedValueOnce({
          ...mockSuccessResult,
          data: { ...mockSuccessResult.data, ticker: 'MSFT', companyName: 'Microsoft Corporation' },
        });

      const { result } = renderHook(() => useCompanySearch());

      // Start AAPL search
      act(() => {
        result.current.searchCompany('AAPL');
      });

      // Immediately start MSFT search (different ticker aborts AAPL)
      await act(async () => {
        await result.current.searchCompany('MSFT');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Final state should reflect MSFT, not AAPL
      expect(result.current.data).toHaveProperty('ticker', 'MSFT');
      expect(result.current.error).toBeNull();

      // Resolve the stale first request — should be ignored
      resolveFirst(mockSuccessResult);
    });
  });

  // ---------------------------------------------------------------------------
  // Error categorization
  // ---------------------------------------------------------------------------

  describe('error categorization', () => {
    it('categorizes a network-style error with type NETWORK', async () => {
      const networkErr = new TypeError('Failed to fetch');
      cacheCoordinator.getCompanyData.mockRejectedValue(networkErr);

      const { result } = renderHook(() => useCompanySearch());

      await act(async () => {
        await result.current.searchCompany('AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).not.toBeNull();
      expect(result.current.error.type).toBe('NETWORK');
      expect(result.current.error.retryable).toBe(true);
    });

    it('categorizes a 404 / ticker-not-found error with type DATA', async () => {
      const dataErr = new Error('Ticker not found');
      dataErr.code = 'TICKER_NOT_FOUND';
      cacheCoordinator.getCompanyData.mockRejectedValue(dataErr);

      const { result } = renderHook(() => useCompanySearch());

      await act(async () => {
        await result.current.searchCompany('ZZZZ');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).not.toBeNull();
      expect(result.current.error.type).toBe('DATA');
      expect(result.current.error.retryable).toBe(false);
    });

    it('categorizes a cache-layer error with type CACHE', async () => {
      const cacheErr = new Error('IndexedDB transaction failed');
      cacheErr.code = 'TRANSACTION_ERROR';
      cacheCoordinator.getCompanyData.mockRejectedValue(cacheErr);

      const { result } = renderHook(() => useCompanySearch());

      await act(async () => {
        await result.current.searchCompany('AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).not.toBeNull();
      expect(result.current.error.type).toBe('CACHE');
      expect(result.current.error.retryable).toBe(true);
    });

    it('sets a validation error when ticker is empty', async () => {
      const { result } = renderHook(() => useCompanySearch());

      await act(async () => {
        await result.current.searchCompany('');
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error.type).toBe('DATA');
      expect(cacheCoordinator.getCompanyData).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // clearError
  // ---------------------------------------------------------------------------

  describe('clearError', () => {
    it('resets error state to null', async () => {
      const networkErr = new TypeError('Failed to fetch');
      cacheCoordinator.getCompanyData.mockRejectedValue(networkErr);

      const { result } = renderHook(() => useCompanySearch());

      await act(async () => {
        await result.current.searchCompany('AAPL');
      });

      await waitFor(() => expect(result.current.error).not.toBeNull());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('clearError is a no-op when error is already null', () => {
      const { result } = renderHook(() => useCompanySearch());

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('cancels in-flight requests and resets all state to initial values', async () => {
      let resolveFirst;
      const pending = new Promise((resolve) => { resolveFirst = resolve; });
      cacheCoordinator.getCompanyData.mockReturnValue(pending);

      const { result } = renderHook(() => useCompanySearch());

      act(() => {
        result.current.searchCompany('AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(true));

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.metadata).toBeNull();

      // Resolve pending — state should stay reset
      resolveFirst(mockSuccessResult);
      await act(async () => { await Promise.resolve(); });

      expect(result.current.data).toBeNull();
    });

    it('reset allows a fresh search after reset', async () => {
      cacheCoordinator.getCompanyData.mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useCompanySearch());

      await act(async () => {
        await result.current.searchCompany('AAPL');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();

      // Search the same ticker again — deduplication guard should be cleared
      await act(async () => {
        await result.current.searchCompany('AAPL');
      });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).not.toBeNull();
      expect(cacheCoordinator.getCompanyData).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Successful fetch
  // ---------------------------------------------------------------------------

  describe('successful fetch', () => {
    it('populates data and metadata on successful fetch', async () => {
      cacheCoordinator.getCompanyData.mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useCompanySearch());

      await act(async () => {
        await result.current.searchCompany('AAPL');
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).toHaveProperty('ticker', 'AAPL');
      expect(result.current.data).toHaveProperty('cik', '0000320193');
      expect(result.current.data).toHaveProperty('companyName', 'Apple Inc.');
      expect(result.current.metadata).toEqual(mockSuccessResult.metadata);
      expect(result.current.error).toBeNull();
    });
  });
});
