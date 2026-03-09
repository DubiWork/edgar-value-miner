/**
 * Tests for useWatchlist hook and formatTimeAgo utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchlist } from '../useWatchlist';
import { formatTimeAgo } from '../../utils/formatTimeAgo';

// =============================================================================
// localStorage Mock
// =============================================================================

const STORAGE_KEY = 'edgar-watchlist';

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
// useWatchlist Tests
// =============================================================================

describe('useWatchlist', () => {
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

  it('should return empty watchlist when no data in localStorage', () => {
    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toEqual([]);
    expect(result.current.isFull).toBe(false);
  });

  it('should load existing watchlist from localStorage on mount', () => {
    const existing = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 900 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(existing);

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toEqual(existing);
    expect(result.current.isFull).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // addToWatchlist
  // ---------------------------------------------------------------------------

  it('should add a company to the watchlist with ticker, companyName, addedAt', () => {
    const { result } = renderHook(() => useWatchlist());

    let added;
    act(() => {
      added = result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    expect(added).toBe(true);
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].ticker).toBe('AAPL');
    expect(result.current.watchlist[0].companyName).toBe('Apple Inc.');
    expect(typeof result.current.watchlist[0].addedAt).toBe('number');
  });

  it('should persist to localStorage when adding', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String)
    );
    const stored = JSON.parse(mockStorage[STORAGE_KEY]);
    expect(stored).toHaveLength(1);
    expect(stored[0].ticker).toBe('AAPL');
  });

  it('should return false and not add when watchlist has 3 entries', () => {
    const existing = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 900 },
      { ticker: 'GOOGL', companyName: 'Alphabet Inc.', addedAt: 800 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(existing);

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.isFull).toBe(true);

    let added;
    act(() => {
      added = result.current.addToWatchlist('TSLA', 'Tesla, Inc.');
    });

    expect(added).toBe(false);
    expect(result.current.watchlist).toHaveLength(3);
  });

  it('should deduplicate by ticker (case-insensitive), returning false', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    let added;
    act(() => {
      added = result.current.addToWatchlist('aapl', 'Apple Inc.');
    });

    expect(added).toBe(false);
    expect(result.current.watchlist).toHaveLength(1);
  });

  it('should normalize ticker to uppercase', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('aapl', 'Apple Inc.');
    });

    expect(result.current.watchlist[0].ticker).toBe('AAPL');
  });

  it('should reject null ticker', () => {
    const { result } = renderHook(() => useWatchlist());

    let added;
    act(() => {
      added = result.current.addToWatchlist(null, 'Some Company');
    });

    expect(added).toBe(false);
    expect(result.current.watchlist).toEqual([]);
  });

  it('should reject empty string ticker', () => {
    const { result } = renderHook(() => useWatchlist());

    let added;
    act(() => {
      added = result.current.addToWatchlist('', 'Some Company');
    });

    expect(added).toBe(false);
    expect(result.current.watchlist).toEqual([]);
  });

  it('should reject whitespace-only ticker', () => {
    const { result } = renderHook(() => useWatchlist());

    let added;
    act(() => {
      added = result.current.addToWatchlist('   ', 'Some Company');
    });

    expect(added).toBe(false);
    expect(result.current.watchlist).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // removeFromWatchlist
  // ---------------------------------------------------------------------------

  it('should remove a company by ticker and persist to localStorage', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addToWatchlist('MSFT', 'Microsoft Corp');
    });

    act(() => {
      result.current.removeFromWatchlist('AAPL');
    });

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].ticker).toBe('MSFT');

    const stored = JSON.parse(mockStorage[STORAGE_KEY]);
    expect(stored).toHaveLength(1);
  });

  it('should be a no-op for a missing ticker', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    act(() => {
      result.current.removeFromWatchlist('TSLA');
    });

    expect(result.current.watchlist).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // isInWatchlist
  // ---------------------------------------------------------------------------

  it('should return true for a ticker in the watchlist (case-insensitive)', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    expect(result.current.isInWatchlist('AAPL')).toBe(true);
    expect(result.current.isInWatchlist('aapl')).toBe(true);
    expect(result.current.isInWatchlist('Aapl')).toBe(true);
  });

  it('should return false for a ticker not in the watchlist', () => {
    const { result } = renderHook(() => useWatchlist());

    expect(result.current.isInWatchlist('AAPL')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // isFull
  // ---------------------------------------------------------------------------

  it('should return true when watchlist has 3 items', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addToWatchlist('MSFT', 'Microsoft Corp');
    });
    act(() => {
      result.current.addToWatchlist('GOOGL', 'Alphabet Inc.');
    });

    expect(result.current.isFull).toBe(true);
  });

  it('should return false when watchlist has fewer than 3 items', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    expect(result.current.isFull).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // clearWatchlist
  // ---------------------------------------------------------------------------

  it('should clear all entries and persist empty array', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addToWatchlist('MSFT', 'Microsoft Corp');
    });

    act(() => {
      result.current.clearWatchlist();
    });

    expect(result.current.watchlist).toEqual([]);
    expect(result.current.isFull).toBe(false);

    const stored = JSON.parse(mockStorage[STORAGE_KEY]);
    expect(stored).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Corrupted / Invalid localStorage
  // ---------------------------------------------------------------------------

  it('should handle corrupted localStorage (invalid JSON)', () => {
    mockStorage[STORAGE_KEY] = 'not valid json{{{';

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toEqual([]);
  });

  it('should handle non-array JSON from localStorage', () => {
    mockStorage[STORAGE_KEY] = JSON.stringify({ not: 'an array' });

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toEqual([]);
  });

  it('should filter out invalid entries from localStorage', () => {
    const mixed = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 },
      { invalid: true },
      { ticker: 123, companyName: 'Bad', addedAt: 900 },
      null,
      'string',
      { ticker: '', companyName: 'Empty ticker', addedAt: 800 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(mixed);

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].ticker).toBe('AAPL');
  });

  it('should handle localStorage QuotaExceededError gracefully', () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useWatchlist());

    // Should still work in-memory even if persist fails
    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    expect(result.current.watchlist).toHaveLength(1);
  });
});

// =============================================================================
// formatTimeAgo Tests
// =============================================================================

describe('formatTimeAgo', () => {
  const NOW = 1709500000000; // Fixed reference point

  it('should return "Just now" for timestamps less than 1 minute ago', () => {
    expect(formatTimeAgo(NOW - 30_000, NOW)).toBe('Just now');
    expect(formatTimeAgo(NOW - 59_999, NOW)).toBe('Just now');
    expect(formatTimeAgo(NOW, NOW)).toBe('Just now');
  });

  it('should return "X min ago" for 1-59 minutes', () => {
    expect(formatTimeAgo(NOW - 60_000, NOW)).toBe('1 min ago');
    expect(formatTimeAgo(NOW - 300_000, NOW)).toBe('5 min ago');
    expect(formatTimeAgo(NOW - 3_540_000, NOW)).toBe('59 min ago');
  });

  it('should return "X hr ago" for 1-23 hours', () => {
    expect(formatTimeAgo(NOW - 3_600_000, NOW)).toBe('1 hr ago');
    expect(formatTimeAgo(NOW - 7_200_000, NOW)).toBe('2 hr ago');
    expect(formatTimeAgo(NOW - 82_800_000, NOW)).toBe('23 hr ago');
  });

  it('should return "Yesterday" for 24-47 hours ago', () => {
    expect(formatTimeAgo(NOW - 86_400_000, NOW)).toBe('Yesterday');
    expect(formatTimeAgo(NOW - 170_000_000, NOW)).toBe('Yesterday');
  });

  it('should return a date string for 48+ hours ago', () => {
    const twoDaysAgo = NOW - 172_800_000;
    const result = formatTimeAgo(twoDaysAgo, NOW);
    // Should be a formatted date string (not "Yesterday" or relative)
    expect(result).not.toBe('Yesterday');
    expect(result).not.toContain('ago');
    expect(result).not.toBe('Just now');
    // Should contain month abbreviation and year
    expect(result).toMatch(/\w{3}\s+\d{1,2},\s+\d{4}/);
  });

  it('should return "Unknown" for invalid input', () => {
    expect(formatTimeAgo(null)).toBe('Unknown');
    expect(formatTimeAgo(undefined)).toBe('Unknown');
    expect(formatTimeAgo('not a number')).toBe('Unknown');
    expect(formatTimeAgo(Infinity)).toBe('Unknown');
  });
});
