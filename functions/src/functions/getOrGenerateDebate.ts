import * as functions from 'firebase-functions';
import { DebateService } from '../services/debate/debateService.js';
import type { DebateRequest, DebateError } from '../services/debate/types.js';

const TICKER_REGEX = /^[A-Z]{1,5}$/;

function makeError(code: string, message: string, retryable: boolean): DebateError {
  return { error: { code, message, retryable } };
}

function isStructuredError(err: unknown): err is { code: string; retryable: boolean } {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as Record<string, unknown>)['code'] === 'string'
  );
}

function isRateLimitError(
  err: unknown
): err is { code: string; currentCount: number; maxCount: number; upgradeUrl: string } {
  return (
    isStructuredError(err) &&
    (err as Record<string, unknown>)['code'] === 'rate-limited' &&
    typeof (err as Record<string, unknown>)['currentCount'] === 'number' &&
    typeof (err as Record<string, unknown>)['maxCount'] === 'number' &&
    typeof (err as Record<string, unknown>)['upgradeUrl'] === 'string'
  );
}

/**
 * Validate and normalise the raw request data from the client.
 * Returns a validated { ticker, companyName } or throws an HttpsError.
 */
function parseRequest(data: unknown): { ticker: string; companyName: string } {
  if (typeof data !== 'object' || data === null) {
    throw new functions.https.HttpsError('invalid-argument', 'Request data must be an object.');
  }

  const req = data as Partial<DebateRequest>;
  const rawTicker = req.ticker;

  if (typeof rawTicker !== 'string' || rawTicker.trim() === '') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required parameter: ticker (string).'
    );
  }

  const ticker = rawTicker.trim().toUpperCase();

  if (!TICKER_REGEX.test(ticker)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid ticker format: "${ticker}". Must be 1–5 uppercase letters.`
    );
  }

  const companyName =
    typeof req.companyName === 'string' && req.companyName.trim() !== ''
      ? req.companyName.trim()
      : ticker; // fall back to ticker when company name is unknown

  return { ticker, companyName };
}

/** Minimal shape of the v2 CallableRequest that the handler needs. */
interface CallableRequestLike {
  data: unknown;
  auth?: { uid: string } | undefined;
}

export const getOrGenerateDebateHandler = async (
  request: CallableRequestLike
): Promise<unknown> => {
  const { ticker, companyName } = parseRequest(request.data);

  const caller = {
    uid: request.auth?.uid ?? null,
    isAuthenticated: request.auth !== undefined,
  };

  const service = new DebateService();

  try {
    const result = await service.getOrGenerate(ticker, companyName, caller);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (isRateLimitError(err)) {
      return {
        error: {
          code: 'rate-limited',
          message,
          retryable: false,
          currentCount: err.currentCount,
          maxCount: err.maxCount,
          upgradeUrl: err.upgradeUrl,
        },
      };
    }

    if (isStructuredError(err)) {
      if (err.code === 'unauthenticated') {
        throw new functions.https.HttpsError('unauthenticated', message);
      }
      if (err.code === 'feature-disabled') {
        throw new functions.https.HttpsError('failed-precondition', message);
      }
    }

    // Unexpected error — return structured error payload (not an HttpsError so
    // the client can inspect it, but safe to not expose internal stack traces)
    return makeError('internal', 'An unexpected error occurred. Please try again.', true);
  }
};
