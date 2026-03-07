/**
 * useRecentSearches - Hook for managing recent search history
 *
 * Persists recent ticker searches in localStorage with FIFO eviction.
 * Gracefully handles private browsing and storage quota errors.
 *
 * @module useRecentSearches
 */

import { useState, useCallback } from 'react';

// =============================================================================
// Constants
// =============================================================================

/** localStorage key for recent searches */
const STORAGE_KEY = 'edgar-recent-searches';

/** Maximum number of recent searches to store */
const MAX_RECENT = 5;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Safely reads from localStorage
 * @returns {Array} Parsed recent searches or empty array
 */
function readFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Validate shape of entries
    return parsed.filter(
      (item) =>
        item &&
        typeof item.ticker === 'string' &&
        typeof item.companyName === 'string' &&
        typeof item.timestamp === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Safely writes to localStorage
 * @param {Array} data - Recent searches array
 * @returns {boolean} Whether the write succeeded
 */
function writeToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // localStorage full or unavailable (private browsing)
    return false;
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Custom hook for managing recent search history
 *
 * @returns {Object} Hook return value
 * @property {Array} recentSearches - Array of recent search objects
 * @property {Function} addRecentSearch - Add a search to history
 * @property {Function} removeRecentSearch - Remove a specific search by ticker
 * @property {Function} clearRecentSearches - Clear all recent searches
 */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState(() => readFromStorage());

  /**
   * Adds a search to recent history
   * Deduplicates by ticker (moves existing to front), enforces max limit
   *
   * @param {string} ticker - Ticker symbol
   * @param {string} companyName - Company name
   */
  const addRecentSearch = useCallback((ticker, companyName) => {
    if (!ticker || typeof ticker !== 'string') return;

    const normalizedTicker = ticker.trim().toUpperCase();
    const normalizedName = companyName || '';

    setRecentSearches((prev) => {
      // Remove existing entry for this ticker (deduplicate)
      const filtered = prev.filter(
        (item) => item.ticker !== normalizedTicker
      );

      // Add new entry at the beginning
      const updated = [
        {
          ticker: normalizedTicker,
          companyName: normalizedName,
          timestamp: Date.now(),
        },
        ...filtered,
      ].slice(0, MAX_RECENT);

      // Persist to localStorage
      writeToStorage(updated);

      return updated;
    });
  }, []);

  /**
   * Removes a specific search from history by ticker
   *
   * @param {string} ticker - Ticker symbol to remove
   */
  const removeRecentSearch = useCallback((ticker) => {
    if (!ticker) return;

    const normalizedTicker = ticker.trim().toUpperCase();

    setRecentSearches((prev) => {
      const updated = prev.filter(
        (item) => item.ticker !== normalizedTicker
      );

      writeToStorage(updated);

      return updated;
    });
  }, []);

  /**
   * Clears all recent searches
   */
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    writeToStorage([]);
  }, []);

  return {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
}

export default useRecentSearches;
