/**
 * Hybrid Cache Coordinator for SEC EDGAR Data
 *
 * Orchestrates a 3-tier caching strategy for optimal performance and cost:
 *
 * L1 (IndexedDB) - Instant local reads, user-specific
 * L2 (Firestore) - Shared global cache across all users
 * L3 (SEC API) - Source of truth, rate-limited
 *
 * Cache Read Flow:
 * 1. Check IndexedDB (fastest, free)
 *    - If found & fresh: return immediately
 *    - If found & stale: return + async refresh in background
 *    - If not found: continue to step 2
 *
 * 2. Check Firestore global cache
 *    - If found: save to IndexedDB + return
 *    - If not found: continue to step 3
 *
 * 3. Fetch from SEC API
 *    - Save to IndexedDB (local cache)
 *    - Save to Firestore (will fail on client, handled by Cloud Function)
 *    - Return data
 *
 * @module cacheCoordinator
 */

import edgarApi from './edgarApi';
import edgarCache from './edgarCache';
import firestoreCache from './firestoreCache';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Cache Coordinator Configuration
 * @constant {Object}
 */
const COORDINATOR_CONFIG = {
  /** Cost per SEC API + AI processing (for cost savings calculation) */
  COST_PER_SEC_LOOKUP: 4.27,
  /** Timeout for Firestore reads (milliseconds) */
  FIRESTORE_TIMEOUT_MS: 5000,
  /** Maximum concurrent prefetch operations */
  MAX_CONCURRENT_PREFETCH: 3,
  /** Default TTL check threshold (1 day in milliseconds) */
  STALE_THRESHOLD_MS: 24 * 60 * 60 * 1000,
};

/**
 * Cache source identifiers
 * @constant {Object<string, string>}
 */
export const CACHE_SOURCES = {
  INDEXEDDB: 'indexeddb',
  FIRESTORE: 'firestore',
  SEC_API: 'sec-api',
  NONE: 'none',
};

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Error codes for cache coordinator operations
 * @constant {Object<string, string>}
 */
export const COORDINATOR_ERROR_CODES = {
  INVALID_TICKER: 'INVALID_TICKER',
  ALL_LAYERS_FAILED: 'ALL_LAYERS_FAILED',
  SEC_API_ERROR: 'SEC_API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
};

/**
 * Creates a standardized error object (never throws)
 * @param {string} code - Error code from COORDINATOR_ERROR_CODES
 * @param {string} message - Human-readable error message
 * @param {Error} [cause] - Original error that caused this error
 * @returns {Object} Error object
 * @private
 */
function createError(code, message, cause = null) {
  return {
    code,
    message,
    cause: cause ? { name: cause.name, message: cause.message } : null,
  };
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
 * Validates a ticker symbol
 * @param {string} ticker - The ticker symbol to validate
 * @returns {{ valid: boolean, error: Object|null, normalized: string }}
 * @private
 */
function validateTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    return {
      valid: false,
      error: createError(COORDINATOR_ERROR_CODES.INVALID_TICKER, 'Ticker symbol is required'),
      normalized: '',
    };
  }

  const normalized = normalizeTicker(ticker);

  if (!/^[A-Z]{1,5}$/.test(normalized)) {
    return {
      valid: false,
      error: createError(
        COORDINATOR_ERROR_CODES.INVALID_TICKER,
        `Invalid ticker "${ticker}": Ticker must be 1-5 letters`
      ),
      normalized,
    };
  }

  return { valid: true, error: null, normalized };
}

/**
 * Creates a promise that rejects after a timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operation - Description of the operation (for error message)
 * @returns {Promise<never>}
 * @private
 */
function timeout(ms, operation) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout: ${operation} exceeded ${ms}ms`));
    }, ms);
  });
}

/**
 * Races a promise against a timeout
 * @param {Promise<T>} promise - The promise to race
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operation - Description of the operation
 * @returns {Promise<T>}
 * @template T
 * @private
 */
function withTimeout(promise, ms, operation) {
  return Promise.race([promise, timeout(ms, operation)]);
}

/**
 * Logs messages in development mode only
 * @param {string} level - Log level ('log', 'warn', 'error')
 * @param {string} message - Message to log
 * @param {*} [data] - Optional data to log
 * @private
 */
function devLog(level, message, data = undefined) {
  if (import.meta.env.DEV) {
    const prefix = 'CacheCoordinator:';
    if (data !== undefined) {
      console[level](prefix, message, data);
    } else {
      console[level](prefix, message);
    }
  }
}

// =============================================================================
// Background Refresh
// =============================================================================

/**
 * Tracks in-flight background refresh operations to prevent duplicates
 * @type {Set<string>}
 * @private
 */
const activeRefreshes = new Set();

/**
 * Tracks in-flight getCompanyData requests for concurrent deduplication.
 * When the same ticker is requested while a fetch is in progress, the
 * same promise is returned instead of starting a duplicate request.
 * @type {Map<string, Promise>}
 * @private
 */
const inFlightRequests = new Map();

/**
 * Performs a background refresh for stale cache data
 * Fire and forget - updates all cache layers when complete
 *
 * @param {string} ticker - The ticker symbol
 * @returns {void}
 * @private
 */
function startBackgroundRefresh(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  // Prevent duplicate refresh operations
  if (activeRefreshes.has(normalizedTicker)) {
    devLog('log', `Background refresh already in progress for ${normalizedTicker}`);
    return;
  }

  activeRefreshes.add(normalizedTicker);
  devLog('log', `Starting background refresh for ${normalizedTicker}`);

  // Fire and forget - don't await
  (async () => {
    try {
      // Fetch fresh data from SEC API
      const { facts, companyInfo } = await edgarApi.fetchCompanyFactsByTicker(normalizedTicker);

      // Update IndexedDB (local cache)
      await edgarCache.setCompanyFacts(normalizedTicker, facts, companyInfo.cik);

      // Attempt to update Firestore (will fail on client, handled by Cloud Function)
      await firestoreCache.setCompanyFactsToFirestore(
        normalizedTicker,
        facts,
        companyInfo.cik,
        companyInfo.name
      );

      devLog('log', `Background refresh completed for ${normalizedTicker}`);
    } catch (error) {
      devLog('warn', `Background refresh failed for ${normalizedTicker}`, error.message);
    } finally {
      activeRefreshes.delete(normalizedTicker);
    }
  })();
}

// =============================================================================
// Main Public API
// =============================================================================

/**
 * Gets company data using the 3-tier cache strategy
 *
 * This is the main function that orchestrates all cache layers:
 * 1. IndexedDB (instant, local)
 * 2. Firestore (shared, global)
 * 3. SEC API (source of truth)
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @param {Object} [options={}] - Optional settings
 * @param {boolean} [options.forceRefresh=false] - Skip cache, fetch from SEC
 * @param {boolean} [options.backgroundRefresh=true] - Return stale + refresh async
 * @param {boolean} [options.includeMetadata=true] - Include cache hit/miss info
 * @returns {Promise<{
 *   success: boolean,
 *   data: {
 *     ticker: string,
 *     cik: string,
 *     companyName: string,
 *     companyFacts: Object
 *   }|null,
 *   metadata: {
 *     source: string,
 *     cacheHit: boolean,
 *     needsRefresh: boolean,
 *     lastUpdated: Date|null,
 *     costSaved: number
 *   }|null,
 *   error: { code: string, message: string }|null
 * }>}
 *
 * @example
 * // Basic usage
 * const result = await getCompanyData('AAPL');
 * if (result.success) {
 *   console.log(result.data.companyName); // "Apple Inc."
 *   console.log(result.metadata.source); // "indexeddb" | "firestore" | "sec-api"
 * }
 *
 * @example
 * // Force refresh from SEC
 * const result = await getCompanyData('AAPL', { forceRefresh: true });
 *
 * @example
 * // Without metadata
 * const result = await getCompanyData('AAPL', { includeMetadata: false });
 */
export async function getCompanyData(ticker, options = {}) {
  const {
    forceRefresh = false,
    backgroundRefresh = true,
    includeMetadata = true,
  } = options;

  // Validate ticker
  const validation = validateTicker(ticker);
  if (!validation.valid) {
    return {
      success: false,
      data: null,
      metadata: includeMetadata ? {
        source: CACHE_SOURCES.NONE,
        cacheHit: false,
        needsRefresh: false,
        lastUpdated: null,
        costSaved: 0,
      } : null,
      error: validation.error,
    };
  }

  const normalizedTicker = validation.normalized;

  // Concurrent request deduplication:
  // If the same ticker is already being fetched (non-forceRefresh), return the same promise
  if (!forceRefresh) {
    const existingRequest = inFlightRequests.get(normalizedTicker);
    if (existingRequest) {
      devLog('log', `Deduplicating concurrent request for ${normalizedTicker}`);
      return existingRequest;
    }
  }

  // Create the actual fetch promise
  const fetchPromise = _getCompanyDataInternal(normalizedTicker, {
    forceRefresh,
    backgroundRefresh,
    includeMetadata,
  });

  // Track in-flight request for deduplication (only non-forceRefresh)
  if (!forceRefresh) {
    inFlightRequests.set(normalizedTicker, fetchPromise);

    // Clean up when done (whether success or failure)
    fetchPromise.finally(() => {
      inFlightRequests.delete(normalizedTicker);
    });
  }

  return fetchPromise;
}

/**
 * Internal implementation of getCompanyData (without deduplication wrapper)
 * @private
 */
async function _getCompanyDataInternal(normalizedTicker, options) {
  const {
    forceRefresh,
    backgroundRefresh,
    includeMetadata,
  } = options;

  // Skip cache if force refresh requested
  if (!forceRefresh) {
    // ==========================================================================
    // LAYER 1: IndexedDB (Local Cache)
    // ==========================================================================
    try {
      const indexedDbResult = await edgarCache.getCompanyFacts(normalizedTicker);

      if (indexedDbResult && indexedDbResult.data) {
        devLog('log', `L1 (IndexedDB) hit for ${normalizedTicker}`, {
          needsRefresh: indexedDbResult.needsRefresh,
        });

        // Start background refresh if data is stale
        if (indexedDbResult.needsRefresh && backgroundRefresh) {
          startBackgroundRefresh(normalizedTicker);
        }

        // Return immediately with cached data
        return {
          success: true,
          data: {
            ticker: normalizedTicker,
            cik: indexedDbResult.cik || '',
            companyName: indexedDbResult.data?.entityName || '',
            companyFacts: indexedDbResult.data,
          },
          metadata: includeMetadata ? {
            source: CACHE_SOURCES.INDEXEDDB,
            cacheHit: true,
            needsRefresh: indexedDbResult.needsRefresh,
            lastUpdated: indexedDbResult.lastUpdated ? new Date(indexedDbResult.lastUpdated) : null,
            costSaved: COORDINATOR_CONFIG.COST_PER_SEC_LOOKUP,
          } : null,
          error: null,
        };
      }
    } catch (error) {
      devLog('warn', `L1 (IndexedDB) error for ${normalizedTicker}`, error.message);
      // Continue to next layer
    }

    // ==========================================================================
    // LAYER 2: Firestore (Global Cache)
    // ==========================================================================
    try {
      const firestoreResult = await withTimeout(
        firestoreCache.getCompanyFactsFromFirestore(normalizedTicker),
        COORDINATOR_CONFIG.FIRESTORE_TIMEOUT_MS,
        'Firestore read'
      );

      if (firestoreResult && firestoreResult.data) {
        devLog('log', `L2 (Firestore) hit for ${normalizedTicker}`, {
          needsRefresh: firestoreResult.needsRefresh,
        });

        // Save to IndexedDB for faster future access (async, don't wait)
        edgarCache.setCompanyFacts(
          normalizedTicker,
          firestoreResult.data,
          firestoreResult.cik
        ).catch(err => devLog('warn', 'Failed to save to IndexedDB', err.message));

        // Start background refresh if data is stale
        if (firestoreResult.needsRefresh && backgroundRefresh) {
          startBackgroundRefresh(normalizedTicker);
        }

        return {
          success: true,
          data: {
            ticker: normalizedTicker,
            cik: firestoreResult.cik || '',
            companyName: firestoreResult.companyName || firestoreResult.data?.entityName || '',
            companyFacts: firestoreResult.data,
          },
          metadata: includeMetadata ? {
            source: CACHE_SOURCES.FIRESTORE,
            cacheHit: true,
            needsRefresh: firestoreResult.needsRefresh,
            lastUpdated: firestoreResult.lastUpdated || null,
            costSaved: COORDINATOR_CONFIG.COST_PER_SEC_LOOKUP,
          } : null,
          error: null,
        };
      }
    } catch (error) {
      devLog('warn', `L2 (Firestore) error for ${normalizedTicker}`, error.message);
      // Continue to next layer
    }
  }

  // ==========================================================================
  // LAYER 3: SEC API (Source of Truth)
  // ==========================================================================
  try {
    devLog('log', `L3 (SEC API) fetching ${normalizedTicker}`);

    const { facts, companyInfo } = await edgarApi.fetchCompanyFactsByTicker(normalizedTicker);

    // Save to IndexedDB (local cache) - async, don't wait
    edgarCache.setCompanyFacts(normalizedTicker, facts, companyInfo.cik)
      .catch(err => devLog('warn', 'Failed to save to IndexedDB', err.message));

    // Attempt to save to Firestore (will fail on client due to security rules)
    // Cloud Function will handle this via a separate mechanism
    firestoreCache.setCompanyFactsToFirestore(
      normalizedTicker,
      facts,
      companyInfo.cik,
      companyInfo.name
    ).catch(err => {
      // Expected to fail on client - Cloud Functions handle global cache writes
      devLog('log', 'Firestore write skipped (expected on client)', err.message);
    });

    devLog('log', `L3 (SEC API) success for ${normalizedTicker}`);

    return {
      success: true,
      data: {
        ticker: normalizedTicker,
        cik: companyInfo.cik,
        companyName: companyInfo.name,
        companyFacts: facts,
      },
      metadata: includeMetadata ? {
        source: CACHE_SOURCES.SEC_API,
        cacheHit: false,
        needsRefresh: false,
        lastUpdated: new Date(),
        costSaved: 0, // No savings - fresh fetch
      } : null,
      error: null,
    };
  } catch (error) {
    devLog('error', `L3 (SEC API) error for ${normalizedTicker}`, error);

    return {
      success: false,
      data: null,
      metadata: includeMetadata ? {
        source: CACHE_SOURCES.NONE,
        cacheHit: false,
        needsRefresh: false,
        lastUpdated: null,
        costSaved: 0,
      } : null,
      error: createError(
        COORDINATOR_ERROR_CODES.SEC_API_ERROR,
        error.message || 'Failed to fetch from SEC API',
        error
      ),
    };
  }
}

// =============================================================================
// Cache Invalidation
// =============================================================================

/**
 * Invalidates cache across all layers for a ticker
 *
 * Removes data from IndexedDB and marks Firestore entry as needing refresh.
 * Use when data is known to be stale (e.g., new SEC filing detected).
 *
 * @param {string} ticker - The ticker symbol to invalidate
 * @returns {Promise<{
 *   success: boolean,
 *   layers: { indexeddb: boolean, firestore: boolean },
 *   error: Object|null
 * }>}
 *
 * @example
 * const result = await invalidateCache('AAPL');
 * console.log(result.layers); // { indexeddb: true, firestore: false }
 */
export async function invalidateCache(ticker) {
  const validation = validateTicker(ticker);
  if (!validation.valid) {
    return {
      success: false,
      layers: { indexeddb: false, firestore: false },
      error: validation.error,
    };
  }

  const normalizedTicker = validation.normalized;
  const results = { indexeddb: false, firestore: false };

  // Invalidate IndexedDB
  try {
    results.indexeddb = await edgarCache.invalidateCache(normalizedTicker);
  } catch (error) {
    devLog('warn', `Failed to invalidate IndexedDB for ${normalizedTicker}`, error.message);
  }

  // Invalidate Firestore (will likely fail on client)
  try {
    results.firestore = await firestoreCache.invalidateGlobalCache(normalizedTicker);
  } catch (error) {
    devLog('log', `Failed to invalidate Firestore for ${normalizedTicker} (expected on client)`, error.message);
  }

  devLog('log', `Cache invalidated for ${normalizedTicker}`, results);

  return {
    success: results.indexeddb || results.firestore,
    layers: results,
    error: null,
  };
}

// =============================================================================
// Cache Statistics
// =============================================================================

/**
 * Gets cache statistics across all layers
 *
 * Aggregates statistics from IndexedDB and Firestore caches.
 *
 * @returns {Promise<{
 *   indexeddb: {
 *     companyFacts: { count: number, estimatedSizeBytes: number },
 *     tickerMappings: { count: number, estimatedSizeBytes: number },
 *     totalCount: number,
 *     totalEstimatedSizeBytes: number,
 *     isSupported: boolean
 *   },
 *   firestore: {
 *     totalCompanies: number,
 *     totalAccessCount: number,
 *     estimatedSavings: number,
 *     costPerLookup: number,
 *     isAvailable: boolean
 *   },
 *   summary: {
 *     localCacheEntries: number,
 *     globalCacheEntries: number,
 *     totalEstimatedSavings: number
 *   }
 * }>}
 *
 * @example
 * const stats = await getCacheStats();
 * console.log(`Local cache: ${stats.summary.localCacheEntries} entries`);
 * console.log(`Global cache: ${stats.summary.globalCacheEntries} entries`);
 */
export async function getCacheStats() {
  // Fetch stats from both layers in parallel
  const [indexedDbStats, firestoreStats] = await Promise.all([
    edgarCache.getCacheStats().catch(err => {
      devLog('warn', 'Failed to get IndexedDB stats', err.message);
      return {
        companyFacts: { count: 0, estimatedSizeBytes: 0 },
        tickerMappings: { count: 0, estimatedSizeBytes: 0 },
        totalCount: 0,
        totalEstimatedSizeBytes: 0,
        isSupported: false,
      };
    }),
    firestoreCache.getGlobalCacheStats().catch(err => {
      devLog('warn', 'Failed to get Firestore stats', err.message);
      return {
        totalCompanies: 0,
        totalAccessCount: 0,
        estimatedSavings: 0,
        costPerLookup: COORDINATOR_CONFIG.COST_PER_SEC_LOOKUP,
        isAvailable: false,
      };
    }),
  ]);

  return {
    indexeddb: indexedDbStats,
    firestore: firestoreStats,
    summary: {
      localCacheEntries: indexedDbStats.companyFacts?.count || 0,
      globalCacheEntries: firestoreStats.totalCompanies || 0,
      totalEstimatedSavings: firestoreStats.estimatedSavings || 0,
    },
  };
}

// =============================================================================
// Prefetch
// =============================================================================

/**
 * Prefetches company data for multiple tickers
 *
 * Useful for warming the cache with popular tickers.
 * Respects rate limits and processes in batches.
 *
 * @param {string[]} tickers - Array of ticker symbols to prefetch
 * @param {Object} [options={}] - Optional settings
 * @param {number} [options.concurrency=3] - Max concurrent fetches
 * @param {Function} [options.onProgress] - Progress callback (completed, total)
 * @returns {Promise<{
 *   success: boolean,
 *   results: Array<{ ticker: string, success: boolean, source: string }>,
 *   summary: { total: number, successful: number, failed: number }
 * }>}
 *
 * @example
 * const result = await prefetchCompanies(['AAPL', 'MSFT', 'GOOGL'], {
 *   onProgress: (completed, total) => console.log(`${completed}/${total}`)
 * });
 * console.log(`Prefetched ${result.summary.successful} companies`);
 */
export async function prefetchCompanies(tickers, options = {}) {
  const {
    concurrency = COORDINATOR_CONFIG.MAX_CONCURRENT_PREFETCH,
    onProgress,
  } = options;

  if (!Array.isArray(tickers) || tickers.length === 0) {
    return {
      success: true,
      results: [],
      summary: { total: 0, successful: 0, failed: 0 },
    };
  }

  const results = [];
  let completed = 0;

  // Process in batches based on concurrency
  for (let i = 0; i < tickers.length; i += concurrency) {
    const batch = tickers.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        const result = await getCompanyData(ticker, {
          forceRefresh: false,
          backgroundRefresh: false,
          includeMetadata: true,
        });

        completed++;
        if (onProgress) {
          onProgress(completed, tickers.length);
        }

        return {
          ticker: normalizeTicker(ticker),
          success: result.success,
          source: result.metadata?.source || CACHE_SOURCES.NONE,
        };
      })
    );

    results.push(...batchResults);
  }

  const successful = results.filter(r => r.success).length;

  return {
    success: true,
    results,
    summary: {
      total: tickers.length,
      successful,
      failed: tickers.length - successful,
    },
  };
}

// =============================================================================
// Background Refresh for Stale Cache
// =============================================================================

/**
 * Refreshes stale cache for a specific ticker
 *
 * Unlike getCompanyData with forceRefresh, this function:
 * - Returns immediately without blocking
 * - Only refreshes if data is actually stale
 * - Is idempotent (won't duplicate in-flight refreshes)
 *
 * @param {string} ticker - The ticker symbol to refresh
 * @returns {Promise<{
 *   started: boolean,
 *   reason: string
 * }>}
 *
 * @example
 * const result = await refreshStaleCache('AAPL');
 * console.log(result.reason); // "Refresh started" or "Already fresh"
 */
export async function refreshStaleCache(ticker) {
  const validation = validateTicker(ticker);
  if (!validation.valid) {
    return {
      started: false,
      reason: validation.error.message,
    };
  }

  const normalizedTicker = validation.normalized;

  // Check if refresh is already in progress
  if (activeRefreshes.has(normalizedTicker)) {
    return {
      started: false,
      reason: 'Refresh already in progress',
    };
  }

  // Check if data exists and is stale
  try {
    const cached = await edgarCache.getCompanyFacts(normalizedTicker);

    if (!cached) {
      // No cached data - start a full fetch in background
      startBackgroundRefresh(normalizedTicker);
      return {
        started: true,
        reason: 'No cached data, fetching fresh',
      };
    }

    if (cached.needsRefresh) {
      startBackgroundRefresh(normalizedTicker);
      return {
        started: true,
        reason: 'Cache stale, refresh started',
      };
    }

    return {
      started: false,
      reason: 'Cache is fresh, no refresh needed',
    };
  } catch (error) {
    devLog('warn', `Error checking cache for ${normalizedTicker}`, error.message);
    // Start refresh anyway on error
    startBackgroundRefresh(normalizedTicker);
    return {
      started: true,
      reason: 'Error checking cache, refresh started as fallback',
    };
  }
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * Hybrid Cache Coordinator Service
 * @namespace
 */
export default {
  // Main API
  getCompanyData,

  // Cache management
  invalidateCache,
  getCacheStats,

  // Prefetch and refresh
  prefetchCompanies,
  refreshStaleCache,

  // Constants
  CACHE_SOURCES,
  COORDINATOR_ERROR_CODES,

  // Configuration (read-only)
  config: { ...COORDINATOR_CONFIG },
};
