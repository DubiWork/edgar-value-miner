/**
 * Tests for useRecentSearches hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentSearches } from '../useRecentSearches';

// =============================================================================
// localStorage Mock
// =============================================================================

const STORAGE_KEY = 'edgar-recent-searches';

let mockStorage = {};

const localStorageMock = {
  getItem: vi.fn((key) => mockStorage[key] ?? null),
  setItem: vi.fn((key, value) => {
    mockStorage[key] = String(value);
  }),
  removeItem: vi.fn((key) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    mockStorage = {};
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// =============================================================================
// Tests
// =============================================================================

describe('useRecentSearches', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage = {};
  });

  // ---------------------------------------------------------------------------
  // Initial State
  // ---------------------------------------------------------------------------

  it('should return empty array when no recent searches exist', () => {
    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toEqual([]);
  });

  it('should load existing searches from localStorage on mount', () => {
    const existing = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', timestamp: 1000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', timestamp: 900 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(existing);

    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toEqual(existing);
  });

  // ---------------------------------------------------------------------------
  // Add Recent Search
  // ---------------------------------------------------------------------------

  it('should add a search to recent history', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });

    expect(result.current.recentSearches).toHaveLength(1);
    expect(result.current.recentSearches[0].ticker).toBe('AAPL');
    expect(result.current.recentSearches[0].companyName).toBe('Apple Inc.');
  });

  it('should persist to localStorage when adding', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String)
    );
    const stored = JSON.parse(mockStorage[STORAGE_KEY]);
    expect(stored).toHaveLength(1);
    expect(stored[0].ticker).toBe('AAPL');
  });

  it('should maintain most-recent-first order', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addRecentSearch('MSFT', 'Microsoft Corp');
    });
    act(() => {
      result.current.addRecentSearch('TSLA', 'Tesla, Inc.');
    });

    expect(result.current.recentSearches[0].ticker).toBe('TSLA');
    expect(result.current.recentSearches[1].ticker).toBe('MSFT');
    expect(result.current.recentSearches[2].ticker).toBe('AAPL');
  });

  it('should enforce max 5 items with FIFO eviction', () => {
    const { result } = renderHook(() => useRecentSearches());

    const tickers = ['AAPL', 'MSFT', 'TSLA', 'GOOGL', 'AMZN', 'NVDA', 'META'];
    tickers.forEach((ticker) => {
      act(() => {
        result.current.addRecentSearch(ticker, `${ticker} Co`);
      });
    });

    expect(result.current.recentSearches).toHaveLength(5);
    // Most recent first
    expect(result.current.recentSearches[0].ticker).toBe('META');
    // Oldest items should be evicted
    expect(result.current.recentSearches.map((s) => s.ticker)).not.toContain('AAPL');
    expect(result.current.recentSearches.map((s) => s.ticker)).not.toContain('MSFT');
  });

  it('should deduplicate by ticker (move to front)', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addRecentSearch('MSFT', 'Microsoft Corp');
    });
    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });

    expect(result.current.recentSearches).toHaveLength(2);
    expect(result.current.recentSearches[0].ticker).toBe('AAPL');
    expect(result.current.recentSearches[1].ticker).toBe('MSFT');
  });

  it('should normalize ticker to uppercase', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('aapl', 'Apple Inc.');
    });

    expect(result.current.recentSearches[0].ticker).toBe('AAPL');
  });

  it('should ignore invalid input (null/empty)', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch(null, '');
    });
    act(() => {
      result.current.addRecentSearch('', '');
    });

    expect(result.current.recentSearches).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Remove Recent Search
  // ---------------------------------------------------------------------------

  it('should remove a specific search by ticker', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addRecentSearch('MSFT', 'Microsoft Corp');
    });

    act(() => {
      result.current.removeRecentSearch('AAPL');
    });

    expect(result.current.recentSearches).toHaveLength(1);
    expect(result.current.recentSearches[0].ticker).toBe('MSFT');
  });

  // ---------------------------------------------------------------------------
  // Clear All
  // ---------------------------------------------------------------------------

  it('should clear all recent searches', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addRecentSearch('MSFT', 'Microsoft Corp');
    });

    act(() => {
      result.current.clearRecentSearches();
    });

    expect(result.current.recentSearches).toEqual([]);

    const stored = JSON.parse(mockStorage[STORAGE_KEY]);
    expect(stored).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Graceful Fallback
  // ---------------------------------------------------------------------------

  it('should handle corrupted localStorage data gracefully', () => {
    mockStorage[STORAGE_KEY] = 'not valid json{{{';

    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toEqual([]);
  });

  it('should handle localStorage being unavailable', () => {
    // Mock setItem to throw
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useRecentSearches());

    // Should still work in-memory even if persist fails
    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });

    expect(result.current.recentSearches).toHaveLength(1);
  });

  it('should filter out invalid entries from localStorage', () => {
    const mixed = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', timestamp: 1000 },
      { invalid: true },
      { ticker: 123, companyName: 'Bad', timestamp: 900 },
      null,
      'string',
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(mixed);

    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toHaveLength(1);
    expect(result.current.recentSearches[0].ticker).toBe('AAPL');
  });

  it('should handle non-array JSON from localStorage', () => {
    mockStorage[STORAGE_KEY] = JSON.stringify({ not: 'an array' });

    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toEqual([]);
  });

  it('should handle removeRecentSearch with null ticker', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });

    act(() => {
      result.current.removeRecentSearch(null);
    });

    // Should still have the search, not crash
    expect(result.current.recentSearches).toHaveLength(1);
  });

  it('should handle removeRecentSearch with empty string', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch('AAPL', 'Apple Inc.');
    });

    act(() => {
      result.current.removeRecentSearch('');
    });

    expect(result.current.recentSearches).toHaveLength(1);
  });
});
