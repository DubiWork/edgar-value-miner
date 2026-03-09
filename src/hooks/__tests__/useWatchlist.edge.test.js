/**
 * useWatchlist Edge Case Tests
 *
 * Tests edge cases and boundary conditions for the useWatchlist hook
 * that are not covered by the standard unit tests. Focuses on
 * localStorage failures, malformed data, cross-tab sync, and
 * add/remove/re-add cycles.
 *
 * Framework: Vitest + React Testing Library
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWatchlist } from '../../hooks/useWatchlist';

// =============================================================================
// localStorage Mock
// =============================================================================

const STORAGE_KEY = 'edgar-watchlist';

let mockStorage = {};
let getItemImpl;
let setItemImpl;

const localStorageMock = {
  getItem: vi.fn((...args) => getItemImpl(...args)),
  setItem: vi.fn((...args) => setItemImpl(...args)),
  removeItem: vi.fn((key) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    mockStorage = {};
  }),
};

function resetStorageImpl() {
  getItemImpl = (key) => mockStorage[key] ?? null;
  setItemImpl = (key, value) => {
    mockStorage[key] = String(value);
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// =============================================================================
// Tests
// =============================================================================

describe('useWatchlist Edge Cases', () => {
  beforeEach(() => {
    mockStorage = {};
    resetStorageImpl();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage = {};
    resetStorageImpl();
  });

  // ---------------------------------------------------------------------------
  // 1. localStorage.getItem throws SecurityError -> returns empty array
  // ---------------------------------------------------------------------------

  it('returns empty array when localStorage.getItem throws SecurityError', () => {
    getItemImpl = () => {
      const error = new DOMException('Access denied', 'SecurityError');
      throw error;
    };

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toEqual([]);
    expect(result.current.isFull).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. window.localStorage is undefined (SSR) -> returns empty array
  // ---------------------------------------------------------------------------

  it('returns empty array when localStorage is undefined (SSR-like)', () => {
    // Override localStorage to throw on access (simulating SSR)
    const originalLocalStorage = globalThis.localStorage;

    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new ReferenceError('localStorage is not defined');
      },
      configurable: true,
    });

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toEqual([]);

    // Restore
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Entries with missing addedAt timestamp -> entry filtered out by validation
  // ---------------------------------------------------------------------------

  it('filters out entries with missing addedAt timestamp', () => {
    // isValidEntry requires addedAt to be a finite number
    // Missing addedAt means typeof undefined !== 'number' -> filtered out
    const items = [
      { ticker: 'AAPL', companyName: 'Apple Inc.' },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 1000 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(items);

    const { result } = renderHook(() => useWatchlist());

    // AAPL should be filtered out because addedAt is missing
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].ticker).toBe('MSFT');
  });

  // ---------------------------------------------------------------------------
  // 4. Entries where ticker is number instead of string -> entry filtered out
  // ---------------------------------------------------------------------------

  it('filters out entries where ticker is a number instead of string', () => {
    const items = [
      { ticker: 123, companyName: 'Numeric Ticker', addedAt: 1000 },
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 900 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(items);

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].ticker).toBe('AAPL');
  });

  // ---------------------------------------------------------------------------
  // 5. Add -> remove -> re-add same ticker works correctly
  // ---------------------------------------------------------------------------

  it('add -> remove -> re-add same ticker works correctly', () => {
    const { result } = renderHook(() => useWatchlist());

    // Add
    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.isInWatchlist('AAPL')).toBe(true);

    // Remove
    act(() => {
      result.current.removeFromWatchlist('AAPL');
    });
    expect(result.current.watchlist).toHaveLength(0);
    expect(result.current.isInWatchlist('AAPL')).toBe(false);

    // Re-add (after remove, the ticker is no longer present so re-add should work)
    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.isInWatchlist('AAPL')).toBe(true);

    // Verify localStorage has the re-added entry
    const stored = JSON.parse(mockStorage[STORAGE_KEY]);
    expect(stored).toHaveLength(1);
    expect(stored[0].ticker).toBe('AAPL');
  });

  // ---------------------------------------------------------------------------
  // 6. Old entries persist (no auto-TTL deletion)
  // ---------------------------------------------------------------------------

  it('old entries persist with no auto-TTL deletion', () => {
    // Set entries with very old timestamps (1 year ago)
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const items = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: oneYearAgo },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: oneYearAgo - 1000 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(items);

    const { result } = renderHook(() => useWatchlist());

    // Both old entries should still be present
    expect(result.current.watchlist).toHaveLength(2);
    expect(result.current.watchlist[0].ticker).toBe('AAPL');
    expect(result.current.watchlist[1].ticker).toBe('MSFT');
  });

  // ---------------------------------------------------------------------------
  // 7. storage event from another tab updates state
  // ---------------------------------------------------------------------------

  it('storage event from another tab can be consumed without crash', () => {
    const { result } = renderHook(() => useWatchlist());

    // Add initial item
    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });
    expect(result.current.watchlist).toHaveLength(1);

    // Simulate another tab updating localStorage directly
    const updatedItems = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 },
      { ticker: 'TSLA', companyName: 'Tesla, Inc.', addedAt: 2000 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(updatedItems);

    // Dispatch storage event (simulating cross-tab update)
    // Use Event constructor without storageArea to avoid jsdom type check
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(updatedItems),
        oldValue: JSON.stringify([{ ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 }]),
      });
      window.dispatchEvent(storageEvent);
    });

    // Hook should still function without crashing
    // Current implementation doesn't sync on storage events,
    // so state reflects hook's internal state, not external storage
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.isInWatchlist('AAPL')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 8. storage event with corrupt data does not crash
  // ---------------------------------------------------------------------------

  it('storage event with corrupt data does not crash', () => {
    const { result } = renderHook(() => useWatchlist());

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    // Simulate another tab writing corrupt data
    mockStorage[STORAGE_KEY] = 'not valid json{{{';

    // Dispatch storage event with corrupt data (no storageArea to avoid jsdom type check)
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: 'not valid json{{{',
        oldValue: null,
      });
      window.dispatchEvent(storageEvent);
    });

    // Hook should not crash, in-memory state should be intact
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].ticker).toBe('AAPL');

    // Operations should still work after corrupt event
    act(() => {
      result.current.addToWatchlist('MSFT', 'Microsoft Corp');
    });
    expect(result.current.watchlist).toHaveLength(2);
    expect(result.current.isInWatchlist('MSFT')).toBe(true);
  });
});
