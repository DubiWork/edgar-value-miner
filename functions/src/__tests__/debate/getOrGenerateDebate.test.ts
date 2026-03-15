import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase-admin mock ────────────────────────────────────────────────────────
vi.mock('firebase-admin', () => ({
  default: { firestore: vi.fn().mockReturnValue({ doc: vi.fn() }), initializeApp: vi.fn() },
  firestore: vi.fn().mockReturnValue({ doc: vi.fn() }),
  initializeApp: vi.fn(),
  apps: [],
}));

// ── DebateService mock ─────────────────────────────────────────────────────────
const mockGetOrGenerate = vi.fn();

vi.mock('../../services/debate/debateService.js', () => ({
  DebateService: vi.fn().mockImplementation(() => ({
    getOrGenerate: mockGetOrGenerate,
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a v2-style CallableRequest for the handler. */
function makeRequest(data: unknown, uid?: string) {
  return {
    data,
    auth: uid ? { uid, token: {} as never } : undefined,
  };
}

function buildDebateResponse(source: 'cached' | 'generated' = 'cached') {
  return {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    generatedAt: '2026-03-14T12:00:00.000Z',
    bullCase: { arguments: [], confidence: 0.8, generatedAt: '2026-03-14T12:00:00.000Z' },
    bearCase: { riskFactors: [], confidence: 0.6, generatedAt: '2026-03-14T12:00:00.000Z' },
    synthesis: { keyFactors: [], recommendation: 'HOLD', confidence: 0.7, disclaimer: 'N/A', generatedAt: '2026-03-14T12:00:00.000Z' },
    metadata: { model: 'claude-3-5-haiku-20241022', version: 1, viewCount: 5 },
    source,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getOrGenerateDebate handler — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrGenerate.mockResolvedValue(buildDebateResponse());
  });

  it('throws invalid-argument when data is null', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeRequest(null))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when ticker is missing', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeRequest({}))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when ticker has invalid format', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeRequest({ ticker: 'TOOLONG' }))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('accepts valid 1-5 char ticker', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    const result = await getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }, 'user-1'));
    expect(result).toBeDefined();
  });

  it('normalises lowercase ticker before passing to service', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await getOrGenerateDebateHandler(makeRequest({ ticker: 'aapl' }, 'user-1'));
    expect(mockGetOrGenerate).toHaveBeenCalledWith('AAPL', expect.any(String), expect.any(Object));
  });
});

describe('getOrGenerateDebate handler — auth context forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrGenerate.mockResolvedValue(buildDebateResponse());
  });

  it('passes isAuthenticated=false for unauthenticated callers', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }));

    expect(mockGetOrGenerate).toHaveBeenCalledWith(
      'AAPL',
      expect.any(String),
      expect.objectContaining({ isAuthenticated: false, uid: null })
    );
  });

  it('passes isAuthenticated=true and uid for authenticated callers', async () => {
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }, 'user-123'));

    expect(mockGetOrGenerate).toHaveBeenCalledWith(
      'AAPL',
      expect.any(String),
      expect.objectContaining({ isAuthenticated: true, uid: 'user-123' })
    );
  });
});

describe('getOrGenerateDebate handler — response passthrough', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns debate response with source=cached', async () => {
    mockGetOrGenerate.mockResolvedValueOnce(buildDebateResponse('cached'));
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    const result = await getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }, 'user-1')) as Record<string, unknown>;
    expect(result['source']).toBe('cached');
  });

  it('returns debate response with source=generated', async () => {
    mockGetOrGenerate.mockResolvedValueOnce(buildDebateResponse('generated'));
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    const result = await getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }, 'user-1')) as Record<string, unknown>;
    expect(result['source']).toBe('generated');
  });
});

describe('getOrGenerateDebate handler — error mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps unauthenticated service error to HttpsError unauthenticated', async () => {
    const err = Object.assign(new Error('Auth required'), { code: 'unauthenticated', retryable: false });
    mockGetOrGenerate.mockRejectedValueOnce(err);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }))
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('maps feature-disabled error to HttpsError failed-precondition', async () => {
    const err = Object.assign(new Error('Feature disabled'), { code: 'feature-disabled', retryable: false });
    mockGetOrGenerate.mockRejectedValueOnce(err);

    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    await expect(
      getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('returns structured error payload for unexpected errors', async () => {
    mockGetOrGenerate.mockRejectedValueOnce(new Error('Something exploded'));
    const { getOrGenerateDebateHandler } = await import('../../functions/getOrGenerateDebate.js');

    const result = await getOrGenerateDebateHandler(makeRequest({ ticker: 'AAPL' }, 'user-1')) as Record<string, unknown>;
    const errorObj = result['error'] as Record<string, unknown>;
    expect(errorObj['code']).toBe('internal');
    expect(errorObj['retryable']).toBe(true);
  });
});
