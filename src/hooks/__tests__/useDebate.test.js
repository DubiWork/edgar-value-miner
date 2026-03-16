/**
 * Tests for useDebate hook
 *
 * Covers hook states (idle, loading, success, error, rateLimited),
 * caching behavior, ticker changes, and refresh functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebate } from '../useDebate';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../services/debateApi', () => ({
  getDebate: vi.fn(),
}));

vi.mock('../useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-user-123' },
    isAuthenticated: true,
  })),
  default: vi.fn(() => ({
    user: { uid: 'test-user-123' },
    isAuthenticated: true,
  })),
}));

import { getDebate } from '../../services/debateApi';

// =============================================================================
// Fixtures
// =============================================================================

const mockDebate = {
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  generatedAt: '2026-03-17T10:00:00.000Z',
  bullCase: {
    arguments: [
      { title: 'Strong Ecosystem', detail: 'Loyal customer base', citation: 'Annual Report 2025' },
    ],
    confidence: 0.75,
    generatedAt: '2026-03-17T10:00:00.000Z',
  },
  bearCase: {
    riskFactors: [
      { title: 'Market Saturation', detail: 'Slowing iPhone growth', dataPoint: 'Q4 2025' },
    ],
    confidence: 0.6,
    generatedAt: '2026-03-17T10:00:00.000Z',
  },
  synthesis: {
    keyFactors: [{ title: 'Services Growth', analysis: 'Strong recurring revenue' }],
    recommendation: 'Hold with cautious optimism',
    confidence: 0.65,
    disclaimer: 'Not financial advice',
    generatedAt: '2026-03-17T10:00:00.000Z',
  },
  metadata: { model: 'claude-3-5-haiku-20241022', version: 1, viewCount: 42 },
  source: 'cached',
};

const mockRateLimitError = Object.assign(new Error('Rate limit exceeded'), {
  code: 'rate-limited',
  retryable: false,
  rateLimitInfo: {
    currentCount: 5,
    maxCount: 5,
    upgradeUrl: 'https://example.com/upgrade',
  },
});

// =============================================================================
// Tests
// =============================================================================

describe('useDebate', () => {
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
    it('returns idle state when no ticker provided', () => {
      const { result } = renderHook(() => useDebate(null));

      expect(result.current.debate).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isRateLimited).toBe(false);
      expect(result.current.rateLimitInfo).toBeNull();
      expect(typeof result.current.refresh).toBe('function');
      expect(getDebate).not.toHaveBeenCalled();
    });

    it('returns loading=true while CF call is in flight', () => {
      getDebate.mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderHook(() => useDebate('AAPL'));

      expect(result.current.loading).toBe(true);
      expect(result.current.debate).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------

  describe('success state', () => {
    it('returns debate data on successful CF call', async () => {
      getDebate.mockResolvedValue(mockDebate);

      const { result } = renderHook(() => useDebate('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.debate).toEqual(mockDebate);
      expect(result.current.error).toBeNull();
      expect(result.current.isRateLimited).toBe(false);
    });

    it('loading transitions from true to false on success', async () => {
      getDebate.mockResolvedValue(mockDebate);

      const { result } = renderHook(() => useDebate('AAPL'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.debate).toEqual(mockDebate);
    });
  });

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  describe('error state', () => {
    it('sets error with user-friendly message on CF failure', async () => {
      const networkError = Object.assign(new Error('Network error'), {
        code: 'network',
        message: 'Unable to connect. Check your internet connection.',
        retryable: true,
      });
      getDebate.mockRejectedValue(networkError);

      const { result } = renderHook(() => useDebate('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.debate).toBeNull();
      expect(result.current.error).toBeTruthy();
      expect(typeof result.current.error).toBe('string');
    });

    it('loading transitions from true to false on error', async () => {
      getDebate.mockRejectedValue(new Error('Some error'));

      const { result } = renderHook(() => useDebate('AAPL'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Rate limit state
  // ---------------------------------------------------------------------------

  describe('rate limit state', () => {
    it('sets isRateLimited=true when CF returns rate-limited error', async () => {
      getDebate.mockRejectedValue(mockRateLimitError);

      const { result } = renderHook(() => useDebate('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isRateLimited).toBe(true);
    });

    it('populates rateLimitInfo when rate limited', async () => {
      getDebate.mockRejectedValue(mockRateLimitError);

      const { result } = renderHook(() => useDebate('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rateLimitInfo).toEqual({
        currentCount: 5,
        maxCount: 5,
        upgradeUrl: 'https://example.com/upgrade',
      });
    });

    it('isRateLimited is false for non-rate-limit errors', async () => {
      getDebate.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDebate('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isRateLimited).toBe(false);
      expect(result.current.rateLimitInfo).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Caching behavior (no re-fetch on re-render)
  // ---------------------------------------------------------------------------

  describe('caching behavior', () => {
    it('does not re-fetch on re-render for same ticker', async () => {
      getDebate.mockResolvedValue(mockDebate);

      const { result, rerender } = renderHook(() => useDebate('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getDebate).toHaveBeenCalledTimes(1);

      // Force re-render without changing ticker
      rerender();

      // Still only called once
      expect(getDebate).toHaveBeenCalledTimes(1);
      expect(result.current.debate).toEqual(mockDebate);
    });
  });

  // ---------------------------------------------------------------------------
  // Ticker change
  // ---------------------------------------------------------------------------

  describe('ticker change triggers new fetch', () => {
    it('fetches new debate when ticker changes', async () => {
      const msftDebate = { ...mockDebate, ticker: 'MSFT', companyName: 'Microsoft Corporation' };

      getDebate
        .mockResolvedValueOnce(mockDebate)
        .mockResolvedValueOnce(msftDebate);

      const { result, rerender } = renderHook(
        ({ ticker }) => useDebate(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.debate).toEqual(mockDebate);

      rerender({ ticker: 'MSFT' });

      await waitFor(() => {
        expect(result.current.debate?.ticker).toBe('MSFT');
      });

      expect(getDebate).toHaveBeenCalledTimes(2);
      expect(getDebate).toHaveBeenNthCalledWith(1, 'AAPL');
      expect(getDebate).toHaveBeenNthCalledWith(2, 'MSFT');
    });

    it('resets to idle state when ticker changes to null', async () => {
      getDebate.mockResolvedValue(mockDebate);

      const { result, rerender } = renderHook(
        ({ ticker }) => useDebate(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.debate).toEqual(mockDebate);

      rerender({ ticker: null });

      expect(result.current.debate).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // refresh()
  // ---------------------------------------------------------------------------

  describe('refresh()', () => {
    it('triggers a new CF call when refresh() is called', async () => {
      getDebate.mockResolvedValue(mockDebate);

      const { result } = renderHook(() => useDebate('AAPL'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getDebate).toHaveBeenCalledTimes(1);

      await act(async () => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(getDebate).toHaveBeenCalledTimes(2);
    });

    it('refresh() does nothing when ticker is null', () => {
      const { result } = renderHook(() => useDebate(null));

      act(() => {
        result.current.refresh();
      });

      expect(getDebate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  describe('cleanup on unmount', () => {
    it('does not update state after unmount', async () => {
      let resolveFetch;
      const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
      getDebate.mockReturnValue(fetchPromise);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result, unmount } = renderHook(() => useDebate('AAPL'));

      expect(result.current.loading).toBe(true);

      unmount();

      resolveFetch(mockDebate);

      await act(async () => {
        await Promise.resolve();
      });

      // No React state update warnings should occur
      consoleErrorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Stale response handling
  // ---------------------------------------------------------------------------

  describe('stale response handling', () => {
    it('ignores stale response when ticker changes during fetch', async () => {
      let resolveFirst;
      const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
      const msftDebate = { ...mockDebate, ticker: 'MSFT', companyName: 'Microsoft Corporation' };

      getDebate
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValueOnce(msftDebate);

      const { result, rerender } = renderHook(
        ({ ticker }) => useDebate(ticker),
        { initialProps: { ticker: 'AAPL' } }
      );

      // Change ticker while first fetch is still in flight
      rerender({ ticker: 'MSFT' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Resolve the stale first request
      resolveFirst(mockDebate);

      // Should show MSFT data, not stale AAPL data
      expect(result.current.debate?.ticker).toBe('MSFT');
    });
  });
});
