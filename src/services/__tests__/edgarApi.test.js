/**
 * Tests for SEC EDGAR API Service
 *
 * Tests cover:
 * - CIK padding and validation
 * - Ticker validation and normalization
 * - Company tickers fetching and caching
 * - Ticker-to-CIK mapping
 * - Company facts fetching
 * - Rate limiting (token bucket algorithm)
 * - Error handling and retries
 * - HTTP error classification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  padCik,
  fetchCompanyTickers,
  mapTickerToCik,
  fetchCompanyFacts,
  fetchCompanyFactsByTicker,
  getRateLimiterStatus,
  clearTickersCache,
  EdgarApiError,
  EDGAR_ERROR_CODES,
} from '../edgarApi.js';

// =============================================================================
// Mock Data
// =============================================================================

const mockCompanyTickersResponse = {
  '0': {
    cik_str: '320193',
    ticker: 'AAPL',
    title: 'Apple Inc.',
  },
  '1': {
    cik_str: '789019',
    ticker: 'MSFT',
    title: 'Microsoft Corp',
  },
  '2': {
    cik_str: '1018724',
    ticker: 'AMZN',
    title: 'AMAZON COM INC',
  },
};

const mockCompanyFactsResponse = {
  cik: '0000320193',
  entityName: 'Apple Inc.',
  facts: {
    'us-gaap': {
      Revenues: {
        label: 'Revenues',
        description: 'Revenue from operations',
        units: {
          USD: [
            {
              end: '2023-09-30',
              val: 383285000000,
              accn: '0000320193-23-000106',
              fy: 2023,
              fp: 'FY',
              form: '10-K',
            },
          ],
        },
      },
      Assets: {
        label: 'Assets',
        description: 'Total assets',
        units: {
          USD: [
            {
              end: '2023-09-30',
              val: 352755000000,
              accn: '0000320193-23-000106',
              fy: 2023,
              fp: 'FY',
              form: '10-K',
            },
          ],
        },
      },
    },
  },
};

// =============================================================================
// Test Suite Setup
// =============================================================================

describe('edgarApi', () => {
  let originalFetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Clear tickers cache before each test
    clearTickersCache();

    // Reset fetch mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  // =============================================================================
  // CIK Utilities Tests
  // =============================================================================

  describe('padCik', () => {
    it('should pad CIK with leading zeros to 10 digits', () => {
      expect(padCik(320193)).toBe('0000320193');
      expect(padCik('320193')).toBe('0000320193');
      expect(padCik('1')).toBe('0000000001');
      expect(padCik('12345')).toBe('0000012345');
    });

    it('should handle already-padded CIKs', () => {
      expect(padCik('0000320193')).toBe('0000320193');
    });

    it('should throw error for empty CIK', () => {
      expect(() => padCik('')).toThrow(EdgarApiError);
      expect(() => padCik(null)).toThrow(EdgarApiError);
      expect(() => padCik(undefined)).toThrow(EdgarApiError);
    });

    it('should throw error for non-numeric CIK', () => {
      expect(() => padCik('ABC123')).toThrow(EdgarApiError);
      expect(() => padCik('123ABC')).toThrow(EdgarApiError);
    });

    it('should throw error for CIK exceeding 10 digits', () => {
      expect(() => padCik('12345678901')).toThrow(EdgarApiError);
    });

    it('should trim whitespace from CIK', () => {
      expect(padCik('  320193  ')).toBe('0000320193');
    });
  });

  // =============================================================================
  // Company Tickers Tests
  // =============================================================================

  describe('fetchCompanyTickers', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyTickersResponse),
        });
      });
    });

    it('should fetch and transform company tickers', async () => {
      const tickers = await fetchCompanyTickers();

      expect(tickers).toBeDefined();
      expect(tickers['AAPL']).toEqual({
        cik: 320193,
        name: 'Apple Inc.',
        ticker: 'AAPL',
      });
      expect(tickers['MSFT']).toEqual({
        cik: 789019,
        name: 'Microsoft Corp',
        ticker: 'MSFT',
      });
      expect(tickers['AMZN']).toEqual({
        cik: 1018724,
        name: 'AMAZON COM INC',
        ticker: 'AMZN',
      });
    });

    it('should cache tickers and return from cache on second call', async () => {
      // First call
      await fetchCompanyTickers();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await fetchCompanyTickers();
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should force refresh when forceRefresh=true', async () => {
      // First call
      await fetchCompanyTickers();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Force refresh
      await fetchCompanyTickers(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should include User-Agent header', async () => {
      await fetchCompanyTickers();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
          }),
        })
      );
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      await expect(fetchCompanyTickers()).rejects.toThrow(EdgarApiError);
    });

    it('should handle HTTP errors', async () => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        });
      });

      await expect(fetchCompanyTickers()).rejects.toThrow(EdgarApiError);
    });

    it('should retry on 429 rate limit error', async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyTickersResponse),
        });
      });

      const tickers = await fetchCompanyTickers();
      expect(tickers).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should retry on 500 server error', async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyTickersResponse),
        });
      });

      const tickers = await fetchCompanyTickers();
      expect(tickers).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================================
  // Ticker-to-CIK Mapping Tests
  // =============================================================================

  describe('mapTickerToCik', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyTickersResponse),
        });
      });
    });

    it('should map ticker to CIK and company name', async () => {
      const result = await mapTickerToCik('AAPL');

      expect(result).toEqual({
        cik: '0000320193',
        name: 'Apple Inc.',
      });
    });

    it('should normalize ticker to uppercase', async () => {
      const result = await mapTickerToCik('aapl');
      expect(result.cik).toBe('0000320193');
    });

    it('should throw error for invalid ticker format', async () => {
      await expect(mapTickerToCik('')).rejects.toThrow(EdgarApiError);
      await expect(mapTickerToCik('123')).rejects.toThrow(EdgarApiError);
      await expect(mapTickerToCik('TOOLONG')).rejects.toThrow(EdgarApiError);
    });

    it('should throw error for ticker not found', async () => {
      await expect(mapTickerToCik('NOTEXIST')).rejects.toThrow(EdgarApiError);
    });
  });

  // =============================================================================
  // Company Facts Tests
  // =============================================================================

  describe('fetchCompanyFacts', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyFactsResponse),
        });
      });
    });

    it('should fetch company facts by CIK', async () => {
      const facts = await fetchCompanyFacts(320193);

      expect(facts).toBeDefined();
      expect(facts.entityName).toBe('Apple Inc.');
      expect(facts.facts['us-gaap']).toBeDefined();
      expect(facts.facts['us-gaap'].Revenues).toBeDefined();
    });

    it('should pad CIK before fetching', async () => {
      await fetchCompanyFacts(320193);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('CIK0000320193'),
        expect.any(Object)
      );
    });

    it('should throw error for 404 not found', async () => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      });

      await expect(fetchCompanyFacts(320193)).rejects.toThrow(EdgarApiError);
    });

    it('should enhance 404 error message with CIK context', async () => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      });

      try {
        await fetchCompanyFacts(320193);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('0000320193');
        expect(error.code).toBe(EDGAR_ERROR_CODES.INVALID_CIK);
      }
    });
  });

  describe('fetchCompanyFactsByTicker', () => {
    beforeEach(() => {
      global.fetch = vi.fn((url) => {
        if (url.includes('company_tickers.json')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockCompanyTickersResponse),
          });
        }
        if (url.includes('companyfacts')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockCompanyFactsResponse),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it('should fetch company facts by ticker', async () => {
      const result = await fetchCompanyFactsByTicker('AAPL');

      expect(result.facts).toBeDefined();
      expect(result.facts.entityName).toBe('Apple Inc.');
      expect(result.companyInfo).toEqual({
        cik: '0000320193',
        name: 'Apple Inc.',
      });
    });

    it('should make two API calls (tickers + facts)', async () => {
      await fetchCompanyFactsByTicker('AAPL');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use tickers cache on second call', async () => {
      await fetchCompanyFactsByTicker('AAPL');
      await fetchCompanyFactsByTicker('MSFT');

      // Only 3 calls: 1 for tickers (cached), 2 for facts
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  // =============================================================================
  // Rate Limiter Tests
  // =============================================================================

  describe('Rate Limiting', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyFactsResponse),
        });
      });
    });

    it('should respect 10 req/sec rate limit', async () => {
      const start = Date.now();

      // Fire 15 requests rapidly
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(fetchCompanyFacts(`00003201${i.toString().padStart(2, '0')}`));
      }

      await Promise.all(promises);
      const elapsed = Date.now() - start;

      // Should take at least 1.4 seconds (15 requests / 10 per second)
      // Allow some margin for timing variations
      expect(elapsed).toBeGreaterThanOrEqual(1300);
    }, 10000); // Increase timeout for this test

    it('should provide rate limiter status', () => {
      const status = getRateLimiterStatus();

      expect(status).toBeDefined();
      expect(status.tokens).toBeGreaterThanOrEqual(0);
      expect(status.capacity).toBe(10);
      expect(status.queueLength).toBeGreaterThanOrEqual(0);
    });

    it('should refill tokens over time', async () => {
      // Consume all tokens
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(fetchCompanyFacts(`00003201${i.toString().padStart(2, '0')}`));
      }
      await Promise.all(promises);

      const statusBefore = getRateLimiterStatus();
      expect(statusBefore.tokens).toBeLessThan(10);

      // Wait for refill (200ms should add 2 tokens)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const statusAfter = getRateLimiterStatus();
      expect(statusAfter.tokens).toBeGreaterThan(statusBefore.tokens);
    }, 5000);
  });

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('Error Handling', () => {
    it('should classify 404 as INVALID_TICKER', async () => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      });

      try {
        await fetchCompanyFacts(320193);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(EdgarApiError);
        expect(error.code).toBe(EDGAR_ERROR_CODES.INVALID_CIK);
        expect(error.statusCode).toBe(404);
      }
    });

    it('should classify 429 as RATE_LIMITED', async () => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 429,
        });
      });

      // Disable retries by exhausting them
      vi.spyOn(global, 'setTimeout').mockImplementation((cb) => cb());

      try {
        await fetchCompanyTickers();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(EdgarApiError);
        expect(error.code).toBe(EDGAR_ERROR_CODES.RATE_LIMITED);
      }

      vi.restoreAllMocks();
    });

    it('should classify 500 as SERVER_ERROR', async () => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      });

      vi.spyOn(global, 'setTimeout').mockImplementation((cb) => cb());

      try {
        await fetchCompanyTickers();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(EdgarApiError);
        expect(error.code).toBe(EDGAR_ERROR_CODES.SERVER_ERROR);
      }

      vi.restoreAllMocks();
    });

    it('should classify network errors as NETWORK_ERROR', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network failure')));

      try {
        await fetchCompanyTickers();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(EdgarApiError);
        expect(error.code).toBe(EDGAR_ERROR_CODES.NETWORK_ERROR);
        expect(error.cause).toBeDefined();
      }
    });

    it('should retry network errors up to 3 times', async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount < 4) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyTickersResponse),
        });
      });

      const tickers = await fetchCompanyTickers();
      expect(tickers).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    }, 10000);
  });

  // =============================================================================
  // Cache Management Tests
  // =============================================================================

  describe('Cache Management', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockCompanyTickersResponse),
        });
      });
    });

    it('should clear tickers cache', async () => {
      // Populate cache
      await fetchCompanyTickers();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearTickersCache();

      // Next call should fetch again
      await fetchCompanyTickers();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================================
  // Error Class Tests
  // =============================================================================

  describe('EdgarApiError', () => {
    it('should create error with all properties', () => {
      const cause = new Error('Original error');
      const error = new EdgarApiError('Test error', 'TEST_CODE', 404, cause);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('EdgarApiError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.cause).toBe(cause);
    });

    it('should create error without optional parameters', () => {
      const error = new EdgarApiError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBeNull();
      expect(error.cause).toBeNull();
    });
  });
});
