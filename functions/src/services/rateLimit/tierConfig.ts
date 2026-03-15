import type { UserTier, RateLimitConfig } from './types.js';

/**
 * Tier limits configuration.
 *
 * | Tier      | Fresh Debates/Month | Cached Access |
 * |-----------|---------------------|---------------|
 * | anonymous | 0                   | 3/month       |
 * | free      | 3/month             | Unlimited     |
 * | basic     | 0                   | Unlimited     |
 * | premium   | 5/month             | Unlimited     |
 */
export const TIER_CONFIG: Record<UserTier, RateLimitConfig> = {
  anonymous: {
    freshDebatesPerMonth: 0,
    cachedAccessAllowed: true,
  },
  free: {
    freshDebatesPerMonth: 3,
    cachedAccessAllowed: true,
  },
  basic: {
    freshDebatesPerMonth: 0,
    cachedAccessAllowed: true,
  },
  premium: {
    freshDebatesPerMonth: 5,
    cachedAccessAllowed: true,
  },
};

const UPGRADE_URL = 'https://edgar-value-miner.web.app/upgrade';

export function getUpgradeUrl(): string {
  return process.env.UPGRADE_URL ?? UPGRADE_URL;
}
