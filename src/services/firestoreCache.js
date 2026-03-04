/**
 * Firestore Global Cache Service for SEC EDGAR Data
 *
 * Provides a global shared cache across all users using Firestore.
 * This is CRITICAL for unit economics:
 * - First user to search a company = cache write ($4.27 cost)
 * - All subsequent users = free cache read (saves $4.27 per user)
 *
 * Security Model:
 * - Read: Anyone can read (client-side reads allowed)
 * - Write: Only Cloud Functions can write (security rules block client writes)
 * - Write functions are provided for use by Cloud Functions (Sub-task #8)
 *
 * Features:
 * - Global shared cache across all users
 * - Staleness detection with needsRefresh flag
 * - Access count tracking for cost savings metrics
 * - Graceful error handling for offline mode and permission errors
 *
 * @module firestoreCache
 */

import { db, getCurrentUserId } from '../lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  Timestamp,
  collection,
  getCountFromServer,
} from 'firebase/firestore';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Firestore Collection Configuration
 * @constant {Object}
 */
const FIRESTORE_CONFIG = {
  /** Collection name for EDGAR cache */
  COLLECTION_NAME: 'edgarCache',
  /** Current schema version for migrations */
  SCHEMA_VERSION: 1,
  /** TTL for cache entries (90 days in milliseconds) */
  CACHE_TTL_MS: 90 * 24 * 60 * 60 * 1000,
  /** Cost per SEC API + AI processing (used for savings calculation) */
  COST_PER_LOOKUP: 4.27,
};

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Custom error class for Firestore cache errors
 * @extends Error
 */
export class FirestoreCacheError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Error} [cause] - Original error that caused this error
   */
  constructor(message, code, cause = null) {
    super(message);
    this.name = 'FirestoreCacheError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Error codes for Firestore cache operations
 * @constant {Object<string, string>}
 */
export const FIRESTORE_CACHE_ERROR_CODES = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_DATA: 'INVALID_DATA',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

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
 * Checks if a cache entry is stale based on various criteria
 * @param {Object} data - Cache entry data
 * @returns {boolean} True if entry is stale and needs refresh
 * @private
 */
function isStale(data) {
  // Check explicit needsRefresh flag
  if (data.needsRefresh === true) {
    return true;
  }

  // Check if lastUpdated is older than TTL
  if (data.lastUpdated) {
    const lastUpdatedMs = data.lastUpdated instanceof Timestamp
      ? data.lastUpdated.toMillis()
      : data.lastUpdated;
    const age = Date.now() - lastUpdatedMs;
    if (age > FIRESTORE_CONFIG.CACHE_TTL_MS) {
      return true;
    }
  }

  return false;
}

/**
 * Classifies Firestore errors into appropriate error codes
 * @param {Error} error - The original error
 * @returns {string} Error code from FIRESTORE_CACHE_ERROR_CODES
 * @private
 */
function classifyError(error) {
  const errorMessage = error.message || '';
  const errorCode = error.code || '';

  // Permission denied errors
  if (
    errorCode === 'permission-denied' ||
    errorMessage.includes('PERMISSION_DENIED') ||
    errorMessage.includes('Missing or insufficient permissions')
  ) {
    return FIRESTORE_CACHE_ERROR_CODES.PERMISSION_DENIED;
  }

  // Network errors
  if (
    errorCode === 'unavailable' ||
    errorMessage.includes('network') ||
    errorMessage.includes('offline') ||
    errorMessage.includes('Failed to fetch')
  ) {
    return FIRESTORE_CACHE_ERROR_CODES.NETWORK_ERROR;
  }

  // Quota errors
  if (
    errorCode === 'resource-exhausted' ||
    errorMessage.includes('quota')
  ) {
    return FIRESTORE_CACHE_ERROR_CODES.QUOTA_EXCEEDED;
  }

  // Not found errors
  if (
    errorCode === 'not-found' ||
    errorMessage.includes('not found')
  ) {
    return FIRESTORE_CACHE_ERROR_CODES.NOT_FOUND;
  }

  return FIRESTORE_CACHE_ERROR_CODES.UNKNOWN_ERROR;
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
    const prefix = 'FirestoreCache:';
    if (data !== undefined) {
      console[level](prefix, message, data);
    } else {
      console[level](prefix, message);
    }
  }
}

// =============================================================================
// Public API Functions - Read Operations
// =============================================================================

/**
 * Gets cached company facts from Firestore global cache
 *
 * Returns cached data with staleness metadata.
 * Automatically increments access count (if permissions allow).
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<{
 *   data: Object,
 *   ticker: string,
 *   cik: string,
 *   companyName: string,
 *   lastUpdated: Date,
 *   lastFiling: Date|null,
 *   accessCount: number,
 *   needsRefresh: boolean,
 *   version: number
 * }|null>} Cached data with metadata, or null if not found
 *
 * @example
 * const cached = await getCompanyFactsFromFirestore('AAPL');
 * if (cached) {
 *   console.log(cached.companyName); // "Apple Inc."
 *   console.log(cached.data); // SEC Company Facts JSON
 *   if (cached.needsRefresh) {
 *     // Data is stale, fetch fresh data
 *   }
 * }
 */
export async function getCompanyFactsFromFirestore(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  try {
    const docRef = doc(db, FIRESTORE_CONFIG.COLLECTION_NAME, normalizedTicker);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      devLog('log', `Cache miss for ${normalizedTicker}`);
      return null;
    }

    const data = docSnap.data();
    const needsRefresh = isStale(data);

    devLog('log', `Cache hit for ${normalizedTicker}`, { needsRefresh });

    // Try to increment access count (may fail due to permissions)
    updateAccessCount(normalizedTicker).catch(() => {
      // Expected to fail on client - Cloud Functions will handle this
      devLog('log', `Access count update skipped for ${normalizedTicker} (expected on client)`);
    });

    // Convert Timestamps to Dates for easier use
    const lastUpdated = data.lastUpdated instanceof Timestamp
      ? data.lastUpdated.toDate()
      : new Date(data.lastUpdated);

    const lastFiling = data.lastFiling instanceof Timestamp
      ? data.lastFiling.toDate()
      : data.lastFiling ? new Date(data.lastFiling) : null;

    return {
      data: data.companyFacts,
      ticker: data.ticker,
      cik: data.cik,
      companyName: data.companyName,
      lastUpdated,
      lastFiling,
      accessCount: data.accessCount || 0,
      needsRefresh,
      version: data.version || 1,
    };
  } catch (error) {
    const errorCode = classifyError(error);

    // Network errors in offline mode - return null gracefully
    if (errorCode === FIRESTORE_CACHE_ERROR_CODES.NETWORK_ERROR) {
      devLog('warn', `Network error reading ${normalizedTicker}, returning null`, error.message);
      return null;
    }

    devLog('error', `Error reading ${normalizedTicker}`, error);
    return null;
  }
}

/**
 * Checks if a ticker exists in the Firestore global cache
 *
 * Fast metadata check without fetching full company facts.
 * Useful for determining cache strategy before expensive operations.
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<{
 *   exists: boolean,
 *   needsRefresh: boolean,
 *   lastUpdated: Date|null,
 *   accessCount: number
 * }>} Cache status metadata
 *
 * @example
 * const status = await checkIfCached('AAPL');
 * if (status.exists && !status.needsRefresh) {
 *   // Use cached data
 * } else {
 *   // Fetch from SEC API
 * }
 */
export async function checkIfCached(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  try {
    const docRef = doc(db, FIRESTORE_CONFIG.COLLECTION_NAME, normalizedTicker);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return {
        exists: false,
        needsRefresh: false,
        lastUpdated: null,
        accessCount: 0,
      };
    }

    const data = docSnap.data();
    const lastUpdated = data.lastUpdated instanceof Timestamp
      ? data.lastUpdated.toDate()
      : data.lastUpdated ? new Date(data.lastUpdated) : null;

    return {
      exists: true,
      needsRefresh: isStale(data),
      lastUpdated,
      accessCount: data.accessCount || 0,
    };
  } catch (error) {
    const errorCode = classifyError(error);

    if (errorCode === FIRESTORE_CACHE_ERROR_CODES.NETWORK_ERROR) {
      devLog('warn', `Network error checking ${normalizedTicker}`, error.message);
    } else {
      devLog('error', `Error checking ${normalizedTicker}`, error);
    }

    // Return safe defaults on error
    return {
      exists: false,
      needsRefresh: false,
      lastUpdated: null,
      accessCount: 0,
    };
  }
}

/**
 * Gets global cache statistics
 *
 * Returns aggregate statistics about the global cache including:
 * - Total number of cached companies
 * - Total access count (cache hits)
 * - Estimated cost savings
 *
 * @returns {Promise<{
 *   totalCompanies: number,
 *   totalAccessCount: number,
 *   estimatedSavings: number,
 *   costPerLookup: number,
 *   isAvailable: boolean
 * }>} Global cache statistics
 *
 * @example
 * const stats = await getGlobalCacheStats();
 * console.log(`Cached ${stats.totalCompanies} companies`);
 * console.log(`Total savings: $${stats.estimatedSavings.toFixed(2)}`);
 */
export async function getGlobalCacheStats() {
  const defaultStats = {
    totalCompanies: 0,
    totalAccessCount: 0,
    estimatedSavings: 0,
    costPerLookup: FIRESTORE_CONFIG.COST_PER_LOOKUP,
    isAvailable: false,
  };

  try {
    const collectionRef = collection(db, FIRESTORE_CONFIG.COLLECTION_NAME);

    // Get total document count
    const countSnapshot = await getCountFromServer(collectionRef);
    const totalCompanies = countSnapshot.data().count;

    // Note: Getting total access count would require aggregating all documents
    // For now, return the count of companies
    // A Cloud Function could maintain a separate stats document for this

    return {
      totalCompanies,
      totalAccessCount: 0, // Would need aggregation query or stats document
      estimatedSavings: 0, // Would need totalAccessCount
      costPerLookup: FIRESTORE_CONFIG.COST_PER_LOOKUP,
      isAvailable: true,
    };
  } catch (error) {
    devLog('error', 'Error getting global cache stats', error);
    return defaultStats;
  }
}

// =============================================================================
// Public API Functions - Write Operations
// (These are for Cloud Functions - client writes will fail due to security rules)
// =============================================================================

/**
 * Saves company facts to Firestore global cache
 *
 * NOTE: This function is intended for use by Cloud Functions.
 * Client-side calls will fail due to Firestore security rules.
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @param {Object} companyFacts - The SEC Company Facts JSON data
 * @param {string} cik - The CIK number (e.g., "0000320193")
 * @param {string} companyName - The company name (e.g., "Apple Inc.")
 * @param {Object} [options] - Optional settings
 * @param {Date} [options.lastFiling] - Date of most recent filing
 * @param {string} [options.userId] - User ID who cached this
 * @returns {Promise<boolean>} True if save was successful
 *
 * @example
 * // This is called by Cloud Functions, not directly by clients
 * await setCompanyFactsToFirestore('AAPL', companyFacts, '0000320193', 'Apple Inc.');
 */
export async function setCompanyFactsToFirestore(ticker, companyFacts, cik, companyName, options = {}) {
  const normalizedTicker = normalizeTicker(ticker);

  const document = {
    ticker: normalizedTicker,
    cik: cik,
    companyName: companyName,
    companyFacts: companyFacts,
    lastUpdated: serverTimestamp(),
    lastFiling: options.lastFiling ? Timestamp.fromDate(options.lastFiling) : null,
    cachedBy: options.userId || getCurrentUserId() || 'anonymous',
    accessCount: 0,
    version: FIRESTORE_CONFIG.SCHEMA_VERSION,
    needsRefresh: false,
  };

  try {
    const docRef = doc(db, FIRESTORE_CONFIG.COLLECTION_NAME, normalizedTicker);
    await setDoc(docRef, document);

    devLog('log', `Saved company facts for ${normalizedTicker}`);
    return true;
  } catch (error) {
    const errorCode = classifyError(error);

    if (errorCode === FIRESTORE_CACHE_ERROR_CODES.PERMISSION_DENIED) {
      // Expected on client - security rules block client writes
      devLog('warn', `Permission denied saving ${normalizedTicker} (expected on client)`);
      return false;
    }

    devLog('error', `Error saving ${normalizedTicker}`, error);
    return false;
  }
}

/**
 * Increments the access count for a cached ticker
 *
 * NOTE: This function is intended for use by Cloud Functions.
 * Client-side calls will fail due to Firestore security rules.
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<boolean>} True if update was successful
 *
 * @example
 * // Called automatically on cache hit, or manually by Cloud Functions
 * await updateAccessCount('AAPL');
 */
export async function updateAccessCount(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  try {
    const docRef = doc(db, FIRESTORE_CONFIG.COLLECTION_NAME, normalizedTicker);
    await updateDoc(docRef, {
      accessCount: increment(1),
    });

    devLog('log', `Updated access count for ${normalizedTicker}`);
    return true;
  } catch (error) {
    const errorCode = classifyError(error);

    if (errorCode === FIRESTORE_CACHE_ERROR_CODES.PERMISSION_DENIED) {
      // Expected on client - silently fail
      return false;
    }

    if (errorCode === FIRESTORE_CACHE_ERROR_CODES.NOT_FOUND) {
      devLog('warn', `Document not found for ${normalizedTicker}`);
      return false;
    }

    devLog('error', `Error updating access count for ${normalizedTicker}`, error);
    return false;
  }
}

/**
 * Marks a cached ticker as needing refresh (invalidation)
 *
 * This is a soft invalidation - data is NOT deleted.
 * Users will see old data while fresh data is fetched.
 *
 * NOTE: This function is intended for use by Cloud Functions
 * (event-triggered invalidation from Sub-task #8).
 *
 * @param {string} ticker - The ticker symbol (e.g., "AAPL")
 * @returns {Promise<boolean>} True if invalidation was successful
 *
 * @example
 * // Called by Cloud Function when new SEC filing detected
 * await invalidateGlobalCache('AAPL');
 */
export async function invalidateGlobalCache(ticker) {
  const normalizedTicker = normalizeTicker(ticker);

  try {
    const docRef = doc(db, FIRESTORE_CONFIG.COLLECTION_NAME, normalizedTicker);
    await updateDoc(docRef, {
      needsRefresh: true,
    });

    devLog('log', `Marked ${normalizedTicker} as needing refresh`);
    return true;
  } catch (error) {
    const errorCode = classifyError(error);

    if (errorCode === FIRESTORE_CACHE_ERROR_CODES.PERMISSION_DENIED) {
      devLog('warn', `Permission denied invalidating ${normalizedTicker} (expected on client)`);
      return false;
    }

    if (errorCode === FIRESTORE_CACHE_ERROR_CODES.NOT_FOUND) {
      devLog('warn', `Document not found for ${normalizedTicker}, nothing to invalidate`);
      return false;
    }

    devLog('error', `Error invalidating ${normalizedTicker}`, error);
    return false;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculates cost savings from cache hits
 *
 * Formula: savings = (accessCount - 1) * $4.27
 * (First access is the cache write, subsequent accesses are savings)
 *
 * @param {number} accessCount - Total number of times cache was accessed
 * @returns {number} Estimated savings in dollars
 *
 * @example
 * const savings = calculateCostSavings(100);
 * console.log(`Saved $${savings.toFixed(2)}`); // "Saved $422.73"
 */
export function calculateCostSavings(accessCount) {
  if (accessCount <= 1) {
    return 0;
  }
  return (accessCount - 1) * FIRESTORE_CONFIG.COST_PER_LOOKUP;
}

/**
 * Gets the configuration values (read-only)
 *
 * @returns {Object} Configuration object
 */
export function getConfig() {
  return { ...FIRESTORE_CONFIG };
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * Firestore Global Cache Service
 * @namespace
 */
export default {
  // Read operations (client-side)
  getCompanyFactsFromFirestore,
  checkIfCached,
  getGlobalCacheStats,

  // Write operations (for Cloud Functions)
  setCompanyFactsToFirestore,
  updateAccessCount,
  invalidateGlobalCache,

  // Utilities
  calculateCostSavings,
  getConfig,

  // Error handling
  FirestoreCacheError,
  FIRESTORE_CACHE_ERROR_CODES,
};
