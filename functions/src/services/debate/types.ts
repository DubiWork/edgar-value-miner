import type { BullCase, BearCase, Synthesis } from '../prompts/types.js';

/**
 * Shape of a debate document stored in Firestore at `debates/{ticker}_v1`.
 */
export interface CachedDebate {
  ticker: string;
  companyName: string;
  bullCase: BullCase;
  bearCase: BearCase;
  synthesis: Synthesis;
  generatedAt: string; // ISO-8601, set server-side
  version: number;
  viewCount: number;
  lastViewedAt: string | null;
  /** Model used when generating this debate */
  model: string;
}

/** Input accepted by the getOrGenerateDebate callable function. */
export interface DebateRequest {
  ticker: string;
  /** Optional company name; used when generating a fresh debate. */
  companyName?: string;
}

/**
 * Response returned by the getOrGenerateDebate callable function.
 * Mirrors the documented response shape in the issue.
 */
export interface DebateResponse {
  ticker: string;
  companyName: string;
  generatedAt: string;
  bullCase: BullCase;
  bearCase: BearCase;
  synthesis: Synthesis;
  metadata: {
    model: string;
    version: number;
    viewCount: number;
  };
  /** "cached" when served from Firestore; "generated" when freshly created */
  source: 'cached' | 'generated';
}

/** Structured error returned to the client. */
export interface DebateError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/** Context info about an authenticated caller. */
export interface CallerContext {
  uid: string | null;
  isAuthenticated: boolean;
}
