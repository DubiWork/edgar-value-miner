import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CachedDebate } from '../../services/debate/types.js';
import type { LLMService } from '../../services/llm/llmService.js';

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

// ── RateLimitService mock — always allow in debateService unit tests ───────────
vi.mock('../../services/rateLimit/rateLimitService.js', () => ({
  RateLimitService: vi.fn().mockImplementation(() => ({
    checkRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      currentCount: 0,
      maxCount: 3,
      upgradeUrl: '/upgrade',
    }),
  })),
}));

// ── usageTracker mock — fire-and-forget calls won't hit real Firestore ─────────
vi.mock('../../services/rateLimit/usageTracker.js', () => ({
  getUsageRecord: vi.fn().mockResolvedValue(null),
  incrementDebateCount: vi.fn().mockResolvedValue(undefined),
  resetAllUsage: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

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

function buildLlmBullResponse(): string {
  return JSON.stringify({
    arguments: [{ title: 'Strong FCF', detail: 'Apple Inc. generates strong FCF.', citation: '10-K 2023' }],
    confidence: 0.8,
    generatedAt: NOW_ISO,
  });
}

function buildLlmBearResponse(): string {
  return JSON.stringify({
    riskFactors: [{ title: 'Competition', detail: 'Apple Inc. faces competition.', dataPoint: 'Market share -2%' }],
    confidence: 0.5,
    generatedAt: NOW_ISO,
  });
}

function buildLlmSynthResponse(): string {
  return JSON.stringify({
    keyFactors: [{ title: 'FCF growth', analysis: 'Apple FCF trend is key.' }],
    recommendation: 'HOLD',
    confidence: 0.7,
    disclaimer: 'This is not financial advice.',
    generatedAt: NOW_ISO,
  });
}

function makeLlmMock(): { llm: LLMService; generateCompletion: ReturnType<typeof vi.fn> } {
  const generateCompletion = vi.fn();
  const llm = { generateCompletion } as unknown as LLMService;
  return { llm, generateCompletion };
}

function makePermissiveRateLimiter() {
  return {
    checkRateLimit: vi.fn().mockResolvedValue({
      allowed: true,
      currentCount: 0,
      maxCount: 3,
      upgradeUrl: '/upgrade',
    }),
  } as unknown as import('../../services/rateLimit/rateLimitService.js').RateLimitService;
}

function setupLlmSuccess(generateCompletion: ReturnType<typeof vi.fn>): void {
  generateCompletion
    .mockResolvedValueOnce({ content: buildLlmBullResponse(), model: 'claude-3-5-haiku-20241022', usage: { inputTokens: 10, outputTokens: 20, estimatedCost: 0.001 } })
    .mockResolvedValueOnce({ content: buildLlmBearResponse(), model: 'claude-3-5-haiku-20241022', usage: { inputTokens: 10, outputTokens: 20, estimatedCost: 0.001 } })
    .mockResolvedValueOnce({ content: buildLlmSynthResponse(), model: 'claude-3-5-haiku-20241022', usage: { inputTokens: 10, outputTokens: 20, estimatedCost: 0.001 } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DebateService — cache hit path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiDebateEnabled.mockReturnValue(true);
    mockIncrementViewCount.mockResolvedValue(undefined);
    mockWriteDebate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached debate when cache is valid', async () => {
    const cached = buildCachedDebate();
    mockReadDebate.mockResolvedValueOnce(cached);
    mockIsCacheValid.mockReturnValueOnce(true);

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: null, isAuthenticated: false });

    expect(result.source).toBe('cached');
    expect(result.ticker).toBe('AAPL');
    expect(result.bullCase.arguments[0].title).toBe('Strong FCF');
    expect(mockReadDebate).toHaveBeenCalledWith('AAPL');
  });

  it('increments viewCount on cache hit', async () => {
    const cached = buildCachedDebate();
    mockReadDebate.mockResolvedValueOnce(cached);
    mockIsCacheValid.mockReturnValueOnce(true);

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: null, isAuthenticated: false });

    // Give microtask queue time for the fire-and-forget
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockIncrementViewCount).toHaveBeenCalledWith('AAPL');
  });

  it('serves cached debate to unauthenticated user', async () => {
    const cached = buildCachedDebate();
    mockReadDebate.mockResolvedValueOnce(cached);
    mockIsCacheValid.mockReturnValueOnce(true);

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: null,
      isAuthenticated: false,
    });

    expect(result.source).toBe('cached');
  });

  it('includes metadata in response', async () => {
    const cached = buildCachedDebate();
    mockReadDebate.mockResolvedValueOnce(cached);
    mockIsCacheValid.mockReturnValueOnce(true);

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: null, isAuthenticated: false });

    expect(result.metadata.model).toBe('claude-3-5-haiku-20241022');
    expect(result.metadata.version).toBe(1);
    expect(result.metadata.viewCount).toBe(10);
  });
});

describe('DebateService — cache miss path (authenticated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiDebateEnabled.mockReturnValue(true);
    mockReadDebate.mockResolvedValue(null);
    mockIsCacheValid.mockReturnValue(false);
    mockWriteDebate.mockResolvedValue(undefined);
    mockIncrementViewCount.mockResolvedValue(undefined);
  });

  it('generates fresh debate and returns source=generated', async () => {
    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(result.source).toBe('generated');
    expect(result.ticker).toBe('AAPL');
  });

  it('calls LLM 3 times (bull + bear + synthesis)', async () => {
    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(generateCompletion).toHaveBeenCalledTimes(3);
  });

  it('writes generated debate to cache', async () => {
    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockWriteDebate).toHaveBeenCalledOnce();
    expect(mockWriteDebate.mock.calls[0][0].ticker).toBe('AAPL');
  });

  it('normalises ticker to uppercase', async () => {
    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('aapl', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(mockReadDebate).toHaveBeenCalledWith('AAPL');
  });
});

describe('DebateService — TTL expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiDebateEnabled.mockReturnValue(true);
    mockWriteDebate.mockResolvedValue(undefined);
    mockIncrementViewCount.mockResolvedValue(undefined);
  });

  it('re-generates when cache exists but TTL has expired', async () => {
    const stale = buildCachedDebate({ generatedAt: '2020-01-01T00:00:00.000Z' });
    mockReadDebate.mockResolvedValueOnce(stale);
    mockIsCacheValid.mockReturnValueOnce(false); // expired

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(result.source).toBe('generated');
    expect(generateCompletion).toHaveBeenCalledTimes(3);
  });
});

describe('DebateService — auth check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiDebateEnabled.mockReturnValue(true);
    mockReadDebate.mockResolvedValue(null);
    mockIsCacheValid.mockReturnValue(false);
  });

  it('throws unauthenticated error when no cache and caller is anonymous', async () => {
    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);

    await expect(
      service.getOrGenerate('AAPL', 'Apple Inc.', { uid: null, isAuthenticated: false })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('does not throw auth error when cache is valid for anonymous caller', async () => {
    mockReadDebate.mockResolvedValueOnce(buildCachedDebate());
    mockIsCacheValid.mockReturnValueOnce(true);

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);

    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: null, isAuthenticated: false });
    expect(result.source).toBe('cached');
  });
});

describe('DebateService — feature flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadDebate.mockResolvedValue(null);
    mockIsCacheValid.mockReturnValue(false);
  });

  it('throws feature-disabled when AI_DEBATE_ENABLED=false and no cache', async () => {
    mockIsAiDebateEnabled.mockReturnValueOnce(false);

    const { DebateService } = await import('../../services/debate/debateService.js');
    const { llm } = makeLlmMock();
    const service = new DebateService(llm, makePermissiveRateLimiter());

    await expect(
      service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true })
    ).rejects.toMatchObject({ code: 'feature-disabled' });
  });
});
