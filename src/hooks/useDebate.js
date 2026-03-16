/**
 * useDebate — React hook for fetching and managing Bull vs Bear debate data.
 *
 * Features:
 * - Automatic fetch on mount / ticker change
 * - Caches debate in React state — re-renders do not re-fetch
 * - Stale-request protection (fetch ID counter)
 * - Rate limit state with detailed rateLimitInfo
 * - User-friendly error messages
 * - refresh() for manual re-fetch (e.g., user wants fresh generation)
 * - Cleanup on unmount (no state updates after unmount)
 *
 * @module useDebate
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDebate } from '../services/debateApi';
import { useAuth } from './useAuth';

// =============================================================================
// Hook
// =============================================================================

/**
 * Fetches and manages the Bull vs Bear debate for a given ticker.
 *
 * States: idle → loading → success | error | rateLimited
 *
 * @param {string|null|undefined} ticker - Stock ticker symbol (e.g. "AAPL")
 * @returns {{
 *   debate: import('../services/debateApi').DebateResponse | null,
 *   loading: boolean,
 *   error: string | null,
 *   isRateLimited: boolean,
 *   rateLimitInfo: { currentCount: number, maxCount: number, upgradeUrl: string } | null,
 *   refresh: () => void
 * }}
 *
 * @example
 * function DebatePanel({ ticker }) {
 *   const { debate, loading, error, isRateLimited, rateLimitInfo, refresh } = useDebate(ticker);
 *
 *   if (loading) return <Spinner />;
 *   if (isRateLimited) return <UpgradePrompt info={rateLimitInfo} />;
 *   if (error) return <ErrorMsg message={error} onRetry={refresh} />;
 *   if (!debate) return null;
 *
 *   return <DebateView debate={debate} />;
 * }
 */
export function useDebate(ticker) {
  // ---------------------------------------------------------------------------
  // Auth context — kept for tier awareness; callers and refresh guard can
  // extend this to gate generation based on authentication status.
  // ---------------------------------------------------------------------------
  useAuth();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  /** Prevents state updates after unmount */
  const isMountedRef = useRef(true);

  /**
   * Monotonically increasing counter — each new fetch call increments this.
   * A response whose fetchId < current is stale and must be ignored.
   */
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
  // Core fetch logic
  // ---------------------------------------------------------------------------
  const fetchDebate = useCallback(async (tickerToFetch) => {
    if (!tickerToFetch || !tickerToFetch.trim()) return;

    const currentFetchId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);
    setIsRateLimited(false);
    setRateLimitInfo(null);

    try {
      const result = await getDebate(tickerToFetch);

      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) return;

      setDebate(result);
      setError(null);
      setIsRateLimited(false);
      setRateLimitInfo(null);
    } catch (err) {
      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) return;

      setDebate(null);

      if (err?.code === 'rate-limited') {
        setIsRateLimited(true);
        setRateLimitInfo(err.rateLimitInfo ?? null);
        setError(err.message ?? 'You have reached your debate generation limit.');
      } else {
        setIsRateLimited(false);
        setRateLimitInfo(null);
        setError(
          err?.message ?? 'An unexpected error occurred. Please try again.'
        );
      }
    } finally {
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
      // Reset to idle when ticker becomes empty/null
      setDebate(null);
      setLoading(false);
      setError(null);
      setIsRateLimited(false);
      setRateLimitInfo(null);
      return;
    }

    fetchDebate(ticker);
  }, [ticker, fetchDebate]);

  // ---------------------------------------------------------------------------
  // Manual refresh
  // ---------------------------------------------------------------------------
  const refresh = useCallback(() => {
    if (!ticker || !ticker.trim()) return;
    fetchDebate(ticker);
  }, [ticker, fetchDebate]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    debate,
    loading,
    error,
    isRateLimited,
    rateLimitInfo,
    refresh,
  };
}

export default useDebate;
