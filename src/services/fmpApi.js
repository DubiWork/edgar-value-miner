/**
 * FMP (Financial Modeling Prep) API Service
 *
 * Provides stock quote data from FMP API with in-memory caching,
 * retry logic with exponential backoff, and graceful degradation
 * when the API key is missing.
 *
 * @module fmpApi
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * FMP API Configuration
 * @constant {Object}
 */
const FMP_CONFIG = {
  /** Base URL for FMP Quote API */
  BASE_URL: 'https://financialmodelingprep.com/api/v3/quote',
  /** Cache TTL in milliseconds (5 minutes) */
  CACHE_TTL_MS: 5 * 60 * 1000,
  /** Maximum retry attempts */
  MAX_RETRIES: 2,
  /** Base delay for exponential backoff (milliseconds) */
  BASE_RETRY_DELAY_MS: 1000,
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for FMP API errors
 * @extends Error
 */
export class FmpApiError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} [ticker] - Ticker symbol that caused the error
   */
  constructor(message, statusCode, ticker) {
    super(message);
    this.name = 'FmpApiError';
    this.statusCode = statusCode;
    this.ticker = ticker;
  }
}

// =============================================================================
// In-Memory Cache
// =============================================================================

/**
 * In-memory cache for stock quotes
 * Key: ticker (uppercase), Value: { data, timestamp }
 * @type {Map<string, { data: Object, timestamp: number }>}
 */
const cache = new Map();

/**
 * Checks if a cache entry is still valid
 * @param {string} ticker - Uppercase ticker symbol
 * @returns {Object|null} Cached data if valid, null otherwise
 */
function getCachedQuote(ticker) {
  const entry = cache.get(ticker);
  if (!entry) {
    return null;
  }
  const age = Date.now() - entry.timestamp;
  if (age > FMP_CONFIG.CACHE_TTL_MS) {
    cache.delete(ticker);
    return null;
  }
  return entry.data;
}

// =============================================================================
// API Key Warning
// =============================================================================

let apiKeyWarningLogged = false;

// =============================================================================
// Public API
// =============================================================================

/**
 * Fetches a stock quote from FMP API
 *
 * Returns a simplified quote object with only the fields needed by the app.
 * Uses in-memory cache with 5-minute TTL. Retries network/server errors
 * up to 2 times with exponential backoff (1s, 2s).
 *
 * @param {string} ticker - Stock ticker symbol (e.g., "AAPL")
 * @returns {Promise<{ price: number, eps: number, pe: number, marketCap: number, sharesOutstanding: number, changesPercentage: number, name: string }|null>}
 *   Simplified quote object, or null if unavailable
 * @throws {FmpApiError} On 401/403 (bad API key) or 429 (rate limited)
 *
 * @example
 * const quote = await getStockQuote('AAPL');
 * if (quote) {
 *   console.log(`${quote.name}: $${quote.price}`);
 * }
 */
export async function getStockQuote(ticker) {
  // Validate and normalize ticker
  const upperTicker = ticker.trim().toUpperCase();

  // Check for API key
  const apiKey = import.meta.env.VITE_FMP_API_KEY;
  if (!apiKey) {
    if (!apiKeyWarningLogged) {
      console.warn('[fmpApi] VITE_FMP_API_KEY is not set. Stock quotes will be unavailable.');
      apiKeyWarningLogged = true;
    }
    return null;
  }

  // Check cache
  const cached = getCachedQuote(upperTicker);
  if (cached) {
    return cached;
  }

  // Fetch from API with retries
  const url = `${FMP_CONFIG.BASE_URL}/${upperTicker}?apikey=${apiKey}`;

  for (let attempt = 0; attempt <= FMP_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        const status = response.status;

        // Auth errors: throw immediately, no retry
        if (status === 401 || status === 403) {
          throw new FmpApiError(
            `FMP API authentication failed (${status}). Check your API key.`,
            status,
            upperTicker
          );
        }

        // Rate limited: throw immediately, no retry
        if (status === 429) {
          throw new FmpApiError(
            'FMP API rate limit exceeded. Please try again later.',
            status,
            upperTicker
          );
        }

        // Other HTTP errors: retry with backoff
        if (attempt < FMP_CONFIG.MAX_RETRIES) {
          const delay = FMP_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return null;
      }

      // Parse response
      const data = await response.json();

      // Validate response shape
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const quote = data[0];

      // Map to simplified shape
      const result = {
        price: quote.price,
        eps: quote.eps,
        pe: quote.pe,
        marketCap: quote.marketCap,
        sharesOutstanding: quote.sharesOutstanding,
        changesPercentage: quote.changesPercentage,
        name: quote.name,
      };

      // Cache successful response
      cache.set(upperTicker, {
        data: result,
        timestamp: Date.now(),
      });

      return result;

    } catch (error) {
      // Re-throw FmpApiError (auth/rate limit errors)
      if (error instanceof FmpApiError) {
        throw error;
      }

      // Network errors: retry with backoff
      if (attempt < FMP_CONFIG.MAX_RETRIES) {
        const delay = FMP_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // All retries exhausted
  return null;
}

/**
 * Clears the in-memory quote cache
 *
 * Useful for testing or when you want to force fresh data.
 */
export function clearCache() {
  cache.clear();
  apiKeyWarningLogged = false;
}
