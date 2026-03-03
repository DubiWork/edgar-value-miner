/**
 * SEC EDGAR API Service
 *
 * Provides access to SEC EDGAR Company Facts and Company Tickers APIs
 * with built-in rate limiting to comply with SEC's 10 requests/second limit.
 *
 * @module edgarApi
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * SEC API Configuration
 * @constant {Object}
 */
const SEC_CONFIG = {
  /** Base URL for Company Facts API */
  COMPANY_FACTS_BASE_URL: 'https://data.sec.gov/api/xbrl/companyfacts',
  /** URL for Company Tickers list */
  COMPANY_TICKERS_URL: 'https://www.sec.gov/files/company_tickers.json',
  /** User-Agent header required by SEC (from environment variable) */
  USER_AGENT: import.meta.env.VITE_SEC_USER_AGENT || 'getedgar (admincontact@getedgar.com)',
  /** Maximum CIK length with leading zeros */
  CIK_LENGTH: 10,
  /** Cache duration for company tickers (24 hours in milliseconds) */
  TICKERS_CACHE_DURATION: 24 * 60 * 60 * 1000,
};

/**
 * Rate Limiter Configuration
 * SEC allows max 10 requests per second
 * @constant {Object}
 */
const RATE_LIMIT_CONFIG = {
  /** Maximum requests per second */
  MAX_REQUESTS_PER_SECOND: 10,
  /** Token bucket capacity (same as max requests) */
  BUCKET_CAPACITY: 10,
  /** Refill rate (tokens per millisecond) */
  REFILL_RATE: 10 / 1000, // 10 tokens per 1000ms
  /** Safety margin delay between requests (milliseconds) */
  SAFETY_DELAY_MS: 100,
  /** Maximum retry attempts */
  MAX_RETRIES: 3,
  /** Base delay for exponential backoff (milliseconds) */
  BASE_RETRY_DELAY_MS: 1000,
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for SEC EDGAR API errors
 * @extends Error
 */
export class EdgarApiError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code (e.g., 'INVALID_TICKER', 'RATE_LIMITED')
   * @param {number} [statusCode] - HTTP status code if applicable
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, code, statusCode = null, cause = null) {
    super(message);
    this.name = 'EdgarApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * Error codes for SEC EDGAR API
 * @constant {Object<string, string>}
 */
export const EDGAR_ERROR_CODES = {
  INVALID_TICKER: 'INVALID_TICKER',
  INVALID_CIK: 'INVALID_CIK',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  TICKER_NOT_FOUND: 'TICKER_NOT_FOUND',
};

// =============================================================================
// Token Bucket Rate Limiter
// =============================================================================

/**
 * Token Bucket Rate Limiter Implementation
 *
 * Implements the token bucket algorithm to limit API requests to SEC's
 * maximum of 10 requests per second. Tokens are refilled continuously
 * and requests are queued when the bucket is empty.
 *
 * @class
 */
class TokenBucketRateLimiter {
  /**
   * Creates a new TokenBucketRateLimiter
   * @param {number} capacity - Maximum tokens in the bucket
   * @param {number} refillRate - Tokens added per millisecond
   */
  constructor(capacity = RATE_LIMIT_CONFIG.BUCKET_CAPACITY, refillRate = RATE_LIMIT_CONFIG.REFILL_RATE) {
    /** @type {number} */
    this.capacity = capacity;
    /** @type {number} */
    this.tokens = capacity;
    /** @type {number} */
    this.refillRate = refillRate;
    /** @type {number} */
    this.lastRefillTime = Date.now();
    /** @type {Array<{resolve: Function, reject: Function}>} */
    this.queue = [];
    /** @type {boolean} */
    this.processing = false;
  }

  /**
   * Refills tokens based on elapsed time
   * @private
   */
  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Attempts to consume a token from the bucket
   * @private
   * @returns {boolean} True if a token was consumed, false otherwise
   */
  _tryConsume() {
    this._refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Calculates wait time until a token is available
   * @private
   * @returns {number} Milliseconds to wait
   */
  _getWaitTime() {
    this._refill();
    if (this.tokens >= 1) {
      return 0;
    }
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  /**
   * Processes the request queue
   * @private
   */
  async _processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const waitTime = this._getWaitTime();

      if (waitTime > 0) {
        await this._delay(waitTime);
      }

      if (this._tryConsume()) {
        const { resolve } = this.queue.shift();
        // Add safety delay between requests
        await this._delay(RATE_LIMIT_CONFIG.SAFETY_DELAY_MS);
        resolve();
      }
    }

    this.processing = false;
  }

  /**
   * Promise-based delay
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Acquires a token, waiting if necessary
   * Call this before making an API request
   *
   * @returns {Promise<void>} Resolves when a token is acquired
   * @example
   * await rateLimiter.acquire();
   * const response = await fetch(url);
   */
  async acquire() {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this._processQueue();
    });
  }

  /**
   * Gets current status of the rate limiter
   * @returns {{tokens: number, queueLength: number, capacity: number}}
   */
  getStatus() {
    this._refill();
    return {
      tokens: Math.floor(this.tokens),
      queueLength: this.queue.length,
      capacity: this.capacity,
    };
  }
}

// Global rate limiter instance
const rateLimiter = new TokenBucketRateLimiter();

// =============================================================================
// CIK Utilities
// =============================================================================

/**
 * Pads a CIK number with leading zeros to 10 digits
 *
 * SEC EDGAR requires CIK numbers to be padded with leading zeros
 * to exactly 10 digits for API calls.
 *
 * @param {string|number} cik - The CIK number to pad
 * @returns {string} The CIK padded to 10 digits
 * @throws {EdgarApiError} If CIK is invalid (not a number or too long)
 *
 * @example
 * padCik(320193) // Returns "0000320193" (Apple Inc.)
 * padCik("320193") // Returns "0000320193"
 */
export function padCik(cik) {
  if (cik === null || cik === undefined || cik === '') {
    throw new EdgarApiError(
      'CIK cannot be empty',
      EDGAR_ERROR_CODES.INVALID_CIK
    );
  }

  // Convert to string and remove any leading/trailing whitespace
  const cikStr = String(cik).trim();

  // Validate that CIK contains only digits
  if (!/^\d+$/.test(cikStr)) {
    throw new EdgarApiError(
      `Invalid CIK "${cik}": CIK must contain only digits`,
      EDGAR_ERROR_CODES.INVALID_CIK
    );
  }

  // Validate that CIK is not too long
  if (cikStr.length > SEC_CONFIG.CIK_LENGTH) {
    throw new EdgarApiError(
      `Invalid CIK "${cik}": CIK cannot exceed ${SEC_CONFIG.CIK_LENGTH} digits`,
      EDGAR_ERROR_CODES.INVALID_CIK
    );
  }

  // Pad with leading zeros
  return cikStr.padStart(SEC_CONFIG.CIK_LENGTH, '0');
}

/**
 * Validates a ticker symbol format
 *
 * @param {string} ticker - The ticker symbol to validate
 * @returns {string} The validated ticker in uppercase
 * @throws {EdgarApiError} If ticker is invalid
 */
function validateTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    throw new EdgarApiError(
      'Ticker symbol is required',
      EDGAR_ERROR_CODES.INVALID_TICKER
    );
  }

  const cleanTicker = ticker.trim().toUpperCase();

  // Ticker should be 1-5 alphanumeric characters
  if (!/^[A-Z]{1,5}$/.test(cleanTicker)) {
    throw new EdgarApiError(
      `Invalid ticker "${ticker}": Ticker must be 1-5 letters`,
      EDGAR_ERROR_CODES.INVALID_TICKER
    );
  }

  return cleanTicker;
}

// =============================================================================
// Company Tickers Cache
// =============================================================================

/**
 * In-memory cache for company tickers
 * @type {{data: Object|null, timestamp: number}}
 */
let tickersCache = {
  data: null,
  timestamp: 0,
};

/**
 * Checks if the tickers cache is still valid
 * @returns {boolean}
 */
function isTickersCacheValid() {
  if (!tickersCache.data) {
    return false;
  }
  const age = Date.now() - tickersCache.timestamp;
  return age < SEC_CONFIG.TICKERS_CACHE_DURATION;
}

// =============================================================================
// HTTP Utilities
// =============================================================================

/**
 * Creates standard headers for SEC API requests
 * @returns {Headers}
 */
function createSecHeaders() {
  return new Headers({
    'User-Agent': SEC_CONFIG.USER_AGENT,
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  });
}

/**
 * Handles HTTP errors from SEC API
 * @param {Response} response - Fetch response object
 * @param {string} context - Context for error message (e.g., "fetching company facts")
 * @throws {EdgarApiError}
 */
function handleHttpError(response, context) {
  switch (response.status) {
    case 404:
      throw new EdgarApiError(
        `Resource not found: ${context}`,
        EDGAR_ERROR_CODES.INVALID_TICKER,
        404
      );
    case 429:
      throw new EdgarApiError(
        'SEC rate limit exceeded. Please wait before making more requests.',
        EDGAR_ERROR_CODES.RATE_LIMITED,
        429
      );
    case 500:
    case 502:
    case 503:
    case 504:
      throw new EdgarApiError(
        `SEC server error (${response.status}): ${context}`,
        EDGAR_ERROR_CODES.SERVER_ERROR,
        response.status
      );
    default:
      throw new EdgarApiError(
        `HTTP error ${response.status}: ${context}`,
        EDGAR_ERROR_CODES.SERVER_ERROR,
        response.status
      );
  }
}

/**
 * Executes a fetch request with rate limiting and retry logic
 *
 * @param {string} url - URL to fetch
 * @param {string} context - Context for error messages
 * @param {number} [retries=RATE_LIMIT_CONFIG.MAX_RETRIES] - Number of retries remaining
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {EdgarApiError}
 */
async function fetchWithRateLimitAndRetry(url, context, retries = RATE_LIMIT_CONFIG.MAX_RETRIES) {
  // Acquire a token from the rate limiter
  await rateLimiter.acquire();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: createSecHeaders(),
    });

    if (!response.ok) {
      // Check if this is a retryable error
      if ((response.status === 429 || response.status >= 500) && retries > 0) {
        const delay = RATE_LIMIT_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, RATE_LIMIT_CONFIG.MAX_RETRIES - retries);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRateLimitAndRetry(url, context, retries - 1);
      }
      handleHttpError(response, context);
    }

    // Parse JSON response
    // Note: Modern browsers handle gzip decompression automatically
    const data = await response.json();
    return data;

  } catch (error) {
    // Handle network errors
    if (error instanceof EdgarApiError) {
      throw error;
    }

    // Check if it's a retryable network error
    if (retries > 0 && (error.name === 'TypeError' || error.message.includes('network'))) {
      const delay = RATE_LIMIT_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, RATE_LIMIT_CONFIG.MAX_RETRIES - retries);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRateLimitAndRetry(url, context, retries - 1);
    }

    throw new EdgarApiError(
      `Network error while ${context}: ${error.message}`,
      EDGAR_ERROR_CODES.NETWORK_ERROR,
      null,
      error
    );
  }
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Fetches company tickers list from SEC
 *
 * Returns a mapping of ticker symbols to company information including CIK.
 * Results are cached for 24 hours to reduce API calls.
 *
 * @param {boolean} [forceRefresh=false] - Force refresh from SEC, ignoring cache
 * @returns {Promise<Object<string, {cik: number, name: string, ticker: string}>>} Map of ticker to company info
 * @throws {EdgarApiError}
 *
 * @example
 * const tickers = await fetchCompanyTickers();
 * console.log(tickers['AAPL']); // { cik: 320193, name: "Apple Inc.", ticker: "AAPL" }
 */
export async function fetchCompanyTickers(forceRefresh = false) {
  // Return cached data if valid and not forcing refresh
  if (!forceRefresh && isTickersCacheValid()) {
    return tickersCache.data;
  }

  const rawData = await fetchWithRateLimitAndRetry(
    SEC_CONFIG.COMPANY_TICKERS_URL,
    'fetching company tickers'
  );

  // Transform the raw data into a ticker-keyed map
  // SEC returns: { "0": { cik_str: "...", ticker: "...", title: "..." }, ... }
  const tickerMap = {};

  for (const key in rawData) {
    const company = rawData[key];
    if (company && company.ticker) {
      const ticker = company.ticker.toUpperCase();
      tickerMap[ticker] = {
        cik: company.cik_str ? parseInt(company.cik_str, 10) : company.cik,
        name: company.title || '',
        ticker: ticker,
      };
    }
  }

  // Update cache
  tickersCache = {
    data: tickerMap,
    timestamp: Date.now(),
  };

  return tickerMap;
}

/**
 * Maps a ticker symbol to its CIK number
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<{cik: string, name: string}>} Object containing padded CIK and company name
 * @throws {EdgarApiError} If ticker is invalid or not found
 *
 * @example
 * const { cik, name } = await mapTickerToCik('AAPL');
 * console.log(cik);  // "0000320193"
 * console.log(name); // "Apple Inc."
 */
export async function mapTickerToCik(ticker) {
  const validatedTicker = validateTicker(ticker);
  const tickerMap = await fetchCompanyTickers();

  const companyInfo = tickerMap[validatedTicker];

  if (!companyInfo) {
    throw new EdgarApiError(
      `Ticker "${validatedTicker}" not found in SEC database. Please verify the ticker symbol is correct.`,
      EDGAR_ERROR_CODES.TICKER_NOT_FOUND
    );
  }

  return {
    cik: padCik(companyInfo.cik),
    name: companyInfo.name,
  };
}

/**
 * Fetches company facts from SEC EDGAR API
 *
 * Company facts include all XBRL-tagged financial data reported by the company
 * in their SEC filings (10-K, 10-Q, etc.).
 *
 * @param {string|number} cik - The CIK number (will be padded automatically)
 * @returns {Promise<Object>} Company facts JSON data
 * @throws {EdgarApiError} If CIK is invalid or company not found
 *
 * @example
 * // Using CIK directly
 * const facts = await fetchCompanyFacts(320193);
 *
 * // Using padded CIK
 * const facts = await fetchCompanyFacts("0000320193");
 *
 * // Access revenue data
 * const revenues = facts.facts['us-gaap'].Revenues;
 */
export async function fetchCompanyFacts(cik) {
  const paddedCik = padCik(cik);
  const url = `${SEC_CONFIG.COMPANY_FACTS_BASE_URL}/CIK${paddedCik}.json`;

  try {
    const data = await fetchWithRateLimitAndRetry(
      url,
      `fetching company facts for CIK ${paddedCik}`
    );
    return data;
  } catch (error) {
    // Enhance error message for 404 errors
    if (error.code === EDGAR_ERROR_CODES.INVALID_TICKER && error.statusCode === 404) {
      throw new EdgarApiError(
        `Company with CIK ${paddedCik} not found. The CIK may be invalid or the company may not have filed XBRL data.`,
        EDGAR_ERROR_CODES.INVALID_CIK,
        404,
        error
      );
    }
    throw error;
  }
}

/**
 * Fetches company facts by ticker symbol
 *
 * Convenience function that combines ticker-to-CIK lookup with company facts fetch.
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<{facts: Object, companyInfo: {cik: string, name: string}}>} Company facts and info
 * @throws {EdgarApiError} If ticker is invalid or not found
 *
 * @example
 * const { facts, companyInfo } = await fetchCompanyFactsByTicker('AAPL');
 * console.log(companyInfo.name); // "Apple Inc."
 * console.log(facts.facts['us-gaap'].Assets); // Asset data
 */
export async function fetchCompanyFactsByTicker(ticker) {
  const companyInfo = await mapTickerToCik(ticker);
  const facts = await fetchCompanyFacts(companyInfo.cik);

  return {
    facts,
    companyInfo,
  };
}

/**
 * Gets the current status of the rate limiter
 *
 * Useful for debugging or displaying rate limit status to users.
 *
 * @returns {{tokens: number, queueLength: number, capacity: number}}
 *
 * @example
 * const status = getRateLimiterStatus();
 * console.log(`Available requests: ${status.tokens}/${status.capacity}`);
 * console.log(`Queued requests: ${status.queueLength}`);
 */
export function getRateLimiterStatus() {
  return rateLimiter.getStatus();
}

/**
 * Clears the company tickers cache
 *
 * Useful when you want to force a fresh fetch of company tickers
 * without calling fetchCompanyTickers with forceRefresh.
 */
export function clearTickersCache() {
  tickersCache = {
    data: null,
    timestamp: 0,
  };
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * SEC EDGAR API Service
 * @namespace
 */
export default {
  // CIK utilities
  padCik,

  // API functions
  fetchCompanyFacts,
  fetchCompanyFactsByTicker,
  fetchCompanyTickers,
  mapTickerToCik,

  // Rate limiter
  getRateLimiterStatus,

  // Cache management
  clearTickersCache,

  // Error handling
  EdgarApiError,
  EDGAR_ERROR_CODES,
};
