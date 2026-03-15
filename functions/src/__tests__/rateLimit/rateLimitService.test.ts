import { describe, it, expect, vi } from 'vitest';

// ── Firebase-admin mock ────────────────────────────────────────────────────────
vi.mock('firebase-admin', () => {
  const mockFirestoreFn = vi.fn().mockReturnValue({ doc: vi.fn(), collection: vi.fn() });
  return {
    default: { firestore: mockFirestoreFn, initializeApp: vi.fn() },
    firestore: mockFirestoreFn,
    initializeApp: vi.fn(),
    apps: [],
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUsageRecordFn(debateCount: number) {
  return vi.fn().mockResolvedValue({ debateCount, debateCountResetAt: null });
}

function makeNullUsageRecordFn() {
  return vi.fn().mockResolvedValue(null);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RateLimitService — anonymous user (cached-only)', () => {
  it('denies fresh generation for anonymous user', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService();

    const result = await service.checkRateLimit(null, 'anonymous');

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('fresh-generation-not-allowed');
  });

  it('returns maxCount=0 for anonymous user', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService();

    const result = await service.checkRateLimit(null, 'anonymous');

    expect(result.maxCount).toBe(0);
  });

  it('returns upgradeUrl for anonymous user', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService();

    const result = await service.checkRateLimit(null, 'anonymous');

    expect(typeof result.upgradeUrl).toBe('string');
    expect(result.upgradeUrl.length).toBeGreaterThan(0);
  });
});

describe('RateLimitService — free tier (3 fresh debates/month)', () => {
  it('allows generation when debateCount is 0', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(0));

    const result = await service.checkRateLimit('user-1', 'free');

    expect(result.allowed).toBe(true);
  });

  it('allows generation when debateCount is exactly 2 (one slot left)', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(2));

    const result = await service.checkRateLimit('user-1', 'free');

    expect(result.allowed).toBe(true);
  });

  it('denies generation when debateCount is exactly 3 (limit reached)', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(3));

    const result = await service.checkRateLimit('user-1', 'free');

    expect(result.allowed).toBe(false);
  });

  it('denies generation when debateCount exceeds limit', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(5));

    const result = await service.checkRateLimit('user-1', 'free');

    expect(result.allowed).toBe(false);
  });

  it('returns currentCount and maxCount=3 for free tier', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(2));

    const result = await service.checkRateLimit('user-1', 'free');

    expect(result.currentCount).toBe(2);
    expect(result.maxCount).toBe(3);
  });

  it('returns upgradeUrl when rate-limited on free tier', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(3));

    const result = await service.checkRateLimit('user-1', 'free');

    expect(typeof result.upgradeUrl).toBe('string');
    expect(result.upgradeUrl.length).toBeGreaterThan(0);
  });

  it('treats missing usage record as 0 count (first-time user)', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeNullUsageRecordFn());

    const result = await service.checkRateLimit('user-new', 'free');

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(0);
  });
});

describe('RateLimitService — basic tier (0 fresh debates, unlimited cached)', () => {
  it('denies fresh generation for basic tier', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(0));

    const result = await service.checkRateLimit('user-1', 'basic');

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('fresh-generation-not-allowed');
  });

  it('returns maxCount=0 for basic tier', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(0));

    const result = await service.checkRateLimit('user-1', 'basic');

    expect(result.maxCount).toBe(0);
  });
});

describe('RateLimitService — premium tier (5 fresh debates/month)', () => {
  it('allows generation when debateCount is 0', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(0));

    const result = await service.checkRateLimit('user-1', 'premium');

    expect(result.allowed).toBe(true);
  });

  it('allows generation when debateCount is exactly 4 (one slot left)', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(4));

    const result = await service.checkRateLimit('user-1', 'premium');

    expect(result.allowed).toBe(true);
  });

  it('denies generation when debateCount is exactly 5 (limit reached)', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(5));

    const result = await service.checkRateLimit('user-1', 'premium');

    expect(result.allowed).toBe(false);
  });

  it('returns maxCount=5 for premium tier', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(3));

    const result = await service.checkRateLimit('user-1', 'premium');

    expect(result.maxCount).toBe(5);
  });
});

describe('RateLimitService — rate limit response shape', () => {
  it('returns correct shape when rate-limited: limited, currentCount, maxCount, upgradeUrl', async () => {
    const { RateLimitService } = await import('../../services/rateLimit/rateLimitService.js');
    const service = new RateLimitService(makeUsageRecordFn(3));

    const result = await service.checkRateLimit('user-1', 'free');

    expect(result).toMatchObject({
      allowed: false,
      currentCount: 3,
      maxCount: 3,
      upgradeUrl: expect.any(String),
    });
  });
});
