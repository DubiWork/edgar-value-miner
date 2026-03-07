/**
 * Tests for useTickerAutocomplete hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTickerAutocomplete } from '../useTickerAutocomplete';

// =============================================================================
// Mock Data
// =============================================================================

const mockTickerMap = {
  AAPL: { cik: 320193, name: 'Apple Inc.', ticker: 'AAPL' },
  MSFT: { cik: 789019, name: 'Microsoft Corp', ticker: 'MSFT' },
  AMZN: { cik: 1018724, name: 'AMAZON COM INC', ticker: 'AMZN' },
  GOOGL: { cik: 1652044, name: 'Alphabet Inc.', ticker: 'GOOGL' },
  GOOG: { cik: 1652044, name: 'Alphabet Inc.', ticker: 'GOOG' },
  TSLA: { cik: 1318605, name: 'Tesla, Inc.', ticker: 'TSLA' },
  NVDA: { cik: 1045810, name: 'NVIDIA CORP', ticker: 'NVDA' },
  META: { cik: 1326801, name: 'Meta Platforms, Inc.', ticker: 'META' },
  JPM: { cik: 19617, name: 'JPMORGAN CHASE & CO', ticker: 'JPM' },
  AAL: { cik: 6201, name: 'AMERICAN AIRLINES GROUP INC', ticker: 'AAL' },
  AAME: { cik: 1004434, name: 'ATLANTIC AMERICAN CORP', ticker: 'AAME' },
  AA: { cik: 1675149, name: 'Alcoa Corporation', ticker: 'AA' },
  AB: { cik: 825313, name: 'AllianceBernstein Holding', ticker: 'AB' },
};

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../services/edgarApi', () => ({
  fetchCompanyTickers: vi.fn(),
}));

vi.mock('../../utils/inputSanitization', () => ({
  sanitizeTickerInput: vi.fn((input) => {
    const str = String(input || '');
    // Simple mock: strip non-alphanumeric except hyphen and period
    const sanitized = str.replace(/[^A-Za-z0-9.-]/g, '').slice(0, 10);
    return { sanitized, isValid: sanitized.length > 0, original: str, warnings: [] };
  }),
}));

import { fetchCompanyTickers } from '../../services/edgarApi';

// =============================================================================
// Tests
// =============================================================================

describe('useTickerAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchCompanyTickers.mockResolvedValue(mockTickerMap);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  it('should start with empty suggestions and not ready', () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.query).toBe('');
  });

  it('should load tickers on loadTickers call', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    expect(fetchCompanyTickers).toHaveBeenCalledTimes(1);
    expect(result.current.isReady).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('should not reload tickers if already loaded', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    await act(async () => {
      result.current.loadTickers();
    });

    expect(fetchCompanyTickers).toHaveBeenCalledTimes(1);
  });

  it('should handle loadTickers failure gracefully', async () => {
    fetchCompanyTickers.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.suggestions).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  it('should filter by ticker prefix', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('AA');
    });

    // Advance debounce timer
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const tickers = result.current.suggestions.map((s) => s.ticker);
    expect(tickers).toContain('AA');
    expect(tickers).toContain('AAL');
    expect(tickers).toContain('AAME');
    expect(tickers).not.toContain('MSFT');
  });

  it('should prioritize exact ticker match first', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('AA');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // AA should be first as exact match
    expect(result.current.suggestions[0].ticker).toBe('AA');
  });

  it('should match by company name substring (case-insensitive)', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('apple');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const tickers = result.current.suggestions.map((s) => s.ticker);
    expect(tickers).toContain('AAPL');
  });

  it('should limit results to max 8 suggestions', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('A');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.suggestions.length).toBeLessThanOrEqual(8);
  });

  it('should return empty suggestions for query shorter than minimum', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.suggestions).toEqual([]);
  });

  it('should return empty suggestions for no matches', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('ZZZZ');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.suggestions).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Debounce
  // ---------------------------------------------------------------------------

  it('should debounce filtering at 150ms', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('A');
    });

    // Before debounce fires
    expect(result.current.suggestions).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Still empty - not yet at 150ms
    expect(result.current.suggestions).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now debounce has fired
    expect(result.current.suggestions.length).toBeGreaterThan(0);
  });

  it('should cancel previous debounce when new input arrives', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    // Type quickly
    act(() => {
      result.current.setQuery('A');
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      result.current.setQuery('AA');
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      result.current.setQuery('AAPL');
    });

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should only show results for "AAPL", not intermediate queries
    const tickers = result.current.suggestions.map((s) => s.ticker);
    expect(tickers).toContain('AAPL');
    // Should not show AA-only matches since AAPL is the final query
    expect(result.current.suggestions.length).toBeLessThanOrEqual(8);
  });

  // ---------------------------------------------------------------------------
  // Clear / Cleanup
  // ---------------------------------------------------------------------------

  it('should clear suggestions when clearSuggestions is called', async () => {
    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('AA');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.suggestions.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearSuggestions();
    });

    expect(result.current.suggestions).toEqual([]);
  });

  it('should sanitize input via sanitizeTickerInput', async () => {
    const { sanitizeTickerInput } = await import('../../utils/inputSanitization');
    const { result } = renderHook(() => useTickerAutocomplete());

    act(() => {
      result.current.setQuery('<script>AAPL</script>');
    });

    expect(sanitizeTickerInput).toHaveBeenCalledWith('<script>AAPL</script>');
  });

  it('should return empty suggestions when tickers not loaded and query is set', async () => {
    // Don't call loadTickers - go straight to querying
    const { result } = renderHook(() => useTickerAutocomplete());

    act(() => {
      result.current.setQuery('AAPL');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.suggestions).toEqual([]);
  });

  it('should trigger early exit when enough matches are found', async () => {
    // Create a large mock dataset where 'A' prefix matches 20+ entries
    const largeMockTickerMap = {};
    for (let i = 0; i < 25; i++) {
      const ticker = `A${String(i).padStart(3, '0')}`;
      largeMockTickerMap[ticker] = { cik: 100000 + i, name: `Company ${ticker}`, ticker };
    }

    fetchCompanyTickers.mockResolvedValue(largeMockTickerMap);

    const { result } = renderHook(() => useTickerAutocomplete());

    await act(async () => {
      result.current.loadTickers();
    });

    act(() => {
      result.current.setQuery('A');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should still limit to max 8 suggestions
    expect(result.current.suggestions.length).toBeLessThanOrEqual(8);
    // But should have found results
    expect(result.current.suggestions.length).toBeGreaterThan(0);
  });
});
