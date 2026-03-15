/**
 * Integration tests: full end-to-end flows through the debate Cloud Function stack.
 *
 * Strategy: real service instances with mocked Firestore/Auth/LLM at the SDK level.
 * No Firebase Emulator, no network calls.
 *
 * Coverage:
 *   1. Full debate flow (cache hit → response)
 *   2. Full debate flow (cache miss → generate → cache → response)
 *   3. Auth + rate limiting integration
 *   4. Error handling flows
 *   5. Monthly reset integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CachedDebate } from '../../services/debate/types.js';
import type { LLMService } from '../../services/llm/llmService.js';

// ── Firebase-admin mock ───────────────────────────────────────────────────────
//
// Use vi.fn(() => ...) for the firestore function so vi.clearAllMocks() does
// NOT wipe the implementation (it only clears .mock.calls / .mock.results).
// Child mocks (mockDoc, mockCollection) also use vi.fn(() => ...) for the same
// reason — avoiding the pitfall where .mockReturnValue() is cleared.

// Mutable snapshot used by collection().get() — overridden per test group
let currentUsersSnapshot: { empty: boolean; docs: Array<{ id: string }>; size: number } = {
  empty: true,
  docs: [],
  size: 0,
};

const increment = vi.fn((n: number) => ({ _increment: n }));
const mockUpdate = vi.fn(() => Promise.resolve(undefined));
const mockSet = vi.fn(() => Promise.resolve(undefined));
const mockGet = vi.fn(() => Promise.resolve({ exists: false, data: () => undefined }));
const mockDoc = vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate }));
const mockCollection = vi.fn(() => ({
  get: () => Promise.resolve(currentUsersSnapshot),
}));

const mockFirestoreFn = vi.fn(() => ({
  doc: mockDoc,
  collection: mockCollection,
}));
(mockFirestoreFn as unknown as { FieldValue: { increment: typeof increment } }).FieldValue = {
  increment,
};

vi.mock('firebase-admin', () => ({
  default: { firestore: mockFirestoreFn, initializeApp: vi.fn() },
  firestore: mockFirestoreFn,
  initializeApp: vi.fn(),
  apps: [],
}));

// ── firebase-functions mock ───────────────────────────────────────────────────
vi.mock('firebase-functions', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  scheduler: { onSchedule: vi.fn().mockReturnValue({}) },
  https: {
    onCall: vi.fn(),
    HttpsError: class HttpsError extends Error {
      public code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
  },
}));

// ── cacheManager mock ─────────────────────────────────────────────────────────
const mockReadDebate = vi.fn();
const mockWriteDebate = vi.fn(() => Promise.resolve(undefined));
const mockIncrementViewCount = vi.fn(() => Promise.resolve(undefined));
const mockIsCacheValid = vi.fn();

vi.mock('../../services/debate/cacheManager.js', () => ({
  readDebate: mockReadDebate,
  writeDebate: mockWriteDebate,
  incrementViewCount: mockIncrementViewCount,
  isCacheValid: mockIsCacheValid,
}));

// ── Feature flags mock ────────────────────────────────────────────────────────
const mockIsAiDebateEnabled = vi.fn(() => true);

vi.mock('../../config/featureFlags.js', () => ({
  isAiDebateEnabled: mockIsAiDebateEnabled,
}));

// ── usageTracker mock ─────────────────────────────────────────────────────────
const mockIncrementDebateCount = vi.fn(() => Promise.resolve(undefined));
const mockResetAllUsage = vi.fn(() => Promise.resolve(undefined));
const mockGetUsageRecord = vi.fn();

vi.mock('../../services/rateLimit/usageTracker.js', () => ({
  getUsageRecord: mockGetUsageRecord,
  incrementDebateCount: mockIncrementDebateCount,
  resetAllUsage: mockResetAllUsage,
}));

// ── DebateService mock (for handler-level tests only) ─────────────────────────
// Used when testing the getOrGenerateDebate handler in isolation — allows
// control of service behavior without going through the full service stack.
//
// IMPORTANT: use vi.fn(() => ...) rather than vi.fn().mockImplementation(() => ...)
// because vi.clearAllMocks() clears implementations set via .mockImplementation()
// but does NOT clear the initial implementation passed to vi.fn(impl).
const mockGetOrGenerate = vi.fn();

vi.mock('../../services/debate/debateService.js', () => ({
  DebateService: vi.fn(() => ({
    getOrGenerate: mockGetOrGenerate,
  })),
}));

// ─── Shared helpers ───────────────────────────────────────────────────────────

const NOW_ISO = '2026-03-15T00:00:00.000Z';

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
      riskFactors: [{ title: 'Competition risk', detail: 'Apple faces competition.', dataPoint: 'Market share -2%' }],
      confidence: 0.6,
      generatedAt: NOW_ISO,
    },
    synthesis: {
      keyFactors: [{ title: 'FCF growth', analysis: 'FCF trend is key.' }],
      recommendation: 'HOLD',
      confidence: 0.7,
      disclaimer: 'Not financial advice.',
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

function buildDebateResponse(source: 'cached' | 'generated' = 'cached') {
  return {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    generatedAt: NOW_ISO,
    bullCase: {
      arguments: [{ title: 'Strong FCF', detail: 'Apple generates large FCF.', citation: '10-K 2023' }],
      confidence: 0.8,
      generatedAt: NOW_ISO,
    },
    bearCase: {
      riskFactors: [{ title: 'Competition risk', detail: 'Apple faces competition.', dataPoint: 'Market share -2%' }],
      confidence: 0.6,
      generatedAt: NOW_ISO,
    },
    synthesis: {
      keyFactors: [{ title: 'FCF growth', analysis: 'FCF trend is key.' }],
      recommendation: 'HOLD',
      confidence: 0.7,
      disclaimer: 'Not financial advice.',
      generatedAt: NOW_ISO,
    },
    metadata: { model: 'claude-3-5-haiku-20241022', version: 1, viewCount: 10 },
    source,
  };
}

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
        keyFactors: [{ title: 'FCF growth', analysis: 'FCF trend is key.' }],
        recommendation: 'HOLD',
        confidence: 0.7,
        disclaimer: 'This is not financial advice.',
        generatedAt: NOW_ISO,
      }),
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 10, outputTokens: 20, estimatedCost: 0.001 },
    });
}

function makePermissiveRateLimiter() {
  return {
    checkRateLimit: vi.fn(() => Promise.resolve({
      allowed: true,
      currentCount: 0,
      maxCount: 3,
      upgradeUrl: '/upgrade',
    })),
  } as unknown as import('../../services/rateLimit/rateLimitService.js').RateLimitService;
}

/** Build a v2-style CallableRequest for the handler. */
function makeHandlerRequest(data: unknown, uid?: string) {
  return {
    data,
    auth: uid ? { uid, token: {} as never } : undefined,
  };
}

// ─── 1. Full debate flow: cache hit → response ───────────────────────────────
//
// These tests use the real DebateService with injected mocks.
// The top-level vi.mock for debateService.js means dynamic imports get the mock,
// but since these tests instantiate DebateService directly with `new DebateService(llm)`
// they bypass the mock constructor. We import from the mocked module but the mock
// constructor creates an object with `getOrGenerate: mockGetOrGenerate`. To test
// the real DebateService we skip import and call the real module's class.
// Instead, we import DebateService via resetModules-safe approach using the
// module path. Note: since debateService is mocked at the top level, we need
// to verify the real cacheManager mock integration via the mock calls.
// The correct integration approach: mock cacheManager (already done) and test
// that the handler correctly delegates, OR use vi.importActual for real class.

describe('Integration: cache hit flow (handler delegates correctly)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrGenerate.mockResolvedValue(buildDebateResponse('cached'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns debate with source "cached" on cache hit', async () => {
    mockGetOrGenerate.mockResolvedValueOnce(buildDebateResponse('cached'));

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    expect(result['source']).toBe('cached');
    expect(result['ticker']).toBe('AAPL');
  });

  it('serves cached debate to anonymous user (no uid)', async () => {
    mockGetOrGenerate.mockResolvedValueOnce(buildDebateResponse('cached'));

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' })
    ) as Record<string, unknown>;

    expect(result['source']).toBe('cached');
  });

  it('serves cached debate for different tickers', async () => {
    const msftResponse = { ...buildDebateResponse('cached'), ticker: 'MSFT', companyName: 'Microsoft' };
    mockGetOrGenerate.mockResolvedValueOnce(msftResponse);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'MSFT' }, 'user-1')
    ) as Record<string, unknown>;

    expect(result['ticker']).toBe('MSFT');
    expect(result['source']).toBe('cached');
  });

  it('response includes all required DebateResponse fields', async () => {
    mockGetOrGenerate.mockResolvedValueOnce(buildDebateResponse('cached'));

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      ticker: expect.any(String),
      companyName: expect.any(String),
      generatedAt: expect.any(String),
      bullCase: expect.any(Object),
      bearCase: expect.any(Object),
      synthesis: expect.any(Object),
      metadata: {
        model: expect.any(String),
        version: expect.any(Number),
        viewCount: expect.any(Number),
      },
      source: 'cached',
    });
  });

  it('normalises lowercase ticker to uppercase before passing to service', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    await getOrGenerateDebateHandler(makeHandlerRequest({ ticker: 'aapl' }, 'user-1'));

    expect(mockGetOrGenerate).toHaveBeenCalledWith('AAPL', expect.any(String), expect.any(Object));
  });

  it('passes isAuthenticated:false for anonymous callers', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    await getOrGenerateDebateHandler(makeHandlerRequest({ ticker: 'AAPL' }));

    expect(mockGetOrGenerate).toHaveBeenCalledWith(
      'AAPL',
      expect.any(String),
      expect.objectContaining({ isAuthenticated: false, uid: null })
    );
  });

  it('passes isAuthenticated:true and uid for authenticated callers', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    await getOrGenerateDebateHandler(makeHandlerRequest({ ticker: 'AAPL' }, 'user-123'));

    expect(mockGetOrGenerate).toHaveBeenCalledWith(
      'AAPL',
      expect.any(String),
      expect.objectContaining({ isAuthenticated: true, uid: 'user-123' })
    );
  });

  it('metadata.viewCount reflects value in response', async () => {
    const response = { ...buildDebateResponse('cached'), metadata: { model: 'claude-3-5-haiku-20241022', version: 1, viewCount: 42 } };
    mockGetOrGenerate.mockResolvedValueOnce(response);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    const metadata = result['metadata'] as Record<string, unknown>;
    expect(metadata['viewCount']).toBe(42);
  });
});

// ─── 2. Full debate flow: cache miss → generate → cache → response ─────────────
//
// Tests the real DebateService + cacheManager mock + LLM mock at service level.
// We use vi.importActual to bypass the top-level vi.mock on debateService.

describe('Integration: cache miss → generate flow (real DebateService)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiDebateEnabled.mockImplementation(() => true);
    mockReadDebate.mockResolvedValue(null);
    mockIsCacheValid.mockReturnValue(false);
  });

  it('generates fresh debate on cache miss for authenticated user', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(result.source).toBe('generated');
    expect(result.ticker).toBe('AAPL');
  });

  it('calls LLM exactly 3 times: bull + bear + synthesis', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(generateCompletion).toHaveBeenCalledTimes(3);
  });

  it('writes generated debate to Firestore cache (fire-and-forget)', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockWriteDebate).toHaveBeenCalledOnce();
  });

  it('written cache document has the correct ticker', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const writtenDoc = (mockWriteDebate.mock.calls as unknown as Array<[CachedDebate]>)[0][0];
    expect(writtenDoc.ticker).toBe('AAPL');
  });

  it('viewCount starts at 0 for newly generated debates', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const writtenDoc = (mockWriteDebate.mock.calls as unknown as Array<[CachedDebate]>)[0][0];
    expect(writtenDoc.viewCount).toBe(0);
  });

  it('metadata includes model name and version in response', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(typeof result.metadata.model).toBe('string');
    expect(result.metadata.model.length).toBeGreaterThan(0);
    expect(typeof result.metadata.version).toBe('number');
  });

  it('incrementDebateCount called after successful generation', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-123', isAuthenticated: true });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockIncrementDebateCount).toHaveBeenCalledWith('user-123');
  });

  it('incrementViewCount called after successful generation', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockIncrementViewCount).toHaveBeenCalledWith('AAPL');
  });

  it('re-generates when cache exists but TTL has expired', async () => {
    const staleDebate = buildCachedDebate({ generatedAt: '2020-01-01T00:00:00.000Z' });
    mockReadDebate.mockResolvedValueOnce(staleDebate);
    mockIsCacheValid.mockReturnValueOnce(false);

    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(result.source).toBe('generated');
    expect(generateCompletion).toHaveBeenCalledTimes(3);
  });

  it('bullCase arguments array is present and non-empty', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(Array.isArray(result.bullCase.arguments)).toBe(true);
    expect(result.bullCase.arguments.length).toBeGreaterThan(0);
  });

  it('synthesis recommendation is a string value', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true });

    expect(typeof result.synthesis.recommendation).toBe('string');
  });
});

// ─── 3. Auth + rate limiting integration ─────────────────────────────────────

describe('Integration: auth + rate limiting (real DebateService)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiDebateEnabled.mockImplementation(() => true);
    mockReadDebate.mockResolvedValue(null);
    mockIsCacheValid.mockReturnValue(false);
  });

  it('anonymous user receives cached debate without auth error', async () => {
    mockReadDebate.mockResolvedValueOnce(buildCachedDebate());
    mockIsCacheValid.mockReturnValueOnce(true);

    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);

    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: null, isAuthenticated: false });

    expect(result.source).toBe('cached');
  });

  it('anonymous user denied fresh generation on cache miss', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm } = makeLlmMock();
    const service = new DebateService(llm);

    await expect(
      service.getOrGenerate('AAPL', 'Apple Inc.', { uid: null, isAuthenticated: false })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('free user can generate when debateCount is 0 (below limit)', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const rateLimiter = {
      checkRateLimit: vi.fn(() => Promise.resolve({
        allowed: true,
        currentCount: 0,
        maxCount: 3,
        upgradeUrl: '/upgrade',
      })),
    } as unknown as import('../../services/rateLimit/rateLimitService.js').RateLimitService;

    const service = new DebateService(llm, rateLimiter);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    expect(result.source).toBe('generated');
  });

  it('free user can generate when debateCount is 2 (last slot)', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const rateLimiter = {
      checkRateLimit: vi.fn(() => Promise.resolve({
        allowed: true,
        currentCount: 2,
        maxCount: 3,
        upgradeUrl: '/upgrade',
      })),
    } as unknown as import('../../services/rateLimit/rateLimitService.js').RateLimitService;

    const service = new DebateService(llm, rateLimiter);
    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    expect(result.source).toBe('generated');
  });

  it('free user is rate-limited when debateCount equals maxCount (3)', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm } = makeLlmMock();

    const rateLimiter = {
      checkRateLimit: vi.fn(() => Promise.resolve({
        allowed: false,
        currentCount: 3,
        maxCount: 3,
        upgradeUrl: '/upgrade',
        reason: 'rate-limit-exceeded',
      })),
    } as unknown as import('../../services/rateLimit/rateLimitService.js').RateLimitService;

    const service = new DebateService(llm, rateLimiter);

    await expect(
      service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-free', isAuthenticated: true, tier: 'free' })
    ).rejects.toMatchObject({ code: 'rate-limited' });
  });

  it('rate limit error includes currentCount, maxCount, upgradeUrl', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm } = makeLlmMock();

    const rateLimiter = {
      checkRateLimit: vi.fn(() => Promise.resolve({
        allowed: false,
        currentCount: 3,
        maxCount: 3,
        upgradeUrl: '/upgrade',
        reason: 'rate-limit-exceeded',
      })),
    } as unknown as import('../../services/rateLimit/rateLimitService.js').RateLimitService;

    const service = new DebateService(llm, rateLimiter);

    let caught: unknown;
    try {
      await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-free', isAuthenticated: true, tier: 'free' });
    } catch (err) {
      caught = err;
    }

    expect(caught).toMatchObject({
      code: 'rate-limited',
      currentCount: 3,
      maxCount: 3,
      upgradeUrl: '/upgrade',
    });
  });

  it('debateCount incremented after successful generation', async () => {
    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm, generateCompletion } = makeLlmMock();
    setupLlmSuccess(generateCompletion);

    const service = new DebateService(llm, makePermissiveRateLimiter());
    await service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-free', isAuthenticated: true, tier: 'free' });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockIncrementDebateCount).toHaveBeenCalledWith('user-free');
  });

  it('feature flag disabled blocks generation', async () => {
    mockIsAiDebateEnabled.mockReturnValueOnce(false);

    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm } = makeLlmMock();
    const service = new DebateService(llm, makePermissiveRateLimiter());

    await expect(
      service.getOrGenerate('AAPL', 'Apple Inc.', { uid: 'user-1', isAuthenticated: true })
    ).rejects.toMatchObject({ code: 'feature-disabled' });
  });

  it('rate limit check is skipped when debate is served from cache', async () => {
    mockReadDebate.mockResolvedValueOnce(buildCachedDebate());
    mockIsCacheValid.mockReturnValueOnce(true);

    const checkRateLimit = vi.fn();
    const rateLimiter = { checkRateLimit } as unknown as import('../../services/rateLimit/rateLimitService.js').RateLimitService;

    const { DebateService } = await vi.importActual<typeof import('../../services/debate/debateService.js')>(
      '../../services/debate/debateService.js'
    );
    const { llm } = makeLlmMock();
    const service = new DebateService(llm, rateLimiter);

    const result = await service.getOrGenerate('AAPL', 'Apple Inc.', {
      uid: 'user-free',
      isAuthenticated: true,
      tier: 'free',
    });

    expect(result.source).toBe('cached');
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('handler maps rate-limited error to structured error response', async () => {
    const rateLimitErr = Object.assign(new Error('Rate limit exceeded'), {
      code: 'rate-limited',
      currentCount: 3,
      maxCount: 3,
      upgradeUrl: '/upgrade',
    });
    mockGetOrGenerate.mockRejectedValueOnce(rateLimitErr);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    const errorObj = result['error'] as Record<string, unknown>;
    expect(errorObj['code']).toBe('rate-limited');
    expect(typeof errorObj['currentCount']).toBe('number');
    expect(typeof errorObj['maxCount']).toBe('number');
    expect(typeof errorObj['upgradeUrl']).toBe('string');
  });
});

// ─── 4. Error handling flows ──────────────────────────────────────────────────

describe('Integration: error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrGenerate.mockResolvedValue(buildDebateResponse('cached'));
  });

  it('invalid ticker (empty string) returns invalid-argument error from handler', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeHandlerRequest({ ticker: '' }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('ticker too long (6+ chars) returns invalid-argument error from handler', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeHandlerRequest({ ticker: 'TOOLONG' }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('ticker with special characters returns invalid-argument error', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeHandlerRequest({ ticker: 'AA!L' }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('null request data returns invalid-argument error', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeHandlerRequest(null))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('LLM kill switch causes generation to fail with an error', async () => {
    mockReadDebate.mockResolvedValue(null);
    mockIsCacheValid.mockReturnValue(false);

    const killSwitchErr = Object.assign(
      new Error('LLM kill switch is enabled — all LLM calls are disabled.'),
      { code: 'llm-kill-switch' }
    );
    mockGetOrGenerate.mockRejectedValueOnce(killSwitchErr);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    // Kill switch is an unexpected error — handler returns structured internal error
    const errorObj = result['error'] as Record<string, unknown>;
    expect(errorObj).toBeDefined();
  });

  it('LLM failure does not leak internal error message to caller', async () => {
    mockGetOrGenerate.mockRejectedValueOnce(new Error('Something internal exploded'));

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    const errorObj = result['error'] as Record<string, unknown>;
    expect(errorObj['code']).toBe('internal');
    const message = errorObj['message'] as string;
    expect(message).not.toContain('internal exploded');
  });

  it('Firestore read failure propagates as a service error', async () => {
    const firestoreErr = new Error('Firestore unavailable');
    mockGetOrGenerate.mockRejectedValueOnce(firestoreErr);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    // Firestore error is unexpected — handler returns structured internal error
    const errorObj = result['error'] as Record<string, unknown>;
    expect(errorObj['code']).toBe('internal');
  });

  it('unauthenticated error is mapped to HttpsError unauthenticated by handler', async () => {
    const unauthErr = Object.assign(new Error('Auth required'), { code: 'unauthenticated', retryable: false });
    mockGetOrGenerate.mockRejectedValueOnce(unauthErr);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeHandlerRequest({ ticker: 'AAPL' }))
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('feature-disabled error is mapped to HttpsError failed-precondition by handler', async () => {
    const featureErr = Object.assign(new Error('Feature disabled'), { code: 'feature-disabled', retryable: false });
    mockGetOrGenerate.mockRejectedValueOnce(featureErr);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeHandlerRequest({ ticker: 'AAPL' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('unexpected handler error returns retryable:true in structured response', async () => {
    mockGetOrGenerate.mockRejectedValueOnce(new Error('Boom'));

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');
    const result = await getOrGenerateDebateHandler(
      makeHandlerRequest({ ticker: 'AAPL' }, 'user-1')
    ) as Record<string, unknown>;

    const errorObj = result['error'] as Record<string, unknown>;
    expect(errorObj['retryable']).toBe(true);
  });
});

// ─── 5. Monthly reset integration ────────────────────────────────────────────

describe('Integration: monthly reset flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUsersSnapshot = { empty: true, docs: [], size: 0 };
  });

  it('reset clears debateCount for all users via resetAllUsage', async () => {
    currentUsersSnapshot = {
      empty: false,
      docs: [{ id: 'user-a' }, { id: 'user-b' }, { id: 'user-c' }],
      size: 3,
    };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    expect(mockResetAllUsage).toHaveBeenCalledWith(['user-a', 'user-b', 'user-c']);
  });

  it('reset handles empty user collection without error', async () => {
    currentUsersSnapshot = { empty: true, docs: [], size: 0 };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await expect(monthlyUsageResetHandler()).resolves.not.toThrow();

    expect(mockResetAllUsage).toHaveBeenCalledWith([]);
  });

  it('reset handles multiple users in batch processing (>500 users)', async () => {
    currentUsersSnapshot = {
      empty: false,
      docs: Array.from({ length: 600 }, (_, i) => ({ id: `user-${i}` })),
      size: 600,
    };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    // Batch size is 500 — so 2 calls: 500 + 100
    expect(mockResetAllUsage).toHaveBeenCalledTimes(2);
    const firstBatch = (mockResetAllUsage.mock.calls as unknown as Array<[string[]]>)[0][0];
    const secondBatch = (mockResetAllUsage.mock.calls as unknown as Array<[string[]]>)[1][0];
    expect(firstBatch.length).toBe(500);
    expect(secondBatch.length).toBe(100);
  });

  it('reset calls usageTracker.resetAllUsage with correct uid list', async () => {
    currentUsersSnapshot = {
      empty: false,
      docs: [{ id: 'user-x' }],
      size: 1,
    };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    expect(mockResetAllUsage).toHaveBeenCalledWith(['user-x']);
  });

  it('after reset, previously rate-limited user uid is included in the reset call', async () => {
    currentUsersSnapshot = {
      empty: false,
      docs: [{ id: 'user-blocked' }],
      size: 1,
    };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    const calledUids = (mockResetAllUsage.mock.calls as unknown as Array<[string[]]>)[0][0];
    expect(calledUids).toContain('user-blocked');
  });
});
