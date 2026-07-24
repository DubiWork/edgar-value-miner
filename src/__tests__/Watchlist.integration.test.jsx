/**
 * Watchlist Integration Tests
 *
 * Tests cross-component flows between useWatchlist hook, WatchlistPanel,
 * and WatchlistCard. Verifies that data flows correctly from localStorage
 * through the hook into rendered components, including add/remove cycles,
 * capacity limits, ordering, and callback propagation.
 *
 * Framework: Vitest + React Testing Library
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { WatchlistPanel } from '../components/Watchlist/WatchlistPanel';
import { useWatchlist } from '../hooks/useWatchlist';

// =============================================================================
// Mock useStockQuote (WatchlistCard depends on it)
// =============================================================================

vi.mock('../hooks/useStockQuote', () => ({
  useStockQuote: () => ({
    data: { price: 150.25, changesPercentage: 1.5 },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  default: () => ({
    data: { price: 150.25, changesPercentage: 1.5 },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

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
// Tests
// =============================================================================

describe('Watchlist Integration Tests', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage = {};
    cleanup();
  });

  // ---------------------------------------------------------------------------
  // 1. WatchlistPanel renders when localStorage has watchlist items
  // ---------------------------------------------------------------------------

  it('WatchlistPanel renders when localStorage has watchlist items', () => {
    const items = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 900 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(items);

    const { result } = renderHook(() => useWatchlist());

    const onRemove = vi.fn();
    const onSelect = vi.fn();

    render(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={onRemove}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.getByTestId('watchlist-panel')).toBeTruthy();
    const cards = screen.getAllByTestId('watchlist-card');
    expect(cards).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // 2. WatchlistPanel does NOT render when localStorage is empty
  // ---------------------------------------------------------------------------

  it('WatchlistPanel does NOT render when localStorage is empty', () => {
    const { result } = renderHook(() => useWatchlist());

    const onRemove = vi.fn();
    const onSelect = vi.fn();

    const { container } = render(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={onRemove}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.queryByTestId('watchlist-panel')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  // ---------------------------------------------------------------------------
  // 3. Adding via useWatchlist hook updates watchlist state
  // ---------------------------------------------------------------------------

  it('adding via useWatchlist hook updates watchlist state', () => {
    const { result } = renderHook(() => useWatchlist());

    expect(result.current.watchlist).toHaveLength(0);

    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });

    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0].ticker).toBe('AAPL');

    // Verify localStorage was updated
    const stored = JSON.parse(mockStorage[STORAGE_KEY]);
    expect(stored).toHaveLength(1);
    expect(stored[0].ticker).toBe('AAPL');
  });

  // ---------------------------------------------------------------------------
  // 4. Adding when full (3/3) returns false
  // ---------------------------------------------------------------------------

  it('adding when full (3/3) returns false', () => {
    const existing = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 3000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 2000 },
      { ticker: 'GOOGL', companyName: 'Alphabet Inc.', addedAt: 1000 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(existing);

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.isFull).toBe(true);
    expect(result.current.watchlist).toHaveLength(3);

    let added;
    act(() => {
      added = result.current.addToWatchlist('TSLA', 'Tesla, Inc.');
    });

    expect(added).toBe(false);
    expect(result.current.watchlist).toHaveLength(3);
    // Panel should show upgrade prompt when full
    const onRemove = vi.fn();
    const onSelect = vi.fn();

    render(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={onRemove}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.getByTestId('watchlist-upgrade-prompt')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 5. Removing company updates panel immediately (re-render)
  // ---------------------------------------------------------------------------

  it('removing company updates panel immediately', () => {
    const items = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 2000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 1000 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(items);

    const { result } = renderHook(() => useWatchlist());

    const onSelect = vi.fn();

    // Initial render with 2 items
    const { rerender } = render(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={(ticker) => result.current.removeFromWatchlist(ticker)}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.getAllByTestId('watchlist-card')).toHaveLength(2);

    // Remove AAPL
    act(() => {
      result.current.removeFromWatchlist('AAPL');
    });

    // Re-render with updated state
    rerender(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={(ticker) => result.current.removeFromWatchlist(ticker)}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.getAllByTestId('watchlist-card')).toHaveLength(1);
    expect(screen.getByText('MSFT')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 6. After removal, slot is freed for new company
  // ---------------------------------------------------------------------------

  it('after removal, slot is freed for new company', () => {
    const existing = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 3000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 2000 },
      { ticker: 'GOOGL', companyName: 'Alphabet Inc.', addedAt: 1000 },
    ];
    mockStorage[STORAGE_KEY] = JSON.stringify(existing);

    const { result } = renderHook(() => useWatchlist());

    expect(result.current.isFull).toBe(true);

    // Remove one
    act(() => {
      result.current.removeFromWatchlist('GOOGL');
    });

    expect(result.current.isFull).toBe(false);
    expect(result.current.watchlist).toHaveLength(2);

    // Now adding should succeed (slot freed)
    act(() => {
      result.current.addToWatchlist('TSLA', 'Tesla, Inc.');
    });

    expect(result.current.watchlist).toHaveLength(3);
    expect(result.current.isInWatchlist('TSLA')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 7. Card click triggers onSelect callback with correct ticker
  // ---------------------------------------------------------------------------

  it('card click triggers onSelect callback with correct ticker', () => {
    const items = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 },
    ];

    const onRemove = vi.fn();
    const onSelect = vi.fn();

    render(
      <WatchlistPanel
        watchlist={items}
        onRemove={onRemove}
        onSelect={onSelect}
        isFull={false}
      />
    );

    const card = screen.getByTestId('watchlist-card-select');
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('AAPL');
  });

  // ---------------------------------------------------------------------------
  // 8. Cards display in most-recently-added-first order
  // ---------------------------------------------------------------------------

  it('cards display in most-recently-added-first order', () => {
    const items = [
      { ticker: 'AAPL', companyName: 'Apple Inc.', addedAt: 1000 },
      { ticker: 'MSFT', companyName: 'Microsoft Corp', addedAt: 3000 },
      { ticker: 'GOOGL', companyName: 'Alphabet Inc.', addedAt: 2000 },
    ];

    const onRemove = vi.fn();
    const onSelect = vi.fn();

    render(
      <WatchlistPanel
        watchlist={items}
        onRemove={onRemove}
        onSelect={onSelect}
        isFull={true}
      />
    );

    const tickerBadges = screen.getAllByTestId('watchlist-ticker-badge');

    // Most recent first: MSFT (3000) -> GOOGL (2000) -> AAPL (1000)
    expect(tickerBadges[0].textContent).toBe('MSFT');
    expect(tickerBadges[1].textContent).toBe('GOOGL');
    expect(tickerBadges[2].textContent).toBe('AAPL');
  });

  // ---------------------------------------------------------------------------
  // 9. Count badge updates correctly after add/remove
  // ---------------------------------------------------------------------------

  it('count badge updates correctly after add/remove', () => {
    const { result } = renderHook(() => useWatchlist());
    const onSelect = vi.fn();

    // Add 2 items
    act(() => {
      result.current.addToWatchlist('AAPL', 'Apple Inc.');
    });
    act(() => {
      result.current.addToWatchlist('MSFT', 'Microsoft Corp');
    });

    const { rerender } = render(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={(ticker) => result.current.removeFromWatchlist(ticker)}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.getByTestId('watchlist-count-badge').textContent).toBe('2/3');

    // Add a third
    act(() => {
      result.current.addToWatchlist('GOOGL', 'Alphabet Inc.');
    });

    rerender(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={(ticker) => result.current.removeFromWatchlist(ticker)}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.getByTestId('watchlist-count-badge').textContent).toBe('3/3');

    // Remove one
    act(() => {
      result.current.removeFromWatchlist('AAPL');
    });

    rerender(
      <WatchlistPanel
        watchlist={result.current.watchlist}
        onRemove={(ticker) => result.current.removeFromWatchlist(ticker)}
        onSelect={onSelect}
        isFull={result.current.isFull}
      />
    );

    expect(screen.getByTestId('watchlist-count-badge').textContent).toBe('2/3');
  });
});
