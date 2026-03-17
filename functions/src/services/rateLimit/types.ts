/**
 * Rate limiting types for the MVP debateCount throttle.
 */

/** User subscription tier. */
export type UserTier = 'anonymous' | 'free' | 'basic' | 'premium';

/** Per-tier configuration: how many fresh generations are allowed per month. */
export interface RateLimitConfig {
  /** 0 means no fresh generation allowed for this tier. */
  freshDebatesPerMonth: number;
  /** Whether the tier can access cached debates at all. */
  cachedAccessAllowed: boolean;
}

/** Result of a rate limit check. */
export interface RateLimitResult {
  /** True if generation should proceed. */
  allowed: boolean;
  /** Current fresh debate count this month. */
  currentCount: number;
  /** Maximum allowed for this tier (0 = not allowed). */
  maxCount: number;
  /** URL to send the user for upgrade info. */
  upgradeUrl: string;
  /** Machine-readable reason when not allowed. */
  reason?: 'rate-limit-exceeded' | 'fresh-generation-not-allowed';
}

/** Stored in `users/{uid}` — tracks monthly usage. */
export interface UsageRecord {
  debateCount: number;
  /** ISO-8601 timestamp of the last reset. Null if never reset. */
  debateCountResetAt: string | null;
}
