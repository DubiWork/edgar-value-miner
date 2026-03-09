/**
 * Tests for FMP (Financial Modeling Prep) API Service
 *
 * Tests cover:
 * - Successful stock quote fetch (correct response shape)
 * - Cache hit (second call doesn't fetch)
 * - Cache miss after TTL (fetches again)
 * - Missing API key returns null (no throw)
 * - Network error with retry (2 retries, exponential backoff)
 * - 401/403 throws FmpApiError
 * - 429 rate limit throws FmpApiError
 * - Other HTTP error returns null after retry
 * - clearCache function works
 * - Ticker is uppercased
 * - Response data mapping (only needed fields)
 * - Empty/invalid response handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getStockQuote, clearCache, FmpApiError } from '../fmpApi.js';

// =============================================================================
// Mock Data
// =============================================================================

const mockFmpQuoteResponse = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 178.72,
    changesPercentage: 1.23,
    change: 2.17,
    dayLow: 176.55,
    dayHigh: 179.63,
    yearHigh: 199.62,
    yearLow: 124.17,
    marketCap: 2800000000000,
    priceAvg50: 175.34,
    priceAvg200: 168.92,
    exchange: 'NASDAQ',
    volume: 54321000,
    avgVolume: 58000000,
    open: 176.89,
    previousClose: 176.55,
    eps: 6.13,
    pe: 29.15,
    earningsAnnouncement: '2024-01-25T00:00:00.000+0000',
    sharesOutstanding: 15680000000,
    timestamp: 1700000000,
  },
];

// =============================================================================
// Test Suite Setup
// =============================================================================

describe('fmpApi', () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    // Save original env and set a test API key
    originalEnv = import.meta.env.VITE_FMP_API_KEY;
    import.meta.env.VITE_FMP_API_KEY = 'test-api-key';

    clearCache();
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    import.meta.env.VITE_FMP_API_KEY = originalEnv;
    vi.useRealTimers();
  });

  // =============================================================================
  // Successful Fetch Tests
  // =============================================================================

  describe('getStockQuote - successful fetch', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockFmpQuoteResponse),
        })
      );
    });

    it('should fetch stock quote and return correct shape', async () => {
      const result = await getStockQuote('AAPL');

      expect(result).toEqual({
        price: 178.72,
        eps: 6.13,
        pe: 29.15,
        marketCap: 2800000000000,
        sharesOutstanding: 15680000000,
        changesPercentage: 1.23,
        name: 'Apple Inc.',
      });
    });

    it('should only return mapped fields, not full FMP response', async () => {
      const result = await getStockQuote('AAPL');

      // Should NOT include raw FMP fields
      expect(result).not.toHaveProperty('symbol');
      expect(result).not.toHaveProperty('dayLow');
      expect(result).not.toHaveProperty('dayHigh');
      expect(result).not.toHaveProperty('yearHigh');
      expect(result).not.toHaveProperty('yearLow');
      expect(result).not.toHaveProperty('volume');
      expect(result).not.toHaveProperty('exchange');
      expect(result).not.toHaveProperty('timestamp');
      expect(result).not.toHaveProperty('open');
      expect(result).not.toHaveProperty('previousClose');
    });

    it('should uppercase the ticker before fetching', async () => {
      await getStockQuote('aapl');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/quote/AAPL')
      );
    });

    it('should call the correct FMP API endpoint', async () => {
      await getStockQuote('AAPL');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://financialmodelingprep.com/api/v3/quote/AAPL')
      );
    });

    it('should include the API key in the URL', async () => {
      await getStockQuote('AAPL');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('apikey=test-api-key')
      );
    });
  });

  // =============================================================================
  // Cache Tests
  // =============================================================================

  describe('getStockQuote - caching', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockFmpQuoteResponse),
        })
      );
    });

    it('should return cached result on second call (cache hit)', async () => {
      await getStockQuote('AAPL');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await getStockQuote('AAPL');
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1 - used cache
    });

    it('should fetch again after cache TTL expires (cache miss)', async () => {
      await getStockQuote('AAPL');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Advance past the 5-minute TTL
      vi.advanceTimersByTime(300001);

      await getStockQuote('AAPL');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should cache by uppercase ticker', async () => {
      await getStockQuote('aapl');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await getStockQuote('AAPL');
      expect(global.fetch).toHaveBeenCalledTimes(1); // Same cache entry
    });

    it('should clear cache when clearCache is called', async () => {
      await getStockQuote('AAPL');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      clearCache();

      await getStockQuote('AAPL');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================================
  // Missing API Key Tests
  // =============================================================================

  describe('getStockQuote - missing API key', () => {
    it('should return null when API key is missing', async () => {
      delete import.meta.env.VITE_FMP_API_KEY;

      const result = await getStockQuote('AAPL');

      expect(result).toBeNull();
    });

    it('should return null when API key is empty string', async () => {
      import.meta.env.VITE_FMP_API_KEY = '';

      const result = await getStockQuote('AAPL');

      expect(result).toBeNull();
    });

    it('should not call fetch when API key is missing', async () => {
      global.fetch = vi.fn();
      delete import.meta.env.VITE_FMP_API_KEY;

      await getStockQuote('AAPL');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Network Error + Retry Tests
  // =============================================================================

  describe('getStockQuote - network errors and retries', () => {
    it('should retry on network error up to 2 times then return null', async () => {
      global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

      const resultPromise = getStockQuote('AAPL');

      // Advance through retry delays (1s, 2s)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should succeed on retry after initial network failure', async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockFmpQuoteResponse),
        });
      });

      const resultPromise = getStockQuote('AAPL');

      // Advance past first retry delay (1s)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).not.toBeNull();
      expect(result.price).toBe(178.72);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff for retries (1s, 2s)', async () => {
      const timeouts = [];
      const originalSetTimeout = globalThis.setTimeout;
      vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, delay) => {
        if (delay && delay >= 1000) {
          timeouts.push(delay);
        }
        return originalSetTimeout(fn, delay);
      });

      global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

      const resultPromise = getStockQuote('AAPL');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      await resultPromise;

      expect(timeouts).toContain(1000); // First retry: 1s
      expect(timeouts).toContain(2000); // Second retry: 2s

      vi.restoreAllMocks();
    });
  });

  // =============================================================================
  // HTTP Error Tests
  // =============================================================================

  describe('getStockQuote - HTTP errors', () => {
    it('should throw FmpApiError on 401 (bad API key)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      await expect(getStockQuote('AAPL')).rejects.toThrow(FmpApiError);

      try {
        await getStockQuote('AAPL');
      } catch (error) {
        expect(error).toBeInstanceOf(FmpApiError);
        expect(error.statusCode).toBe(401);
        expect(error.ticker).toBe('AAPL');
      }
    });

    it('should throw FmpApiError on 403 (forbidden)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        })
      );

      await expect(getStockQuote('AAPL')).rejects.toThrow(FmpApiError);

      try {
        await getStockQuote('AAPL');
      } catch (error) {
        expect(error).toBeInstanceOf(FmpApiError);
        expect(error.statusCode).toBe(403);
      }
    });

    it('should throw FmpApiError on 429 (rate limited)', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        })
      );

      await expect(getStockQuote('AAPL')).rejects.toThrow(FmpApiError);

      try {
        await getStockQuote('AAPL');
      } catch (error) {
        expect(error).toBeInstanceOf(FmpApiError);
        expect(error.statusCode).toBe(429);
      }
    });

    it('should return null for other HTTP errors (e.g., 500) after retries', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const resultPromise = getStockQuote('AAPL');

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  // =============================================================================
  // Empty/Invalid Response Tests
  // =============================================================================

  describe('getStockQuote - empty/invalid responses', () => {
    it('should return null for empty array response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        })
      );

      const result = await getStockQuote('AAPL');

      expect(result).toBeNull();
    });

    it('should return null for null response body', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(null),
        })
      );

      const result = await getStockQuote('AAPL');

      expect(result).toBeNull();
    });

    it('should return null for non-array response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ error: 'something' }),
        })
      );

      const result = await getStockQuote('AAPL');

      expect(result).toBeNull();
    });

    it('should not cache error responses', async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([]),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockFmpQuoteResponse),
        });
      });

      const result1 = await getStockQuote('AAPL');
      expect(result1).toBeNull();

      const result2 = await getStockQuote('AAPL');
      expect(result2).not.toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================================
  // FmpApiError Class Tests
  // =============================================================================

  describe('FmpApiError', () => {
    it('should create error with all properties', () => {
      const error = new FmpApiError('Test error', 401, 'AAPL');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FmpApiError);
      expect(error.name).toBe('FmpApiError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(401);
      expect(error.ticker).toBe('AAPL');
    });

    it('should create error without optional ticker', () => {
      const error = new FmpApiError('Test error', 429);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(429);
      expect(error.ticker).toBeUndefined();
    });
  });
});
