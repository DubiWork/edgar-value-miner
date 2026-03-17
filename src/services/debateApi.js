/**
 * debateApi — Frontend service for the getOrGenerateDebate Cloud Function.
 *
 * Provides typed wrappers around Firebase httpsCallable that:
 * - Map raw CF responses to typed DebateResponse objects
 * - Map CF errors and rate-limit payloads to user-friendly DebateApiError instances
 * - Normalize tickers to uppercase before calling
 *
 * @module debateApi
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../lib/firebase';

// =============================================================================
// Error Class
// =============================================================================

/**
 * Structured error thrown by debateApi functions.
 *
 * @property {string} code       - Machine-readable error code
 * @property {boolean} retryable - Whether the caller should offer a retry
 * @property {RateLimitInfo|null} rateLimitInfo - Populated only for 'rate-limited' errors
 */
export class DebateApiError extends Error {
  /**
   * @param {string} message - User-friendly message
   * @param {string} code - Error code: 'network' | 'auth' | 'rate-limited' | 'internal' | 'unknown'
   * @param {boolean} retryable
   * @param {RateLimitInfo|null} [rateLimitInfo]
   */
  constructor(message, code, retryable, rateLimitInfo = null) {
    super(message);
    this.name = 'DebateApiError';
    this.code = code;
    this.retryable = retryable;
    this.rateLimitInfo = rateLimitInfo;
  }
}

// =============================================================================
// Error mapping helpers
// =============================================================================

/**
 * Maps a Firebase httpsCallable thrown error to a DebateApiError.
 * @param {unknown} err
 * @returns {DebateApiError}
 */
function mapFirebaseError(err) {
  if (err instanceof DebateApiError) return err;

  const code = err?.code ?? '';
  const message = err instanceof Error ? err.message : String(err);

  // Firebase unauthenticated
  if (code === 'unauthenticated' || message.toLowerCase().includes('unauthenticated')) {
    return new DebateApiError(
      'You must sign in to generate a new debate.',
      'auth',
      false
    );
  }

  // Firebase permission-denied
  if (code === 'permission-denied') {
    return new DebateApiError(
      'You do not have permission to perform this action.',
      'auth',
      false
    );
  }

  // Network-level errors (no code, typical fetch failures)
  if (!code || code === 'unavailable' || code === 'deadline-exceeded') {
    return new DebateApiError(
      'Unable to connect. Check your internet connection and try again.',
      'network',
      true
    );
  }

  return new DebateApiError(
    'An unexpected error occurred. Please try again.',
    'unknown',
    true
  );
}

/**
 * Checks whether a CF response payload contains an inline error object.
 * The getOrGenerateDebate CF returns structured errors (not HttpsErrors) for
 * rate limits and internal failures.
 *
 * @param {unknown} data - The `.data` field of the httpsCallable result
 * @returns {boolean}
 */
function isErrorPayload(data) {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.error === 'object' &&
    data.error !== null &&
    typeof data.error.code === 'string'
  );
}

/**
 * Converts an inline error payload (from CF response) to a DebateApiError.
 * @param {{ code: string, message: string, retryable: boolean, currentCount?: number, maxCount?: number, upgradeUrl?: string }} errorPayload
 * @returns {DebateApiError}
 */
function mapInlineError(errorPayload) {
  if (errorPayload.code === 'rate-limited') {
    return new DebateApiError(
      'You have reached your debate generation limit. Upgrade to generate more.',
      'rate-limited',
      false,
      {
        currentCount: errorPayload.currentCount,
        maxCount: errorPayload.maxCount,
        upgradeUrl: errorPayload.upgradeUrl,
      }
    );
  }

  if (errorPayload.code === 'unauthenticated') {
    return new DebateApiError(
      'You must sign in to generate a new debate.',
      'auth',
      false
    );
  }

  return new DebateApiError(
    'An unexpected error occurred. Please try again.',
    'internal',
    errorPayload.retryable ?? true
  );
}

// =============================================================================
// Lazy function instances (created once, reused)
// =============================================================================

let _functions = null;
let _getOrGenerateDebateFn = null;
let _submitFeedbackFn = null;

function getOrGenerateDebateFn() {
  if (!_getOrGenerateDebateFn) {
    _functions = _functions ?? getFunctions(app);
    _getOrGenerateDebateFn = httpsCallable(_functions, 'getOrGenerateDebate');
  }
  return _getOrGenerateDebateFn;
}

function submitFeedbackFn() {
  if (!_submitFeedbackFn) {
    _functions = _functions ?? getFunctions(app);
    _submitFeedbackFn = httpsCallable(_functions, 'submitFeedback');
  }
  return _submitFeedbackFn;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Fetches (or generates) the Bull vs Bear debate for a given ticker.
 *
 * @param {string} ticker - Stock ticker symbol (e.g., "AAPL")
 * @returns {Promise<DebateResponse>} Typed debate response
 * @throws {DebateApiError} On network errors, auth errors, or rate limits
 *
 * @example
 * const debate = await getDebate('AAPL');
 * console.log(debate.bullCase.arguments[0].title);
 */
export async function getDebate(ticker) {
  const normalizedTicker = ticker.trim().toUpperCase();

  let result;
  try {
    result = await getOrGenerateDebateFn()({ ticker: normalizedTicker });
  } catch (err) {
    throw mapFirebaseError(err);
  }

  // CF may return a structured error payload instead of throwing
  if (isErrorPayload(result.data)) {
    throw mapInlineError(result.data.error);
  }

  return result.data;
}

/**
 * Submits user feedback (rating) for a specific section of a debate.
 *
 * @param {string} debateId - The debate document ID
 * @param {'bullCase'|'bearCase'|'synthesis'} section - Which section was rated
 * @param {'up'|'down'} rating - Thumbs up or down
 * @returns {Promise<{ success: boolean }>}
 * @throws {DebateApiError} On network errors or auth errors
 *
 * @example
 * await submitFeedback('AAPL_v1', 'bullCase', 'up');
 */
export async function submitFeedback(debateId, section, rating) {
  let result;
  try {
    result = await submitFeedbackFn()({ debateId, section, rating });
  } catch (err) {
    throw mapFirebaseError(err);
  }

  return result.data;
}
