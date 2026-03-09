/**
 * useStockQuote - Hook for fetching stock quote data from FMP API.
 *
 * Wraps the getStockQuote service with React state management,
 * automatic cleanup on ticker change or unmount, and a manual
 * refetch callback.
 *
 * @module useStockQuote
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getStockQuote } from '../services/fmpApi';

// =============================================================================
// Hook
// =============================================================================

/**
 * Fetches and manages stock quote data for a given ticker.
 *
 * @param {string|null|undefined} ticker - Stock ticker symbol (e.g., "AAPL")
 * @returns {{
 *   data: { price: number, eps: number, pe: number, marketCap: number, sharesOutstanding: number, changesPercentage: number, name: string } | null,
 *   loading: boolean,
 *   error: string | null,
 *   refetch: () => void
 * }}
 *
 * @example
 * function StockPrice({ ticker }) {
 *   const { data, loading, error, refetch } = useStockQuote(ticker);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMsg message={error} onRetry={refetch} />;
 *   if (!data) return null;
 *
 *   return <span>${data.price}</span>;
 * }
 */
export function useStockQuote(ticker) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /** Tracks whether the component is still mounted */
  const isMountedRef = useRef(true);

  /** Counter to detect stale responses when ticker changes mid-flight */
  const fetchIdRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch logic
  // ---------------------------------------------------------------------------

  const fetchQuote = useCallback(async (tickerToFetch) => {
    // Skip fetch for empty/null/undefined/whitespace tickers
    if (!tickerToFetch || !tickerToFetch.trim()) {
      return;
    }

    // Increment fetch ID so previous in-flight requests become stale
    const currentFetchId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const result = await getStockQuote(tickerToFetch);

      // Ignore if component unmounted or a newer fetch was initiated
      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) {
        return;
      }

      if (result === null || result === undefined) {
        setData(null);
        setError(`No quote data available for ${tickerToFetch}`);
      } else {
        setData(result);
        setError(null);
      }
    } catch (err) {
      // Ignore if component unmounted or a newer fetch was initiated
      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) {
        return;
      }

      setData(null);
      setError(`Failed to fetch stock quote for ${tickerToFetch}: ${err.message}`);
    } finally {
      // Only clear loading if this is still the active fetch
      if (isMountedRef.current && currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-fetch on mount / ticker change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!ticker || !ticker.trim()) {
      // Reset state when ticker becomes empty/null
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    fetchQuote(ticker);
  }, [ticker, fetchQuote]);

  // ---------------------------------------------------------------------------
  // Manual refetch
  // ---------------------------------------------------------------------------

  const refetch = useCallback(() => {
    if (!ticker || !ticker.trim()) {
      return;
    }
    fetchQuote(ticker);
  }, [ticker, fetchQuote]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return { data, loading, error, refetch };
}

export default useStockQuote;
