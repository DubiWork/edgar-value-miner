import type { UserTier, RateLimitResult, UsageRecord } from './types.js';
import { TIER_CONFIG, getUpgradeUrl } from './tierConfig.js';
import { getUsageRecord } from './usageTracker.js';

export class RateLimitService {
  private readonly _getUsageRecord: (uid: string) => Promise<UsageRecord | null>;

  constructor(usageRecordFn?: (uid: string) => Promise<UsageRecord | null>) {
    this._getUsageRecord = usageRecordFn ?? getUsageRecord;
  }

  /**
   * Check whether a user is allowed to generate a fresh debate.
   *
   * - null uid (anonymous) always gets the anonymous tier config.
   * - Returns RateLimitResult with allowed=true/false and metadata.
   */
  async checkRateLimit(uid: string | null, tier: UserTier): Promise<RateLimitResult> {
    const config = TIER_CONFIG[tier];
    const upgradeUrl = getUpgradeUrl();

    // Tiers with 0 fresh debates are never allowed to generate
    if (config.freshDebatesPerMonth === 0) {
      return {
        allowed: false,
        currentCount: 0,
        maxCount: 0,
        upgradeUrl,
        reason: 'fresh-generation-not-allowed',
      };
    }

    // Fetch current usage for authenticated users
    const currentCount = uid !== null ? await this.getDebateCount(uid) : 0;
    const maxCount = config.freshDebatesPerMonth;

    if (currentCount >= maxCount) {
      return {
        allowed: false,
        currentCount,
        maxCount,
        upgradeUrl,
        reason: 'rate-limit-exceeded',
      };
    }

    return {
      allowed: true,
      currentCount,
      maxCount,
      upgradeUrl,
    };
  }

  private async getDebateCount(uid: string): Promise<number> {
    const record = await this._getUsageRecord(uid);
    if (record === null) return 0;
    return record.debateCount;
  }
}
