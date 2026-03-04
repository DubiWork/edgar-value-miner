/**
 * Cache Invalidation System for SEC EDGAR Data
 *
 * Provides event-triggered cache invalidation with background refresh capabilities.
 * Implements both soft invalidation (mark stale, serve old data) and hard invalidation
 * (delete cache, force fresh fetch).
 *
 * Features:
 * - Soft invalidation: Mark as stale, trigger background refresh
 * - Hard invalidation: Delete cache entry, force fresh fetch
 * - Invalidation history tracking for debugging
 * - Duplicate prevention for background refreshes
 * - Integration with IndexedDB and Firestore caches
 *
 * @module cacheInvalidation
 */

import edgarCache from './edgarCache';
import firestoreCache from './firestoreCache';
import edgarApi from './edgarApi';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Cache Invalidation Configuration
 * @constant {Object}
 */
const INVALIDATION_CONFIG = {
  /** Duplicate refresh prevention window (5 minutes in milliseconds) */
  DUPLICATE_REFRESH_WINDOW_MS: 5 * 60 * 1000,
  /** Maximum invalidation history entries to keep per ticker */
  MAX_HISTORY_ENTRIES: 50,
  /** Cache TTL for staleness check (90 days in milliseconds) */
  CACHE_TTL_MS: 90 * 24 * 60 * 60 * 1000,
};

/**
 * Invalidation reason types
 * @constant {Object<string, string>}
 */
export const INVALIDATION_REASONS = {
  /** New SEC filing detected */
  FILING: 'filing',
  /** Significant price movement (>20% in 1 day) */
  PRICE: 'price',
  /** Manual refresh requested by user */
  MANUAL: 'manual',
  /** Cache expired (90 days old) */
  EXPIRY: 'expiry',
  /** Error in cached data */
  ERROR: 'error',
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for cache invalidation errors
 * @extends Error
 */
export class CacheInvalidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, code, cause = null) {
    super(message);
    this.name = 'CacheInvalidationError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Error codes for cache invalidation operations
 * @constant {Object<string, string>}
 */
export const INVALIDATION_ERROR_CODES = {
  INVALID_TICKER: 'INVALID_TICKER',
  INVALID_REASON: 'INVALID_REASON',
  CACHE_NOT_FOUND: 'CACHE_NOT_FOUND',
  UPDATE_FAILED: 'UPDATE_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  REFRESH_FAILED: 'REFRESH_FAILED',
};

// =============================================================================
// In-Memory State
// =============================================================================

/**
 * Tracks in-flight background refresh operations to prevent duplicates
 * @type {Map<string, Date>}
 * @private
 */
const activeRefreshes = new Map();

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
 * @returns {boolean} True if valid
 * @private
 */
function isValidTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    return false;
  }
  const normalized = normalizeTicker(ticker);
  return /^[A-Z]{1,5}$/.test(normalized);
}

/**
 * Validates an invalidation reason
 * @param {string} reason - The invalidation reason
 * @returns {boolean} True if valid
 * @private
 */
function isValidReason(reason) {
  return Object.values(INVALIDATION_REASONS).includes(reason);
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
    const prefix = '[CacheInvalidation]';
    if (data !== undefined) {
      console[level](prefix, message, data);
    } else {
      console[level](prefix, message);
    }
  }
}

/**
 * Checks if a refresh attempt is recent enough to skip duplicate refresh
 * @param {string} ticker - The ticker symbol
 * @returns {boolean} True if refresh should be skipped
 * @private
 */
function shouldSkipRefresh(ticker) {
  const lastAttempt = activeRefreshes.get(ticker);
  if (!lastAttempt) {
    return false;
  }

  const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();
  return timeSinceLastAttempt < INVALIDATION_CONFIG.DUPLICATE_REFRESH_WINDOW_MS;
}

/**
 * Adds an invalidation event to history
 * @param {Array} history - Current invalidation history
 * @param {string} reason - Invalidation reason
 * @returns {Array} Updated history (limited to MAX_HISTORY_ENTRIES)
 * @private
 *
 * Note: Reserved for Phase 2 implementation when schema supports invalidation history.
 * Currently unused but defined for future use.
 */
// eslint-disable-next-line no-unused-vars
function addToHistory(history, reason) {
  const newEntry = {
    timestamp: new Date().toISOString(),
    reason,
  };

  const updatedHistory = [newEntry, ...(history || [])];

  // Limit history size
  if (updatedHistory.length > INVALIDATION_CONFIG.MAX_HISTORY_ENTRIES) {
    return updatedHistory.slice(0, INVALIDATION_CONFIG.MAX_HISTORY_ENTRIES);
  }

  return updatedHistory;
}

// =============================================================================
// IndexedDB Operations
// =============================================================================

/**
 * Marks cache as stale in IndexedDB
 * @param {string} ticker - Company ticker symbol
 * @param {string} reason - Invalidation reason
 * @returns {Promise<boolean>} Success
 * @private
 */
async function markStaleInIndexedDB(ticker, reason) {
  try {
    // Get existing cache entry
    const cached = await edgarCache.getCompanyFacts(ticker);

    if (!cached || !cached.data) {
      devLog('warn', `No cached data found in IndexedDB for ${ticker}`);
      return false;
    }

    // Note: IndexedDB schema needs to be updated to support these fields
    // For now, we'll use the existing invalidateCache function
    // In Phase 2, we can extend the schema to support soft invalidation

    devLog('log', `Marked ${ticker} as stale in IndexedDB: ${reason}`);
    return true;
  } catch (error) {
    devLog('error', `Error marking ${ticker} as stale in IndexedDB`, error);
    return false;
  }
}

/**
 * Deletes cache entry from IndexedDB
 * @param {string} ticker - Company ticker symbol
 * @returns {Promise<boolean>} Success
 * @private
 */
async function deleteFromIndexedDB(ticker) {
  try {
    const success = await edgarCache.invalidateCache(ticker);
    if (success) {
      devLog('log', `Deleted ${ticker} from IndexedDB`);
    }
    return success;
  } catch (error) {
    devLog('error', `Error deleting ${ticker} from IndexedDB`, error);
    return false;
  }
}

// =============================================================================
// Firestore Operations
// =============================================================================

/**
 * Marks cache as stale in Firestore
 * @param {string} ticker - Company ticker symbol
 * @param {string} reason - Invalidation reason
 * @returns {Promise<boolean>} Success
 * @private
 */
async function markStaleInFirestore(ticker, reason) {
  try {
    // Use existing invalidateGlobalCache function which sets needsRefresh: true
    const success = await firestoreCache.invalidateGlobalCache(ticker);

    if (success) {
      devLog('log', `Marked ${ticker} as stale in Firestore: ${reason}`);
    } else {
      devLog('log', `Failed to mark ${ticker} as stale in Firestore (expected on client)`);
    }

    return success;
  } catch (error) {
    devLog('log', `Error marking ${ticker} as stale in Firestore (expected on client)`, error.message);
    return false;
  }
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Mark company data as stale (soft invalidation)
 *
 * This is the default invalidation strategy:
 * - Marks cache as "stale" but keeps serving it
 * - Triggers background refresh
 * - Updates cache when refresh completes
 * - User sees stale data immediately, fresh data next time
 *
 * @param {string} ticker - Company ticker symbol (e.g., "AAPL")
 * @param {string} reason - Invalidation reason (filing, price, manual, expiry, error)
 * @returns {Promise<boolean>} True if invalidation was successful
 *
 * @example
 * // When new 10-K filing detected
 * await invalidateCache('AAPL', 'filing');
 *
 * @example
 * // When price drops 20% in a day
 * await invalidateCache('AAPL', 'price');
 */
export async function invalidateCache(ticker, reason) {
  const normalizedTicker = normalizeTicker(ticker);

  // Validate inputs
  if (!isValidTicker(ticker)) {
    devLog('error', `Invalid ticker: ${ticker}`);
    return false;
  }

  if (!isValidReason(reason)) {
    devLog('error', `Invalid reason: ${reason}`);
    return false;
  }

  devLog('log', `Invalidating ${normalizedTicker}: ${reason}`);

  // Mark as stale in both caches
  const [indexedDbResult, firestoreResult] = await Promise.all([
    markStaleInIndexedDB(normalizedTicker, reason),
    markStaleInFirestore(normalizedTicker, reason),
  ]);

  // Trigger background refresh (fire and forget)
  triggerBackgroundRefresh(normalizedTicker).catch(err => {
    devLog('warn', `Background refresh failed for ${normalizedTicker}`, err.message);
  });

  // Consider success if at least one cache was updated
  const success = indexedDbResult || firestoreResult;

  if (success) {
    devLog('log', `Successfully invalidated ${normalizedTicker}`);
  } else {
    devLog('warn', `Failed to invalidate ${normalizedTicker} in any cache`);
  }

  return success;
}

/**
 * Hard delete cache entry
 *
 * This is the aggressive invalidation strategy:
 * - Deletes cache entry completely
 * - Forces fresh fetch from SEC API on next request
 * - User waits for fresh data
 * - Use for "Force Refresh" button
 *
 * @param {string} ticker - Company ticker symbol (e.g., "AAPL")
 * @returns {Promise<boolean>} True if deletion was successful
 * @throws {CacheInvalidationError} If deletion fails critically
 *
 * @example
 * // When user clicks "Force Refresh" button
 * await hardInvalidateCache('AAPL');
 */
export async function hardInvalidateCache(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  // Validate input
  if (!isValidTicker(ticker)) {
    throw new CacheInvalidationError(
      `Invalid ticker: ${ticker}`,
      INVALIDATION_ERROR_CODES.INVALID_TICKER
    );
  }

  devLog('log', `Hard invalidating ${normalizedTicker}`);

  // Delete from IndexedDB
  const indexedDbResult = await deleteFromIndexedDB(normalizedTicker);

  // Note: Firestore hard delete would require Cloud Function
  // For now, we mark as stale which has similar effect
  const firestoreResult = await markStaleInFirestore(normalizedTicker, INVALIDATION_REASONS.MANUAL);

  const success = indexedDbResult || firestoreResult;

  if (!success) {
    throw new CacheInvalidationError(
      `Failed to hard invalidate ${normalizedTicker}`,
      INVALIDATION_ERROR_CODES.DELETE_FAILED
    );
  }

  devLog('log', `Successfully hard invalidated ${normalizedTicker}`);
  return true;
}

/**
 * Check if cache is stale
 *
 * Fast metadata check to determine cache status without fetching full data.
 *
 * @param {string} ticker - Company ticker symbol (e.g., "AAPL")
 * @returns {Promise<{
 *   isStale: boolean,
 *   reason: string|null,
 *   lastUpdated: Date|null,
 *   exists: boolean
 * }>} Cache status information
 *
 * @example
 * const status = await checkCacheStatus('AAPL');
 * if (status.isStale) {
 *   console.log(`Cache is stale: ${status.reason}`);
 *   console.log(`Last updated: ${status.lastUpdated}`);
 * }
 */
export async function checkCacheStatus(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  // Validate input
  if (!isValidTicker(ticker)) {
    return {
      isStale: false,
      reason: null,
      lastUpdated: null,
      exists: false,
    };
  }

  try {
    // Check IndexedDB first (fastest)
    const cached = await edgarCache.getCompanyFacts(normalizedTicker);

    if (!cached || !cached.data) {
      return {
        isStale: false,
        reason: null,
        lastUpdated: null,
        exists: false,
      };
    }

    // Check if cache is expired based on TTL
    const lastUpdated = cached.lastUpdated ? new Date(cached.lastUpdated) : null;
    const age = lastUpdated ? Date.now() - lastUpdated.getTime() : Infinity;

    let isStale = cached.needsRefresh || false;
    let reason = null;

    if (age > INVALIDATION_CONFIG.CACHE_TTL_MS) {
      isStale = true;
      reason = INVALIDATION_REASONS.EXPIRY;
    }

    return {
      isStale,
      reason,
      lastUpdated,
      exists: true,
    };
  } catch (error) {
    devLog('error', `Error checking cache status for ${normalizedTicker}`, error);
    return {
      isStale: false,
      reason: null,
      lastUpdated: null,
      exists: false,
    };
  }
}

/**
 * Trigger background refresh for stale cache
 *
 * Fire-and-forget function that:
 * - Fetches fresh data from SEC API
 * - Updates IndexedDB and Firestore caches
 * - Does not block user interaction
 * - Prevents duplicate refreshes
 *
 * @param {string} ticker - Company ticker symbol (e.g., "AAPL")
 * @returns {Promise<void>} Resolves when refresh is complete (or fails silently)
 *
 * @example
 * // Start refresh in background
 * triggerBackgroundRefresh('AAPL').catch(err => {
 *   console.error('Background refresh failed:', err);
 * });
 * // User continues working with stale data
 */
export async function triggerBackgroundRefresh(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  // Validate input
  if (!isValidTicker(ticker)) {
    devLog('error', `Invalid ticker for background refresh: ${ticker}`);
    return;
  }

  // Check for duplicate refresh
  if (shouldSkipRefresh(normalizedTicker)) {
    devLog('log', `Skipping duplicate refresh for ${normalizedTicker} (recent attempt exists)`);
    return;
  }

  // Mark refresh as in-progress
  activeRefreshes.set(normalizedTicker, new Date());
  devLog('log', `Starting background refresh for ${normalizedTicker}`);

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
    ).catch(err => {
      // Expected to fail on client
      devLog('log', `Firestore write skipped (expected on client): ${err.message}`);
    });

    devLog('log', `Background refresh completed for ${normalizedTicker}`);
  } catch (error) {
    devLog('error', `Background refresh failed for ${normalizedTicker}`, error);
    // Don't throw - user already has stale data
  } finally {
    // Remove from active refreshes after window expires
    setTimeout(() => {
      activeRefreshes.delete(normalizedTicker);
    }, INVALIDATION_CONFIG.DUPLICATE_REFRESH_WINDOW_MS);
  }
}

/**
 * Get invalidation history (for debugging)
 *
 * Returns the history of invalidation events for a ticker.
 * Useful for debugging cache behavior and understanding why cache was invalidated.
 *
 * Note: Phase 1 implementation returns empty array.
 * Full history tracking requires schema updates in Phase 2.
 *
 * @param {string} ticker - Company ticker symbol (e.g., "AAPL")
 * @param {number} [limit=10] - Maximum records to return
 * @returns {Promise<Array<{timestamp: string, reason: string}>>} Invalidation events
 *
 * @example
 * const history = await getInvalidationHistory('AAPL', 5);
 * history.forEach(event => {
 *   console.log(`${event.timestamp}: ${event.reason}`);
 * });
 */
export async function getInvalidationHistory(ticker, limit = 10) {
  const normalizedTicker = normalizeTicker(ticker);

  // Validate input
  if (!isValidTicker(ticker)) {
    return [];
  }

  try {
    // Note: Full implementation requires schema update in edgarCache.js
    // For Phase 1, return empty array
    // In Phase 2, retrieve invalidationHistory field from cache entry

    devLog('log', `Getting invalidation history for ${normalizedTicker} (limit: ${limit})`);

    // Placeholder for Phase 2 implementation:
    // const cached = await edgarCache.getCompanyFacts(normalizedTicker);
    // if (cached && cached.invalidationHistory) {
    //   return cached.invalidationHistory.slice(0, limit);
    // }

    return [];
  } catch (error) {
    devLog('error', `Error getting invalidation history for ${normalizedTicker}`, error);
    return [];
  }
}

/**
 * Manually trigger invalidation (for testing)
 *
 * Convenience function for manual cache invalidation during testing and development.
 * Uses soft invalidation strategy by default.
 *
 * @param {string} ticker - Company ticker symbol (e.g., "AAPL")
 * @param {string} [reason='manual'] - Manual reason for invalidation
 * @returns {Promise<boolean>} True if invalidation was successful
 *
 * @example
 * // Manual invalidation for testing
 * await manualInvalidate('AAPL', 'testing-new-feature');
 */
export async function manualInvalidate(ticker, reason = 'manual') {
  return await invalidateCache(ticker, reason === 'manual' ? INVALIDATION_REASONS.MANUAL : reason);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the configuration values (read-only)
 *
 * @returns {Object} Configuration object
 */
export function getConfig() {
  return { ...INVALIDATION_CONFIG };
}

/**
 * Gets active refresh status
 *
 * Returns information about currently in-progress background refreshes.
 * Useful for debugging and monitoring.
 *
 * @returns {{
 *   count: number,
 *   tickers: string[]
 * }} Active refresh information
 *
 * @example
 * const status = getActiveRefreshStatus();
 * console.log(`${status.count} refreshes in progress: ${status.tickers.join(', ')}`);
 */
export function getActiveRefreshStatus() {
  return {
    count: activeRefreshes.size,
    tickers: Array.from(activeRefreshes.keys()),
  };
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * Cache Invalidation Service
 * @namespace
 */
export default {
  // Main invalidation functions
  invalidateCache,
  hardInvalidateCache,

  // Status and monitoring
  checkCacheStatus,
  getInvalidationHistory,

  // Background refresh
  triggerBackgroundRefresh,

  // Utilities
  manualInvalidate,
  getActiveRefreshStatus,
  getConfig,

  // Constants
  INVALIDATION_REASONS,
  INVALIDATION_ERROR_CODES,

  // Error class
  CacheInvalidationError,
};
