import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CachedDebate } from '../../services/debate/types.js';

// ── Firebase-admin mock ────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet, update: mockUpdate });
const mockFirestoreFn = vi.fn().mockReturnValue({ doc: mockDoc, collection: vi.fn() });

const incrementSpy = vi.fn((n: number) => ({ _increment: n }));
(mockFirestoreFn as unknown as { FieldValue: { increment: typeof incrementSpy } }).FieldValue = {
  increment: incrementSpy,
};

vi.mock('firebase-admin', () => ({
  default: { firestore: mockFirestoreFn, initializeApp: vi.fn() },
  firestore: mockFirestoreFn,
  initializeApp: vi.fn(),
  apps: [],
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW_ISO = '2026-03-14T12:00:00.000Z';

function buildCachedDebate(overrides?: Partial<CachedDebate>): CachedDebate {
  return {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    bullCase: {
      arguments: [{ title: 'Strong FCF', detail: 'Apple generates large FCF.', citation: '10-K' }],
      confidence: 0.8,
      generatedAt: NOW_ISO,
    },
    bearCase: {
      riskFactors: [{ title: 'Competition', detail: 'Apple faces competition.', dataPoint: 'Mkt -2%' }],
      confidence: 0.5,
      generatedAt: NOW_ISO,
    },
    synthesis: {
      keyFactors: [{ title: 'FCF', analysis: 'FCF matters.' }],
      recommendation: 'HOLD',
      confidence: 0.7,
      disclaimer: 'Not financial advice.',
      generatedAt: NOW_ISO,
    },
    generatedAt: NOW_ISO,
    version: 1,
    viewCount: 5,
    lastViewedAt: null,
    model: 'claude-3-5-haiku-20241022',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cacheManager — readDebate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when document does not exist in Firestore', async () => {
    mockGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const { readDebate } = await import('../../services/debate/cacheManager.js');
    const result = await readDebate('AAPL');

    expect(result).toBeNull();
    expect(mockDoc).toHaveBeenCalledWith('debates/AAPL_v1');
  });

  it('returns debate data when document exists', async () => {
    const debate = buildCachedDebate();
    mockGet.mockResolvedValueOnce({ exists: true, data: () => debate });

    const { readDebate } = await import('../../services/debate/cacheManager.js');
    const result = await readDebate('AAPL');

    expect(result).toEqual(debate);
  });

  it('normalises ticker to uppercase in doc path', async () => {
    mockGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const { readDebate } = await import('../../services/debate/cacheManager.js');
    await readDebate('aapl');

    expect(mockDoc).toHaveBeenCalledWith('debates/AAPL_v1');
  });
});

describe('cacheManager — isCacheValid', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns true when generatedAt is within the default 90-day TTL', async () => {
    const { isCacheValid } = await import('../../services/debate/cacheManager.js');
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
    const debate = buildCachedDebate({ generatedAt: recentDate });

    expect(isCacheValid(debate)).toBe(true);
  });

  it('returns false when generatedAt is beyond the default 90-day TTL', async () => {
    const { isCacheValid } = await import('../../services/debate/cacheManager.js');
    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString(); // 91 days ago
    const debate = buildCachedDebate({ generatedAt: oldDate });

    expect(isCacheValid(debate)).toBe(false);
  });

  it('returns false when generatedAt is invalid', async () => {
    const { isCacheValid } = await import('../../services/debate/cacheManager.js');
    const debate = buildCachedDebate({ generatedAt: 'not-a-date' });

    expect(isCacheValid(debate)).toBe(false);
  });

  it('respects DEBATE_CACHE_TTL_DAYS env-var override', async () => {
    process.env.DEBATE_CACHE_TTL_DAYS = '1';
    vi.resetModules();

    const { isCacheValid } = await import('../../services/debate/cacheManager.js');
    // 2 days ago — should be STALE under a 1-day TTL
    const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const debate = buildCachedDebate({ generatedAt: oldDate });

    expect(isCacheValid(debate)).toBe(false);
  });
});

describe('cacheManager — writeDebate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes debate to correct Firestore path', async () => {
    const debate = buildCachedDebate();
    const { writeDebate } = await import('../../services/debate/cacheManager.js');
    await writeDebate(debate);

    expect(mockDoc).toHaveBeenCalledWith('debates/AAPL_v1');
    expect(mockSet).toHaveBeenCalledWith(debate);
  });
});

describe('cacheManager — incrementViewCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates viewCount with FieldValue.increment(1)', async () => {
    const { incrementViewCount } = await import('../../services/debate/cacheManager.js');
    await incrementViewCount('AAPL');

    expect(mockDoc).toHaveBeenCalledWith('debates/AAPL_v1');
    expect(mockUpdate).toHaveBeenCalledOnce();

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    // The increment sentinel should be present (our mock returns { _increment: 1 })
    expect(updateArg['viewCount']).toEqual({ _increment: 1 });
    expect(typeof updateArg['lastViewedAt']).toBe('string');
  });
});
