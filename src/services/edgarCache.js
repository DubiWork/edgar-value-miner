/**
 * IndexedDB Cache Service for SEC EDGAR Data
 *
 * Provides local-first caching for SEC EDGAR Company Facts and ticker mappings
 * using IndexedDB for fast reads and offline support.
 *
 * Features:
 * - Local-first caching strategy for instant loads
 * - TTL management with automatic expiration
 * - Graceful degradation when IndexedDB not available
 * - Cache statistics and management functions
 *
 * @module edgarCache
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * IndexedDB Configuration
 * @constant {Object}
 */
const DB_CONFIG = {
  /** Database name */
  DB_NAME: 'edgar-value-miner',
  /** Database version */
  DB_VERSION: 1,
  /** Object store names */
  STORES: {
    COMPANY_FACTS: 'companyFacts',
    TICKER_MAPPINGS: 'tickerMappings',
  },
};

/**
 * TTL Configuration (Time To Live)
 * @constant {Object}
 */
export const TTL_CONFIG = {
  /** TTL for ticker mappings (24 hours in milliseconds) */
  TICKER_MAPPING_TTL: 24 * 60 * 60 * 1000,
  /** TTL for company facts (90 days - SEC filings are quarterly) */
  COMPANY_FACTS_TTL: 90 * 24 * 60 * 60 * 1000,
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for IndexedDB cache errors
 * @extends Error
 */
export class EdgarCacheError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, code, cause = null) {
    super(message);
    this.name = 'EdgarCacheError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Error codes for cache operations
 * @constant {Object<string, string>}
 */
export const CACHE_ERROR_CODES = {
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
};

// =============================================================================
// Database Initialization
// =============================================================================

/** @type {IDBDatabase|null} */
let dbInstance = null;

/** @type {Promise<IDBDatabase>|null} */
let dbInitPromise = null;

/** @type {boolean} */
let isSupported = true;

/**
 * Checks if IndexedDB is supported in the current environment
 * @returns {boolean} True if IndexedDB is supported
 */
export function isIndexedDBSupported() {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    // Check for IndexedDB availability
    if (!window.indexedDB) {
      return false;
    }
    // Check for Safari private mode (IndexedDB exists but throws on open)
    // This will be caught in the actual open operation
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens and initializes the IndexedDB database
 *
 * Creates object stores and indexes if they don't exist.
 * Uses lazy initialization - database is opened on first use.
 *
 * @returns {Promise<IDBDatabase>} The database instance
 * @throws {EdgarCacheError} If database cannot be opened
 * @private
 */
function openDatabase() {
  // Return existing promise if initialization is in progress
  if (dbInitPromise) {
    return dbInitPromise;
  }

  // Return existing instance if already initialized
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  // Check for IndexedDB support
  if (!isIndexedDBSupported()) {
    isSupported = false;
    return Promise.reject(
      new EdgarCacheError(
        'IndexedDB is not supported in this browser',
        CACHE_ERROR_CODES.NOT_SUPPORTED
      )
    );
  }

  dbInitPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_CONFIG.DB_NAME, DB_CONFIG.DB_VERSION);

      request.onerror = (event) => {
        dbInitPromise = null;
        isSupported = false;
        const error = event.target.error;

        // Handle Safari private mode
        if (error && error.name === 'InvalidStateError') {
          reject(
            new EdgarCacheError(
              'IndexedDB not available in private browsing mode',
              CACHE_ERROR_CODES.NOT_SUPPORTED,
              error
            )
          );
          return;
        }

        reject(
          new EdgarCacheError(
            `Failed to open IndexedDB: ${error?.message || 'Unknown error'}`,
            CACHE_ERROR_CODES.DATABASE_ERROR,
            error
          )
        );
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create companyFacts object store
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.COMPANY_FACTS)) {
          const companyFactsStore = db.createObjectStore(DB_CONFIG.STORES.COMPANY_FACTS, {
            keyPath: 'ticker',
          });
          companyFactsStore.createIndex('cik', 'cik', { unique: false });
          companyFactsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
          companyFactsStore.createIndex('expiresAt', 'expiresAt', { unique: false });

          if (import.meta.env.DEV) {
            console.log('EdgarCache: Created companyFacts object store');
          }
        }

        // Create tickerMappings object store
        if (!db.objectStoreNames.contains(DB_CONFIG.STORES.TICKER_MAPPINGS)) {
          const tickerMappingsStore = db.createObjectStore(DB_CONFIG.STORES.TICKER_MAPPINGS, {
            keyPath: 'ticker',
          });
          tickerMappingsStore.createIndex('cik', 'cik', { unique: false });
          tickerMappingsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
          tickerMappingsStore.createIndex('expiresAt', 'expiresAt', { unique: false });

          if (import.meta.env.DEV) {
            console.log('EdgarCache: Created tickerMappings object store');
          }
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;

        // Handle database connection errors
        dbInstance.onerror = (event) => {
          if (import.meta.env.DEV) {
            console.error('EdgarCache: Database error', event.target.error);
          }
        };

        // Handle version change (another tab opened with newer version)
        dbInstance.onversionchange = () => {
          dbInstance.close();
          dbInstance = null;
          dbInitPromise = null;
          if (import.meta.env.DEV) {
            console.warn('EdgarCache: Database version changed, connection closed');
          }
        };

        if (import.meta.env.DEV) {
          console.log('EdgarCache: Database initialized successfully');
        }

        resolve(dbInstance);
      };
    } catch (error) {
      dbInitPromise = null;
      isSupported = false;
      reject(
        new EdgarCacheError(
          `Failed to initialize IndexedDB: ${error.message}`,
          CACHE_ERROR_CODES.DATABASE_ERROR,
          error
        )
      );
    }
  });

  return dbInitPromise;
}

/**
 * Gets the database instance, initializing if necessary
 * @returns {Promise<IDBDatabase|null>} Database instance or null if not supported
 * @private
 */
async function getDatabase() {
  if (!isSupported) {
    return null;
  }

  try {
    return await openDatabase();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('EdgarCache: Database not available', error.message);
    }
    return null;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalizes a ticker symbol to uppercase
 * @param {string} ticker - The ticker symbol
 * @returns {string} Normalized ticker
 * @private
 */
function normalizeTicker(ticker) {
  return String(ticker).trim().toUpperCase();
}

/**
 * Checks if a cache entry has expired
 * @param {Object} entry - Cache entry with expiresAt timestamp
 * @returns {boolean} True if entry has expired
 * @private
 */
function isExpired(entry) {
  if (!entry || !entry.expiresAt) {
    return true;
  }
  return Date.now() > entry.expiresAt;
}

/**
 * Wraps an IndexedDB request in a Promise
 * @param {IDBRequest} request - IndexedDB request
 * @returns {Promise<any>} Promise resolving to the request result
 * @private
 */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      const error = request.error;
      if (error && error.name === 'QuotaExceededError') {
        reject(
          new EdgarCacheError(
            'Storage quota exceeded. Please clear some cached data.',
            CACHE_ERROR_CODES.QUOTA_EXCEEDED,
            error
          )
        );
      } else {
        reject(
          new EdgarCacheError(
            `Transaction failed: ${error?.message || 'Unknown error'}`,
            CACHE_ERROR_CODES.TRANSACTION_ERROR,
            error
          )
        );
      }
    };
  });
}

// =============================================================================
// Company Facts Cache Operations
// =============================================================================

/**
 * Gets cached company facts for a ticker
 *
 * Returns cached data if found and not expired.
 * If data is found but expired, returns it with needsRefresh flag.
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<{data: Object, needsRefresh: boolean}|null>} Cached data or null
 *
 * @example
 * const cached = await getCompanyFacts('AAPL');
 * if (cached) {
 *   console.log(cached.data); // SEC Company Facts JSON
 *   if (cached.needsRefresh) {
 *     // Data is stale, fetch fresh data in background
 *   }
 * }
 */
export async function getCompanyFacts(ticker) {
  const db = await getDatabase();
  if (!db) {
    return null;
  }

  const normalizedTicker = normalizeTicker(ticker);

  try {
    const transaction = db.transaction(DB_CONFIG.STORES.COMPANY_FACTS, 'readonly');
    const store = transaction.objectStore(DB_CONFIG.STORES.COMPANY_FACTS);
    const request = store.get(normalizedTicker);
    const entry = await promisifyRequest(request);

    if (!entry) {
      return null;
    }

    // Return data even if stale, but mark as needing refresh
    const needsRefresh = isExpired(entry);

    return {
      data: entry.data,
      needsRefresh,
      cik: entry.cik,
      lastUpdated: entry.lastUpdated,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error getting company facts', error);
    }
    return null;
  }
}

/**
 * Saves company facts to cache
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @param {Object} data - The SEC Company Facts JSON data
 * @param {string} [cik] - Optional CIK number (extracted from data if not provided)
 * @returns {Promise<boolean>} True if save was successful
 *
 * @example
 * const facts = await fetchCompanyFacts('320193');
 * await setCompanyFacts('AAPL', facts, '0000320193');
 */
export async function setCompanyFacts(ticker, data, cik = null) {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  const normalizedTicker = normalizeTicker(ticker);
  const now = Date.now();

  // Extract CIK from data if not provided
  const resolvedCik = cik || data?.cik || null;

  const entry = {
    ticker: normalizedTicker,
    cik: resolvedCik,
    data: data,
    lastUpdated: now,
    expiresAt: now + TTL_CONFIG.COMPANY_FACTS_TTL,
  };

  try {
    const transaction = db.transaction(DB_CONFIG.STORES.COMPANY_FACTS, 'readwrite');
    const store = transaction.objectStore(DB_CONFIG.STORES.COMPANY_FACTS);
    const request = store.put(entry);
    await promisifyRequest(request);

    if (import.meta.env.DEV) {
      console.log(`EdgarCache: Saved company facts for ${normalizedTicker}`);
    }

    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error saving company facts', error);
    }
    return false;
  }
}

// =============================================================================
// Ticker Mapping Cache Operations
// =============================================================================

/**
 * Gets CIK for a ticker from cache
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<{cik: string, companyName: string, needsRefresh: boolean}|null>} Cached mapping or null
 *
 * @example
 * const mapping = await getCikForTicker('AAPL');
 * if (mapping) {
 *   console.log(mapping.cik); // "0000320193"
 *   console.log(mapping.companyName); // "Apple Inc."
 * }
 */
export async function getCikForTicker(ticker) {
  const db = await getDatabase();
  if (!db) {
    return null;
  }

  const normalizedTicker = normalizeTicker(ticker);

  try {
    const transaction = db.transaction(DB_CONFIG.STORES.TICKER_MAPPINGS, 'readonly');
    const store = transaction.objectStore(DB_CONFIG.STORES.TICKER_MAPPINGS);
    const request = store.get(normalizedTicker);
    const entry = await promisifyRequest(request);

    if (!entry) {
      return null;
    }

    const needsRefresh = isExpired(entry);

    return {
      cik: entry.cik,
      companyName: entry.companyName,
      needsRefresh,
      lastUpdated: entry.lastUpdated,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error getting ticker mapping', error);
    }
    return null;
  }
}

/**
 * Saves ticker to CIK mapping to cache
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @param {string} cik - The CIK number (e.g., "0000320193")
 * @param {string} companyName - The company name (e.g., "Apple Inc.")
 * @returns {Promise<boolean>} True if save was successful
 *
 * @example
 * await setTickerMapping('AAPL', '0000320193', 'Apple Inc.');
 */
export async function setTickerMapping(ticker, cik, companyName) {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  const normalizedTicker = normalizeTicker(ticker);
  const now = Date.now();

  const entry = {
    ticker: normalizedTicker,
    cik: cik,
    companyName: companyName,
    lastUpdated: now,
    expiresAt: now + TTL_CONFIG.TICKER_MAPPING_TTL,
  };

  try {
    const transaction = db.transaction(DB_CONFIG.STORES.TICKER_MAPPINGS, 'readwrite');
    const store = transaction.objectStore(DB_CONFIG.STORES.TICKER_MAPPINGS);
    const request = store.put(entry);
    await promisifyRequest(request);

    if (import.meta.env.DEV) {
      console.log(`EdgarCache: Saved ticker mapping for ${normalizedTicker}`);
    }

    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error saving ticker mapping', error);
    }
    return false;
  }
}

// =============================================================================
// Cache Invalidation
// =============================================================================

/**
 * Removes a ticker from both caches (company facts and ticker mappings)
 *
 * Use this when new SEC filing is detected or data needs to be refreshed.
 *
 * @param {string} ticker - The ticker symbol to invalidate
 * @returns {Promise<boolean>} True if invalidation was successful
 *
 * @example
 * // When new 10-K filing is detected
 * await invalidateCache('AAPL');
 */
export async function invalidateCache(ticker) {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  const normalizedTicker = normalizeTicker(ticker);

  try {
    // Delete from both stores in a single transaction would require
    // separate transactions since they are different object stores
    const companyFactsTx = db.transaction(DB_CONFIG.STORES.COMPANY_FACTS, 'readwrite');
    const companyFactsStore = companyFactsTx.objectStore(DB_CONFIG.STORES.COMPANY_FACTS);
    await promisifyRequest(companyFactsStore.delete(normalizedTicker));

    const tickerMappingsTx = db.transaction(DB_CONFIG.STORES.TICKER_MAPPINGS, 'readwrite');
    const tickerMappingsStore = tickerMappingsTx.objectStore(DB_CONFIG.STORES.TICKER_MAPPINGS);
    await promisifyRequest(tickerMappingsStore.delete(normalizedTicker));

    if (import.meta.env.DEV) {
      console.log(`EdgarCache: Invalidated cache for ${normalizedTicker}`);
    }

    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error invalidating cache', error);
    }
    return false;
  }
}

/**
 * Clears all cached data from IndexedDB
 *
 * Use with caution - this removes all cached company facts and ticker mappings.
 *
 * @returns {Promise<boolean>} True if clear was successful
 *
 * @example
 * // Clear all cache on user logout or manual refresh
 * await clearAllCache();
 */
export async function clearAllCache() {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  try {
    // Clear company facts store
    const companyFactsTx = db.transaction(DB_CONFIG.STORES.COMPANY_FACTS, 'readwrite');
    const companyFactsStore = companyFactsTx.objectStore(DB_CONFIG.STORES.COMPANY_FACTS);
    await promisifyRequest(companyFactsStore.clear());

    // Clear ticker mappings store
    const tickerMappingsTx = db.transaction(DB_CONFIG.STORES.TICKER_MAPPINGS, 'readwrite');
    const tickerMappingsStore = tickerMappingsTx.objectStore(DB_CONFIG.STORES.TICKER_MAPPINGS);
    await promisifyRequest(tickerMappingsStore.clear());

    if (import.meta.env.DEV) {
      console.log('EdgarCache: Cleared all cache');
    }

    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error clearing cache', error);
    }
    return false;
  }
}

// =============================================================================
// Cache Statistics and Maintenance
// =============================================================================

/**
 * Gets cache statistics (count and estimated size)
 *
 * @returns {Promise<{
 *   companyFacts: { count: number, estimatedSizeBytes: number },
 *   tickerMappings: { count: number, estimatedSizeBytes: number },
 *   totalCount: number,
 *   totalEstimatedSizeBytes: number,
 *   isSupported: boolean
 * }>} Cache statistics
 *
 * @example
 * const stats = await getCacheStats();
 * console.log(`Cached ${stats.companyFacts.count} company facts`);
 * console.log(`Total size: ${(stats.totalEstimatedSizeBytes / 1024 / 1024).toFixed(2)} MB`);
 */
export async function getCacheStats() {
  const defaultStats = {
    companyFacts: { count: 0, estimatedSizeBytes: 0 },
    tickerMappings: { count: 0, estimatedSizeBytes: 0 },
    totalCount: 0,
    totalEstimatedSizeBytes: 0,
    isSupported: isSupported,
  };

  const db = await getDatabase();
  if (!db) {
    return defaultStats;
  }

  try {
    // Get company facts stats
    const companyFactsTx = db.transaction(DB_CONFIG.STORES.COMPANY_FACTS, 'readonly');
    const companyFactsStore = companyFactsTx.objectStore(DB_CONFIG.STORES.COMPANY_FACTS);
    const companyFactsCount = await promisifyRequest(companyFactsStore.count());

    // Estimate size by sampling (full size calculation would be too expensive)
    let companyFactsSize = 0;
    const companyFactsCursor = companyFactsStore.openCursor();
    let sampleCount = 0;
    let sampleSize = 0;

    await new Promise((resolve) => {
      companyFactsCursor.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && sampleCount < 5) {
          // Sample up to 5 entries
          sampleSize += JSON.stringify(cursor.value).length * 2; // Approximate bytes
          sampleCount++;
          cursor.continue();
        } else {
          // Estimate total size based on sample
          if (sampleCount > 0) {
            companyFactsSize = Math.round((sampleSize / sampleCount) * companyFactsCount);
          }
          resolve();
        }
      };
      companyFactsCursor.onerror = () => resolve();
    });

    // Get ticker mappings stats
    const tickerMappingsTx = db.transaction(DB_CONFIG.STORES.TICKER_MAPPINGS, 'readonly');
    const tickerMappingsStore = tickerMappingsTx.objectStore(DB_CONFIG.STORES.TICKER_MAPPINGS);
    const tickerMappingsCount = await promisifyRequest(tickerMappingsStore.count());

    // Ticker mappings are small, estimate ~200 bytes each
    const tickerMappingsSize = tickerMappingsCount * 200;

    return {
      companyFacts: { count: companyFactsCount, estimatedSizeBytes: companyFactsSize },
      tickerMappings: { count: tickerMappingsCount, estimatedSizeBytes: tickerMappingsSize },
      totalCount: companyFactsCount + tickerMappingsCount,
      totalEstimatedSizeBytes: companyFactsSize + tickerMappingsSize,
      isSupported: true,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error getting cache stats', error);
    }
    return defaultStats;
  }
}

/**
 * Cleans up expired entries from cache
 *
 * This function removes entries that have passed their TTL.
 * Can be called periodically or on app startup.
 *
 * @returns {Promise<{ companyFactsRemoved: number, tickerMappingsRemoved: number }>}
 *
 * @example
 * const cleaned = await cleanupExpiredEntries();
 * console.log(`Removed ${cleaned.companyFactsRemoved} expired company facts`);
 */
export async function cleanupExpiredEntries() {
  const result = { companyFactsRemoved: 0, tickerMappingsRemoved: 0 };

  const db = await getDatabase();
  if (!db) {
    return result;
  }

  const now = Date.now();

  try {
    // Clean expired company facts
    const companyFactsTx = db.transaction(DB_CONFIG.STORES.COMPANY_FACTS, 'readwrite');
    const companyFactsStore = companyFactsTx.objectStore(DB_CONFIG.STORES.COMPANY_FACTS);
    const companyFactsIndex = companyFactsStore.index('expiresAt');

    // Get all expired entries using cursor on expiresAt index
    const expiredRange = IDBKeyRange.upperBound(now);
    const cursor = companyFactsIndex.openCursor(expiredRange);

    await new Promise((resolve) => {
      cursor.onsuccess = (event) => {
        const cursorResult = event.target.result;
        if (cursorResult) {
          cursorResult.delete();
          result.companyFactsRemoved++;
          cursorResult.continue();
        } else {
          resolve();
        }
      };
      cursor.onerror = () => resolve();
    });

    // Clean expired ticker mappings
    const tickerMappingsTx = db.transaction(DB_CONFIG.STORES.TICKER_MAPPINGS, 'readwrite');
    const tickerMappingsStore = tickerMappingsTx.objectStore(DB_CONFIG.STORES.TICKER_MAPPINGS);
    const tickerMappingsIndex = tickerMappingsStore.index('expiresAt');

    const mappingsCursor = tickerMappingsIndex.openCursor(expiredRange);

    await new Promise((resolve) => {
      mappingsCursor.onsuccess = (event) => {
        const cursorResult = event.target.result;
        if (cursorResult) {
          cursorResult.delete();
          result.tickerMappingsRemoved++;
          cursorResult.continue();
        } else {
          resolve();
        }
      };
      mappingsCursor.onerror = () => resolve();
    });

    if (import.meta.env.DEV && (result.companyFactsRemoved > 0 || result.tickerMappingsRemoved > 0)) {
      console.log(
        `EdgarCache: Cleaned up ${result.companyFactsRemoved} company facts, ${result.tickerMappingsRemoved} ticker mappings`
      );
    }

    return result;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('EdgarCache: Error cleaning up expired entries', error);
    }
    return result;
  }
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initializes the cache (lazy initialization)
 *
 * This function is called automatically on first cache operation.
 * Can also be called explicitly to pre-initialize the database.
 *
 * @returns {Promise<boolean>} True if initialization was successful
 *
 * @example
 * // Pre-initialize on app startup
 * const success = await initializeCache();
 * if (!success) {
 *   console.warn('Cache not available, will use network only');
 * }
 */
export async function initializeCache() {
  try {
    const db = await openDatabase();
    return !!db;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('EdgarCache: Initialization failed', error.message);
    }
    return false;
  }
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * SEC EDGAR Cache Service
 * @namespace
 */
export default {
  // Initialization
  initializeCache,
  isIndexedDBSupported,

  // Company Facts operations
  getCompanyFacts,
  setCompanyFacts,

  // Ticker Mapping operations
  getCikForTicker,
  setTickerMapping,

  // Cache management
  invalidateCache,
  clearAllCache,
  getCacheStats,
  cleanupExpiredEntries,

  // Error handling
  EdgarCacheError,
  CACHE_ERROR_CODES,

  // Configuration (read-only)
  TTL_CONFIG: { ...TTL_CONFIG },
};
