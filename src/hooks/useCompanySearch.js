/**
 * useCompanySearch - Custom React Hook for Company Data Fetching
 *
 * Provides a clean interface for fetching company data using the hybrid
 * caching system (IndexedDB → Firestore → SEC API).
 *
 * Features:
 * - Automatic request cancellation (handles concurrent searches)
 * - Duplicate request prevention
 * - Cache metadata exposure
 * - Error categorization
 * - Data normalization with GAAP tags
 *
 * @module useCompanySearch
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import cacheCoordinator from '../services/cacheCoordinator';
import gaapNormalizer from '../utils/gaapNormalizer';
import { categorizeError, ERROR_TYPES } from '../components/errorTypes';

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * @typedef {Object} CompanyData
 * @property {string} ticker - Stock ticker symbol
 * @property {string} cik - SEC Central Index Key
 * @property {string} companyName - Official company name
 * @property {Object} metrics - Normalized financial metrics
 * @property {Object} metadata - Normalization metadata
 */

/**
 * @typedef {Object} CacheMetadata
 * @property {string} source - Data source: 'indexeddb', 'firestore', 'sec-api'
 * @property {boolean} cacheHit - Whether data came from cache
 * @property {boolean} needsRefresh - Whether cached data is stale
 * @property {Date|null} lastUpdated - Last update timestamp
 * @property {number} costSaved - Estimated cost saved by using cache ($)
 */

/**
 * @typedef {Object} SearchOptions
 * @property {boolean} [forceRefresh=false] - Skip caches, fetch from SEC
 * @property {boolean} [backgroundRefresh=false] - Fire-and-forget refresh
 * @property {boolean} [includeMetadata=true] - Return cache metadata
 */

/**
 * @typedef {Object} UseCompanySearchReturn
 * @property {CompanyData|null} data - Normalized company data
 * @property {boolean} loading - Is fetch in progress
 * @property {Object|null} error - Error object with type and message
 * @property {CacheMetadata|null} metadata - Cache metadata
 * @property {(ticker: string, options?: SearchOptions) => Promise<void>} searchCompany - Search function
 * @property {() => void} clearError - Clear error state
 * @property {() => void} reset - Reset all state
 */

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Custom hook for searching and fetching company data
 *
 * @returns {UseCompanySearchReturn} Hook return value
 *
 * @example
 * function CompanySearch() {
 *   const { data, loading, error, metadata, searchCompany } = useCompanySearch();
 *
 *   const handleSearch = async (ticker) => {
 *     await searchCompany(ticker, { includeMetadata: true });
 *   };
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!data) return <SearchPrompt />;
 *
 *   return <CompanyDashboard data={data} metadata={metadata} />;
 * }
 */
export function useCompanySearch() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // ---------------------------------------------------------------------------
  // Refs for Cancellation & Deduplication
  // ---------------------------------------------------------------------------

  /**
   * Stores the AbortController for the current request
   * Used to cancel in-flight requests when a new search is initiated
   * @type {React.MutableRefObject<AbortController|null>}
   */
  const abortControllerRef = useRef(null);

  /**
   * Tracks the last searched ticker to prevent duplicate requests
   * @type {React.MutableRefObject<string|null>}
   */
  const lastSearchedTickerRef = useRef(null);

  /**
   * Tracks if component is mounted (prevents state updates after unmount)
   * @type {React.MutableRefObject<boolean>}
   */
  const isMountedRef = useRef(true);

  /**
   * Mirrors the loading state so searchCompany can read the current value
   * without capturing a stale closure. Updated in sync with every setLoading call.
   * @type {React.MutableRefObject<boolean>}
   */
  const loadingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Cleanup on Unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      // Cancel any in-flight requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isMountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Helper Functions
  // ---------------------------------------------------------------------------

  /**
   * Creates a categorized error object with type information
   * @param {Error} err - Original error
   * @param {string} ticker - Ticker that caused the error
   * @returns {Object} Categorized error object
   * @private
   */
  const createCategorizedError = useCallback((err, ticker) => {
    const errorType = categorizeError(err);

    return {
      type: errorType,
      message: err.message || 'An unexpected error occurred',
      ticker,
      originalError: err,
      // Provide user-friendly messages based on error type
      userMessage: getUserFriendlyMessage(errorType, ticker),
      // Determine if error is retryable
      retryable: isRetryableError(errorType),
    };
  }, []);

  /**
   * Gets user-friendly error message based on error type
   * @param {string} errorType - Error type from ERROR_TYPES
   * @param {string} ticker - Ticker symbol
   * @returns {string}
   * @private
   */
  const getUserFriendlyMessage = (errorType, ticker) => {
    switch (errorType) {
      case ERROR_TYPES.NETWORK:
        return 'Unable to connect to SEC EDGAR service. Please check your internet connection.';
      case ERROR_TYPES.DATA:
        return `No data found for ticker "${ticker}". Please verify the ticker symbol is correct.`;
      case ERROR_TYPES.CACHE:
        return 'Storage access error. This may happen in private browsing mode.';
      case ERROR_TYPES.RATE_LIMIT:
        return 'SEC API rate limit reached. Please wait a moment before trying again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  /**
   * Determines if an error type is retryable
   * @param {string} errorType - Error type from ERROR_TYPES
   * @returns {boolean}
   * @private
   */
  const isRetryableError = (errorType) => {
    // All error types are retryable except DATA (invalid ticker)
    return errorType !== ERROR_TYPES.DATA;
  };

  // ---------------------------------------------------------------------------
  // Main Search Function
  // ---------------------------------------------------------------------------

  /**
   * Searches for company data by ticker symbol
   *
   * Handles:
   * - Request cancellation (aborts previous in-flight request)
   * - Duplicate prevention (skips if same ticker is already loading)
   * - Cache coordination (L1 → L2 → L3)
   * - Data normalization (GAAP tag mapping)
   * - Error categorization
   *
   * @param {string} ticker - Stock ticker symbol (e.g., "AAPL")
   * @param {SearchOptions} [options={}] - Search options
   * @returns {Promise<void>}
   *
   * @example
   * // Basic search
   * await searchCompany('AAPL');
   *
   * @example
   * // Force fresh data from SEC (skip caches)
   * await searchCompany('MSFT', { forceRefresh: true });
   *
   * @example
   * // Get cache metadata
   * await searchCompany('GOOGL', { includeMetadata: true });
   */
  const searchCompany = useCallback(async (ticker, options = {}) => {
    // Validate input
    if (!ticker || typeof ticker !== 'string') {
      const validationError = {
        type: ERROR_TYPES.DATA,
        message: 'Ticker symbol is required',
        ticker: ticker || '',
        userMessage: 'Please enter a valid ticker symbol.',
        retryable: false,
      };
      setError(validationError);
      return;
    }

    const normalizedTicker = ticker.trim().toUpperCase();

    // Prevent duplicate requests for the same ticker.
    // Use loadingRef instead of the loading state variable to avoid reading
    // a stale closure value (loading is not in the useCallback deps array).
    if (
      loadingRef.current &&
      lastSearchedTickerRef.current === normalizedTicker &&
      !options.forceRefresh
    ) {
      console.log(`[useCompanySearch] Skipping duplicate request for ${normalizedTicker}`);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    lastSearchedTickerRef.current = normalizedTicker;

    // Clear previous error
    setError(null);
    loadingRef.current = true;
    setLoading(true);

    // Announce to screen readers (accessibility)
    announceToScreenReader(`Searching for ${normalizedTicker}`);

    try {
      // Fetch company data from cache coordinator
      const result = await cacheCoordinator.getCompanyData(
        normalizedTicker,
        {
          forceRefresh: options.forceRefresh || false,
          backgroundRefresh: options.backgroundRefresh !== false, // Default true
          includeMetadata: options.includeMetadata !== false, // Default true
        }
      );

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        console.log(`[useCompanySearch] Request aborted for ${normalizedTicker}`);
        return;
      }

      // Handle fetch failure
      if (!result.success || !result.data) {
        throw new Error(
          result.error?.message || 'Failed to fetch company data'
        );
      }

      // Normalize the company facts
      const normalizedData = gaapNormalizer.normalizeCompanyFacts(
        result.data.companyFacts
      );

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        // Merge cache metadata with normalized data
        const enhancedData = {
          ...normalizedData,
          ticker: result.data.ticker,
          cik: result.data.cik,
          companyName: result.data.companyName,
        };

        setData(enhancedData);
        setMetadata(result.metadata || null);
        loadingRef.current = false;
        setLoading(false);
        setError(null);

        // Announce success to screen readers
        announceToScreenReader(
          `Data loaded for ${enhancedData.companyName}`
        );
      }
    } catch (err) {
      // Don't update state if request was aborted
      if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        console.log(`[useCompanySearch] Request aborted for ${normalizedTicker}`);
        return;
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        const categorizedError = createCategorizedError(err, normalizedTicker);
        setError(categorizedError);
        loadingRef.current = false;
        setLoading(false);
        setData(null);
        setMetadata(null);

        // Announce error to screen readers
        announceToScreenReader(
          `Error: ${categorizedError.userMessage}`
        );

        // Log to console in development
        if (import.meta.env.DEV) {
          console.error('[useCompanySearch] Error:', categorizedError);
        }
      }
    }
  }, [createCategorizedError]);

  // ---------------------------------------------------------------------------
  // Utility Functions
  // ---------------------------------------------------------------------------

  /**
   * Clears the current error state
   * Useful for retry functionality
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Resets all state to initial values
   * Useful for clearing search results
   */
  const reset = useCallback(() => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setData(null);
    loadingRef.current = false;
    setLoading(false);
    setError(null);
    setMetadata(null);
    lastSearchedTickerRef.current = null;
  }, []);

  // ---------------------------------------------------------------------------
  // Return Hook Interface
  // ---------------------------------------------------------------------------

  return {
    data,
    loading,
    error,
    metadata,
    searchCompany,
    clearError,
    reset,
  };
}

// =============================================================================
// Accessibility Helpers
// =============================================================================

/**
 * Announces a message to screen readers using ARIA live region
 * @param {string} message - Message to announce
 * @private
 */
function announceToScreenReader(message) {
  // Find or create ARIA live region
  let liveRegion = document.getElementById('company-search-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'company-search-live-region';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only'; // Visually hidden but accessible
    document.body.appendChild(liveRegion);
  }

  // Update the message
  liveRegion.textContent = message;
}

// =============================================================================
// Default Export
// =============================================================================

export default useCompanySearch;
