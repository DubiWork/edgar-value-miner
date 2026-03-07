/**
 * useTickerAutocomplete - Hook for ticker symbol autocomplete
 *
 * Provides debounced, client-side filtering of SEC company tickers
 * for autocomplete suggestions. Loads ticker data lazily on first focus.
 *
 * @module useTickerAutocomplete
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchCompanyTickers } from '../services/edgarApi';
import { sanitizeTickerInput } from '../utils/inputSanitization';

// =============================================================================
// Constants
// =============================================================================

/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 150;

/** Maximum number of suggestions to display */
const MAX_SUGGESTIONS = 8;

/** Minimum query length to trigger autocomplete */
const MIN_QUERY_LENGTH = 1;

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Custom hook for ticker autocomplete functionality
 *
 * @returns {Object} Hook return value
 * @property {Array} suggestions - Filtered autocomplete suggestions
 * @property {boolean} isLoading - Whether the ticker list is loading
 * @property {boolean} isReady - Whether the ticker list has been loaded
 * @property {string} query - Current sanitized query string
 * @property {Function} setQuery - Update the query and trigger filtering
 * @property {Function} loadTickers - Trigger lazy loading of ticker data
 * @property {Function} clearSuggestions - Clear the suggestions list
 */
export function useTickerAutocomplete() {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [query, setQueryState] = useState('');

  // Refs for debounce and ticker data
  const tickerMapRef = useRef(null);
  const tickerArrayRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Loads the ticker data lazily (called on first focus)
   */
  const loadTickers = useCallback(async () => {
    // Already loaded or loading (ref-based guard prevents concurrent fetches)
    if (tickerMapRef.current || isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);

    try {
      const tickerMap = await fetchCompanyTickers();

      if (!isMountedRef.current) return;

      tickerMapRef.current = tickerMap;

      // Pre-compute sorted array for efficient filtering
      tickerArrayRef.current = Object.values(tickerMap).sort((a, b) =>
        a.ticker.localeCompare(b.ticker)
      );

      setIsReady(true);
    } catch {
      // Autocomplete fails gracefully - manual search still works
      if (isMountedRef.current) {
        tickerMapRef.current = null;
        tickerArrayRef.current = null;
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, []);

  /**
   * Filters the ticker array based on the query
   * Matches: ticker prefix AND company name substring (case-insensitive)
   * Exact ticker matches are prioritized first
   */
  const filterTickers = useCallback((searchQuery) => {
    if (!tickerArrayRef.current || searchQuery.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const upperQuery = searchQuery.toUpperCase();
    const lowerQuery = searchQuery.toLowerCase();

    const exactMatches = [];
    const prefixMatches = [];
    const nameMatches = [];

    for (let i = 0; i < tickerArrayRef.current.length; i++) {
      const entry = tickerArrayRef.current[i];

      // Exact ticker match
      if (entry.ticker === upperQuery) {
        exactMatches.push(entry);
      }
      // Ticker prefix match
      else if (entry.ticker.startsWith(upperQuery)) {
        prefixMatches.push(entry);
      }
      // Company name substring match (case-insensitive)
      else if ((entry.name || '').toLowerCase().includes(lowerQuery)) {
        nameMatches.push(entry);
      }

      // Early exit once we have enough results across all categories
      if (exactMatches.length + prefixMatches.length + nameMatches.length >= MAX_SUGGESTIONS * 2) {
        break;
      }
    }

    // Combine: exact first, then prefix, then name matches
    return [...exactMatches, ...prefixMatches, ...nameMatches].slice(0, MAX_SUGGESTIONS);
  }, []);

  /**
   * Updates the query and triggers debounced filtering
   */
  const setQuery = useCallback((rawInput) => {
    // Sanitize input
    const { sanitized } = sanitizeTickerInput(rawInput);
    const cleanQuery = sanitized.toUpperCase();

    setQueryState(cleanQuery);

    // Clear previous debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Clear suggestions if query is too short
    if (cleanQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }

    // Debounced filtering
    debounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        const results = filterTickers(cleanQuery);
        setSuggestions(results);
      }
    }, DEBOUNCE_MS);
  }, [filterTickers]);

  /**
   * Clears the suggestions list
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    isReady,
    query,
    setQuery,
    loadTickers,
    clearSuggestions,
  };
}

export default useTickerAutocomplete;
