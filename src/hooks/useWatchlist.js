/**
 * useWatchlist - Hook for managing a localStorage-based watchlist
 *
 * Provides CRUD operations for a watchlist of up to 3 companies.
 * Persists to localStorage with key 'edgar-watchlist'.
 * Gracefully handles private browsing and storage quota errors.
 *
 * @module useWatchlist
 */

import { useState, useCallback } from 'react';

// =============================================================================
// Constants
// =============================================================================

/** localStorage key for watchlist */
const STORAGE_KEY = 'edgar-watchlist';

/** Maximum number of watchlist entries (free tier) */
const MAX_WATCHLIST = 3;

/** Maximum length for stored string fields */
const MAX_STRING_LENGTH = 200;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validates a single watchlist entry shape
 * @param {*} item - The entry to validate
 * @returns {boolean} Whether the entry is valid
 */
function isValidEntry(item) {
  return (
    item &&
    typeof item === 'object' &&
    typeof item.ticker === 'string' &&
    item.ticker.length > 0 &&
    item.ticker.length <= MAX_STRING_LENGTH &&
    typeof item.companyName === 'string' &&
    item.companyName.length <= MAX_STRING_LENGTH &&
    typeof item.addedAt === 'number' &&
    isFinite(item.addedAt)
  );
}

/**
 * Safely reads watchlist from localStorage
 * @returns {Array} Parsed watchlist or empty array
 */
function readFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Validate shape and limit to MAX_WATCHLIST
    return parsed.filter(isValidEntry).slice(0, MAX_WATCHLIST);
  } catch {
    return [];
  }
}

/**
 * Safely writes watchlist to localStorage
 * @param {Array} data - Watchlist array
 * @returns {boolean} Whether the write succeeded
 */
function writeToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // localStorage full or unavailable (private browsing, QuotaExceededError)
    return false;
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Custom hook for managing a watchlist with localStorage persistence
 *
 * @returns {Object} Hook return value
 * @property {Array} watchlist - Array of watchlist entry objects
 * @property {Function} addToWatchlist - Add a company (returns false if full)
 * @property {Function} removeFromWatchlist - Remove a company by ticker
 * @property {Function} isInWatchlist - Check if ticker is in watchlist
 * @property {boolean} isFull - Whether watchlist has reached the limit
 * @property {Function} clearWatchlist - Clear all watchlist entries
 */
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => readFromStorage());

  /**
   * Adds a company to the watchlist
   * Returns false if the watchlist is full or input is invalid.
   * Deduplicates by ticker (case-insensitive). Normalizes ticker to uppercase.
   *
   * @param {string} ticker - Ticker symbol
   * @param {string} companyName - Company name
   * @returns {boolean} Whether the add succeeded
   */
  const addToWatchlist = useCallback((ticker, companyName) => {
    // Validate input
    if (!ticker || typeof ticker !== 'string' || !ticker.trim()) {
      return false;
    }
    if (companyName !== undefined && companyName !== null && typeof companyName !== 'string') {
      return false;
    }

    const normalizedTicker = ticker.trim().toUpperCase();
    const normalizedName = (companyName || '').trim();

    // Use a ref-like pattern to return synchronous result
    let added = false;

    setWatchlist((prev) => {
      // Check if already in watchlist (dedup)
      const exists = prev.some(
        (item) => item.ticker.toUpperCase() === normalizedTicker
      );
      if (exists) {
        added = false;
        return prev;
      }

      // Check if full
      if (prev.length >= MAX_WATCHLIST) {
        added = false;
        return prev;
      }

      // Add new entry
      const updated = [
        ...prev,
        {
          ticker: normalizedTicker,
          companyName: normalizedName,
          addedAt: Date.now(),
        },
      ];

      writeToStorage(updated);
      added = true;
      return updated;
    });

    return added;
  }, []);

  /**
   * Removes a company from the watchlist by ticker
   * No-op for missing tickers.
   *
   * @param {string} ticker - Ticker symbol to remove
   */
  const removeFromWatchlist = useCallback((ticker) => {
    if (!ticker || typeof ticker !== 'string') return;

    const normalizedTicker = ticker.trim().toUpperCase();

    setWatchlist((prev) => {
      const updated = prev.filter(
        (item) => item.ticker.toUpperCase() !== normalizedTicker
      );

      writeToStorage(updated);
      return updated;
    });
  }, []);

  /**
   * Checks if a ticker is in the watchlist (case-insensitive)
   *
   * @param {string} ticker - Ticker symbol to check
   * @returns {boolean} Whether the ticker is in the watchlist
   */
  const isInWatchlist = useCallback(
    (ticker) => {
      if (!ticker || typeof ticker !== 'string') return false;
      const normalizedTicker = ticker.trim().toUpperCase();
      return watchlist.some(
        (item) => item.ticker.toUpperCase() === normalizedTicker
      );
    },
    [watchlist]
  );

  /**
   * Whether the watchlist has reached the maximum capacity
   * @type {boolean}
   */
  const isFull = watchlist.length >= MAX_WATCHLIST;

  /**
   * Clears all watchlist entries and persists
   */
  const clearWatchlist = useCallback(() => {
    setWatchlist([]);
    writeToStorage([]);
  }, []);

  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    isFull,
    clearWatchlist,
  };
}

export default useWatchlist;
