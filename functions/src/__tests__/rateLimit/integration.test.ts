import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CachedDebate } from '../../services/debate/types.js';

// ── Firebase-admin mock ────────────────────────────────────────────────────────
vi.mock('firebase-admin', () => {
  const increment = vi.fn((n: number) => ({ _increment: n }));
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue({ exists: false, data: () => undefined });
  const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet, update: mockUpdate });
  const mockFirestoreFn = vi.fn().mockReturnValue({ doc: mockDoc, collection: vi.fn() });
  (mockFirestoreFn as unknown as { FieldValue: { increment: typeof increment } }).FieldValue = { increment };
  return {
    default: { firestore: mockFirestoreFn, initializeApp: vi.fn() },
    firestore: mockFirestoreFn,
    initializeApp: vi.fn(),
    apps: [],
  };
});

// ── cacheManager mock ──────────────────────────────────────────────────────────
const mockReadDebate = vi.fn();
const mockWriteDebate = vi.fn().mockResolvedValue(undefined);
const mockIncrementViewCount = vi.fn().mockResolvedValue(undefined);
const mockIsCacheValid = vi.fn();

vi.mock('../../services/debate/cacheManager.js', () => ({
  readDebate: mockReadDebate,
  writeDebate: mockWriteDebate,
  incrementViewCount: mockIncrementViewCount,
  isCacheValid: mockIsCacheValid,
}));

// ── Feature flags mock ─────────────────────────────────────────────────────────
const mockIsAiDebateEnabled = vi.fn().mockReturnValue(true);

vi.mock('../../config/featureFlags.js', () => ({
  isAiDebateEnabled: mockIsAiDebateEnabled,
}));

// ── RateLimitService mock ──────────────────────────────────────────────────────
const mockCheckRateLimit = vi.fn();
const mockIncrementDebateCount = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/rateLimit/rateLimitService.js', () => ({
  RateLimitService: vi.fn().mockImplementation(() => ({
    checkRateLimit: mockCheckRateLimit,
  })),
}));

vi.mock('../../services/rateLimit/usageTracker.js', () => ({
  getUsageRecord: vi.fn(),
  incrementDebateCount: mockIncrementDebateCount,
  resetAllUsage: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW_ISO = '2026-03-14T12:00:00.000Z';

function buildCachedDebate(overrides?: Partial<CachedDebate>): CachedDebate {
  return {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    bullCase: {
      arguments: [{ title: 'Strong FCF', detail: 'Apple generates large FCF.', citation: '10-K 2023' }],
      confidence: 0.8,
      generatedAt: NOW_ISO,
    },
    bearCase: {
      riskFactors: [{ title: 'Competition risk', detail: 'Apple Inc. faces competition.', dataPoint: 'Market share -2%' }],
      confidence: 0.6,
      generatedAt: NOW_ISO,
    },
    synthesis: {
      keyFactors: [{ title: 'FCF growth', analysis: 'Apple FCF trend is key.' }],
      recommendation: 'HOLD',
      confidence: 0.7,
      disclaimer: 'This is not financial advice.',
      generatedAt: NOW_ISO,
    },
    generatedAt: NOW_ISO,
    version: 1,
    viewCount: 10,
    lastViewedAt: null,
    model: 'claude-3-5-haiku-20241022',
    ...overrides,
  };
}

import type { LLMService } from '../../services/llm/llmService.js';

function makeLlmMock(): { llm: LLMService; generateCompletion: ReturnType<typeof vi.fn> } {
  const generateCompletion = vi.fn();
  const llm = { generateCompletion } as unknown as LLMService;
  return { llm, generateCompletion };
}

function setupLlmSuccess(generateCompletion: ReturnType<typeof vi.fn>): void {
  generateCompletion
    .mockResolvedValueOnce({
      content: JSON.stringify({
        arguments: [{ title: 'Strong FCF', detail: 'Apple Inc. generates strong FCF.', citation: '10-K 2023' }],
        confidence: 0.8,
        generatedAt: NOW_ISO,
      }),
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 10, outputTokens: 20, estimatedCost: 0.001 },
    })
    .mockResolvedValueOnce({
      content: JSON.stringify({
        riskFactors: [{ title: 'Competition', detail: 'Apple Inc. faces competition.', dataPoint: 'Market share -2%' }],
        confidence: 0.5,
        generatedAt: NOW_ISO,
      }),
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 10, outputTokens: 20, estimatedCost: 0.001 },
    })
    .mockResolvedValueOnce({
      content: JSON.stringify({
        keyFactors: [{ title: 'FCF growth', analysis: 'Apple FCF trend is key.' }],
        recommendation: 'HOLD',
        confidence: 0.7,
        disclaimer: 'This is not financial advice.',
        generatedAt: NOW_ISO,
      }),
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 10, outputTokens: 20, estimatedCost: 0.001 },
    });
}

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('Rate limiting integration — free user generates 3 debates, 4th is rate-limited', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiDebateEnabled.mockReturnValue(true);
    mockReadDebate.mockResolvedValue(null);
    mockIsCacheValid.mockReturnValue(false);
    mockWriteDebate.mockResolvedValue(undefined);
    mockIncrementViewCount.mockResolvedValue(undefined);
  });

  it('allows 1st debate generation for free user (debateCount=0)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true, currentCount: 0, maxCount: 3, upgradeUrl: '/upgrade' });

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    expect(result.source).toBe('generated');
  });

  it('allows 2nd debate generation for free user (debateCount=1)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true, currentCount: 1, maxCount: 3, upgradeUrl: '/upgrade' });

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    expect(result.source).toBe('generated');
  });

  it('allows 3rd debate generation for free user (debateCount=2)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true, currentCount: 2, maxCount: 3, upgradeUrl: '/upgrade' });

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    expect(result.source).toBe('generated');
  });

  it('rate-limits 4th debate for free user (debateCount=3) — throws rate-limited error', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      currentCount: 3,
      maxCount: 3,
      upgradeUrl: '/upgrade',
      reason: 'rate-limit-exceeded',
    });

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();

    const service = new DebateService(llm);

    await expect(
      service.getOrGenerate('AAPL', 'Apple Inc.', {
        uid: 'user-free',
        isAuthenticated: true,
        tier: 'free',
      })
    ).rejects.toMatchObject({
      code: 'rate-limited',
      currentCount: 3,
      maxCount: 3,
      upgradeUrl: '/upgrade',
    });
  });

  it('increments debateCount after successful generation', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true, currentCount: 0, maxCount: 3, upgradeUrl: '/upgrade' });

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm);
    await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockIncrementDebateCount).toHaveBeenCalledWith('user-free');
  });

  it('does NOT check rate limit when debate is served from cache', async () => {
    const cached = buildCachedDebate();
    mockReadDebate.mockResolvedValueOnce(cached);
    mockIsCacheValid.mockReturnValueOnce(true);

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();

    const service = new DebateService(llm);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    expect(result.source).toBe('cached');
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });
});

describe('Rate limiting integration — getOrGenerateDebate handler maps rate-limited to structured error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handler returns structured rate-limit error (not HttpsError) when service throws rate-limited', async () => {
    const rateLimitErr = Object.assign(new Error('Rate limit exceeded'), {
      code: 'rate-limited',
      currentCount: 3,
      maxCount: 3,
      upgradeUrl: '/upgrade',
    });

    // Mock DebateService to throw the rate-limited error
    const mockGetOrGenerate = vi.fn().mockRejectedValueOnce(rateLimitErr);
    vi.doMock('../../services/debate/debateService.js', () => ({
      DebateService: vi.fn().mockImplementation(() => ({
        getOrGenerate: mockGetOrGenerate,
      })),
    }));

    vi.resetModules();

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler({
      data: { ticker: 'AAPL' },
      auth: { uid: 'user-1' },
    }) as Record<string, unknown>;

    const errorObj = result['error'] as Record<string, unknown>;
    expect(errorObj['code']).toBe('rate-limited');
    expect(typeof errorObj['currentCount']).toBe('number');
    expect(typeof errorObj['maxCount']).toBe('number');
    expect(typeof errorObj['upgradeUrl']).toBe('string');
  });
});
