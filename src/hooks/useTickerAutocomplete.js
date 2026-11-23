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
import * as sanitization from '../utils/inputSanitization';

// =============================================================================
// Constants
// =============================================================================

/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 150;

/** Maximum number of suggestions to display */
const MAX_SUGGESTIONS = 8;

/** Minimum query length to trigger autocomplete */
const MIN_QUERY_LENGTH = 1;

/**
 * Scores and ranks ticker entries for a ticker or company-name query.
 * Priority order:
 *  0. Exact ticker match (including dot/hyphen class alias like BRK.B <-> BRK-B)
 *  1. Ticker starts with query
 *  2. Company name starts with query
 *  3. Any word in company name starts with single-token query
 *  4. All space-separated tokens appear in company name / ticker (multi-word search)
 *  5. Substring match in company name
 *
 * @param {Array<{ticker: string, name?: string, cik?: number}>|null} tickerArray
 * @param {string} rawQuery
 * @param {number} [maxSuggestions=8]
 * @returns {Array}
 */
export function scoreTickerMatches(tickerArray, rawQuery, maxSuggestions = MAX_SUGGESTIONS) {
  const trimmed = String(rawQuery || '').trim();
  if (!Array.isArray(tickerArray) || trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const upperQuery = trimmed.toUpperCase();
  const aliasQuery = upperQuery.includes('.')
    ? upperQuery.replace(/\./g, '-')
    : upperQuery.replace(/-/g, '.');
  const lowerQuery = trimmed.toLowerCase();
  const tokens = lowerQuery.split(/\s+/).filter(Boolean);

  const exactMatches = [];
  const prefixMatches = [];
  const namePrefixMatches = [];
  const wordPrefixMatches = [];
  const multiWordMatches = [];
  const substringMatches = [];

  for (let i = 0; i < tickerArray.length; i++) {
    const entry = tickerArray[i];
    if (!entry || !entry.ticker) continue;

    const tickerUpper = entry.ticker.toUpperCase();
    const nameLower = (entry.name || '').toLowerCase();

    if (tickerUpper === upperQuery || tickerUpper === aliasQuery) {
      exactMatches.push(entry);
    } else if (tickerUpper.startsWith(upperQuery)) {
      if (prefixMatches.length < maxSuggestions) {
        prefixMatches.push(entry);
      }
    } else if (nameLower.startsWith(lowerQuery)) {
      if (namePrefixMatches.length < maxSuggestions) {
        namePrefixMatches.push(entry);
      }
    } else if (tokens.length === 1) {
      const words = nameLower.split(/[\s,.\-&/]+/);
      if (words.some((w) => w.startsWith(lowerQuery))) {
        if (wordPrefixMatches.length < maxSuggestions) {
          wordPrefixMatches.push(entry);
        }
      } else if (substringMatches.length < maxSuggestions && nameLower.includes(lowerQuery)) {
        substringMatches.push(entry);
      }
    } else if (tokens.length > 1) {
      const combined = `${tickerUpper.toLowerCase()} ${nameLower}`;
      if (tokens.every((t) => combined.includes(t))) {
        if (multiWordMatches.length < maxSuggestions) {
          multiWordMatches.push(entry);
        }
      }
    }
  }

  return [
    ...exactMatches,
    ...prefixMatches,
    ...namePrefixMatches,
    ...wordPrefixMatches,
    ...multiWordMatches,
    ...substringMatches,
  ].slice(0, maxSuggestions);
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Custom hook for ticker & company-name autocomplete functionality
 *
 * @returns {Object} Hook return value
 */
export function useTickerAutocomplete() {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQueryState] = useState('');

  // Refs for debounce and ticker data
  const tickerMapRef = useRef(null);
  const tickerArrayRef = useRef(null);
  const inFlightLoadRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isMountedRef = useRef(true);

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
   * Loads the ticker data lazily (called on first focus or Submit resolution)
   * @returns {Promise<Array|null>}
   */
  const loadTickers = useCallback(async () => {
    if (tickerArrayRef.current) {
      return tickerArrayRef.current;
    }
    if (inFlightLoadRef.current) {
      return inFlightLoadRef.current;
    }

    setIsLoading(true);
    setLoadError(false);

    const loadPromise = (async () => {
      try {
        const tickerMap = await fetchCompanyTickers();

        tickerMapRef.current = tickerMap;
        tickerArrayRef.current = Object.values(tickerMap).sort((a, b) =>
          a.ticker.localeCompare(b.ticker)
        );

        if (isMountedRef.current) {
          setIsReady(true);
          setLoadError(false);
        }
        return tickerArrayRef.current;
      } catch {
        tickerMapRef.current = null;
        tickerArrayRef.current = null;
        if (isMountedRef.current) {
          setLoadError(true);
        }
        return null;
      } finally {
        inFlightLoadRef.current = null;
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    })();

    inFlightLoadRef.current = loadPromise;
    return loadPromise;
  }, []);

  /**
   * Filters the ticker array based on the query synchronously
   */
  const filterTickers = useCallback((searchQuery, limit = MAX_SUGGESTIONS) => {
    return scoreTickerMatches(tickerArrayRef.current, searchQuery, limit);
  }, []);

  /**
   * Resolves a typed query synchronously against cached tickers without triggering network calls
   */
  const resolveQuerySync = useCallback((rawQuery) => {
    const trimmed = String(rawQuery || '').trim();
    if (!trimmed || !tickerArrayRef.current) {
      return { exactTickerMatch: null, bestMatch: null, matches: [] };
    }
    const upper = trimmed.toUpperCase();
    const alias = upper.includes('.') ? upper.replace(/\./g, '-') : upper.replace(/-/g, '.');
    const matches = scoreTickerMatches(tickerArrayRef.current, trimmed, 5);
    const exactTickerMatch =
      matches.find((m) => {
        const t = m.ticker.toUpperCase();
        return t === upper || t === alias;
      }) || null;
    return {
      exactTickerMatch,
      bestMatch: matches[0] || null,
      matches,
    };
  }, []);

  /**
   * Ensures tickers are loaded and resolves a query (ticker or company name) to matches
   */
  const resolveQuery = useCallback(async (rawQuery) => {
    const trimmed = String(rawQuery || '').trim();
    if (!trimmed) {
      return { exactTickerMatch: null, bestMatch: null, matches: [], loadFailed: false };
    }

    const loaded = tickerArrayRef.current ?? (await loadTickers());
    if (!loaded) {
      return { exactTickerMatch: null, bestMatch: null, matches: [], loadFailed: true };
    }

    const { exactTickerMatch, bestMatch, matches } = resolveQuerySync(trimmed);
    return { exactTickerMatch, bestMatch, matches, loadFailed: false };
  }, [loadTickers, resolveQuerySync]);

  /**
   * Updates the query and triggers debounced filtering
   */
  const setQuery = useCallback((rawInput) => {
    const sanitizeFn = sanitization.sanitizeSearchQuery || sanitization.sanitizeTickerInput;
    const { sanitized } = sanitizeFn(rawInput);
    const cleanQuery = sanitized.toUpperCase();

    setQueryState(cleanQuery);

    // Clear previous debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Clear suggestions if query is empty
    if (cleanQuery.trim().length < MIN_QUERY_LENGTH) {
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
    loadError,
    query,
    setQuery,
    loadTickers,
    clearSuggestions,
    resolveQuery,
    resolveQuerySync,
  };
}

export default useTickerAutocomplete;
