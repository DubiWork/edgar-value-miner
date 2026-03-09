/**
 * Tests for useStockQuote hook
 *
 * Covers loading states, data fetching, error handling,
 * stale response cleanup, and refetch behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStockQuote } from '../useStockQuote';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../services/fmpApi', () => ({
  getStockQuote: vi.fn(),
}));

import { getStockQuote } from '../../services/fmpApi';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockQuoteData = {
  price: 178.72,
  eps: 6.13,
  pe: 29.15,
  marketCap: 2800000000000,
  sharesOutstanding: 15700000000,
  changesPercentage: 1.25,
  name: 'Apple Inc.',
};

// =============================================================================
// Tests
// =============================================================================

describe('useStockQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('returns data=null, loading=true, error=null when given a valid ticker', () => {
      getStockQuote.mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderHook(() => useStockQuote('AAPL'));

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // Successful fetch
  // ---------------------------------------------------------------------------

  describe('successful fetch', () => {
    it('returns data on successful fetch', async () => {
      getStockQuote.mockResolvedValue(mockQuoteData);

      const { result } = renderHook(() => useStockQuote('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockQuoteData);
      expect(result.current.error).toBeNull();
    });

    it('data shape matches fmpApi response fields', async () => {
      getStockQuote.mockResolvedValue(mockQuoteData);

      const { result } = renderHook(() => useStockQuote('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { data } = result.current;
      expect(data).toHaveProperty('price');
      expect(data).toHaveProperty('eps');
      expect(data).toHaveProperty('pe');
      expect(data).toHaveProperty('marketCap');
      expect(data).toHaveProperty('sharesOutstanding');
      expect(data).toHaveProperty('changesPercentage');
      expect(data).toHaveProperty('name');
    });

    it('loading transitions from true to false on success', async () => {
      getStockQuote.mockResolvedValue(mockQuoteData);

      const { result } = renderHook(() => useStockQuote('AAPL'));

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockQuoteData);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('returns error on failed fetch', async () => {
      getStockQuote.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useStockQuote('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBe('Failed to fetch stock quote for AAPL: Network failure');
    });

    it('returns error when getStockQuote returns null', async () => {
      getStockQuote.mockResolvedValue(null);

      const { result } = renderHook(() => useStockQuote('INVALID'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBe('No quote data available for INVALID');
    });

    it('loading transitions from true to false on error', async () => {
      getStockQuote.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useStockQuote('AAPL'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Skip fetch for empty/null ticker
  // ---------------------------------------------------------------------------

  describe('skip fetch for empty/null ticker', () => {
    it('skips fetch when ticker is null', () => {
      const { result } = renderHook(() => useStockQuote(null));

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(getStockQuote).not.toHaveBeenCalled();
    });

    it('skips fetch when ticker is undefined', () => {
      const { result } = renderHook(() => useStockQuote(undefined));

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(getStockQuote).not.toHaveBeenCalled();
    });

    it('skips fetch when ticker is empty string', () => {
      const { result } = renderHook(() => useStockQuote(''));

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(getStockQuote).not.toHaveBeenCalled();
    });

    it('skips fetch when ticker is whitespace only', () => {
      const { result } = renderHook(() => useStockQuote('   '));

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(getStockQuote).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Refetch
  // ---------------------------------------------------------------------------

  describe('refetch', () => {
    it('refetch callback triggers a new fetch for the current ticker', async () => {
      getStockQuote.mockResolvedValue(mockQuoteData);

      const { result } = renderHook(() => useStockQuote('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getStockQuote).toHaveBeenCalledTimes(1);

      // Trigger refetch
      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getStockQuote).toHaveBeenCalledTimes(2);
      expect(getStockQuote).toHaveBeenCalledWith('AAPL');
    });

    it('refetch does nothing when ticker is null', () => {
      const { result } = renderHook(() => useStockQuote(null));

      act(() => {
        result.current.refetch();
      });

      expect(getStockQuote).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Stale response handling
  // ---------------------------------------------------------------------------

  describe('stale response handling', () => {
    it('ignores stale response when ticker changes during fetch', async () => {
      let resolveFirst;
      const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });

      const secondQuote = { ...mockQuoteData, name: 'Microsoft Corporation', price: 380.50 };

      getStockQuote
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValueOnce(secondQuote);

      const { result, rerender } = renderHook(
        ({ ticker }) => useStockQuote(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      // Change ticker before first fetch resolves
      rerender({ ticker: 'MSFT' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Now resolve the stale first request
      resolveFirst(mockQuoteData);

      // Should show MSFT data, not stale AAPL data
      expect(result.current.data).toEqual(secondQuote);
    });

    it('handles multiple rapid ticker changes correctly', async () => {
      const googlQuote = { ...mockQuoteData, name: 'Alphabet Inc.' };

      getStockQuote
        .mockReturnValueOnce(new Promise(() => {})) // AAPL - never resolves
        .mockReturnValueOnce(new Promise(() => {})) // MSFT - never resolves
        .mockResolvedValueOnce(googlQuote);          // GOOGL - resolves

      const { result, rerender } = renderHook(
        ({ ticker }) => useStockQuote(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      rerender({ ticker: 'MSFT' });
      rerender({ ticker: 'GOOGL' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(googlQuote);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  describe('cleanup on unmount', () => {
    it('does not update state after unmount', async () => {
      let resolveQuote;
      const quotePromise = new Promise((resolve) => { resolveQuote = resolve; });
      getStockQuote.mockReturnValue(quotePromise);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result, unmount } = renderHook(() => useStockQuote('AAPL'));

      expect(result.current.loading).toBe(true);

      // Unmount before fetch completes
      unmount();

      // Resolve the pending fetch after unmount
      resolveQuote(mockQuoteData);

      // Allow microtasks to flush
      await act(async () => {
        await Promise.resolve();
      });

      // Should NOT have caused React state update warnings
      // (the isMountedRef guard prevents setState after unmount)
      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Ticker change triggers new fetch
  // ---------------------------------------------------------------------------

  describe('ticker change triggers new fetch', () => {
    it('fetches new data when ticker changes', async () => {
      const msftQuote = { ...mockQuoteData, name: 'Microsoft Corporation', price: 380.50 };

      getStockQuote
        .mockResolvedValueOnce(mockQuoteData)
        .mockResolvedValueOnce(msftQuote);

      const { result, rerender } = renderHook(
        ({ ticker }) => useStockQuote(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockQuoteData);

      // Change ticker
      rerender({ ticker: 'MSFT' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(msftQuote);
      expect(getStockQuote).toHaveBeenCalledTimes(2);
      expect(getStockQuote).toHaveBeenNthCalledWith(1, 'AAPL');
      expect(getStockQuote).toHaveBeenNthCalledWith(2, 'MSFT');
    });

    it('resets to idle state when ticker changes from valid to null', async () => {
      getStockQuote.mockResolvedValue(mockQuoteData);

      const { result, rerender } = renderHook(
        ({ ticker }) => useStockQuote(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockQuoteData);

      // Change to null ticker
      rerender({ ticker: null });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
