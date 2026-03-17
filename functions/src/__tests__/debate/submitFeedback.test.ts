import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase-admin mock ────────────────────────────────────────────────────────
vi.mock('firebase-admin', () => ({
  default: {
    firestore: vi.fn().mockReturnValue({ doc: vi.fn() }),
    initializeApp: vi.fn(),
  },
  firestore: vi.fn().mockReturnValue({ doc: vi.fn() }),
  initializeApp: vi.fn(),
  apps: [],
}));

// ── Firestore transaction mock ─────────────────────────────────────────────────
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockTransactionGet = vi.fn();
const mockTransactionSet = vi.fn();
const mockTransactionUpdate = vi.fn();
const mockRunTransaction = vi.fn();

const mockFeedbackDocRef = {
  get: mockDocGet,
  set: mockDocSet,
  update: mockDocUpdate,
};

vi.mock('firebase-admin/firestore', () => {
  const FieldValue = {
    increment: vi.fn((n) => ({ _increment: n })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  };

  const db = {
    doc: vi.fn().mockReturnValue(mockFeedbackDocRef),
    collection: vi.fn().mockReturnThis(),
    runTransaction: mockRunTransaction,
  };

  return {
    getFirestore: vi.fn(() => db),
    FieldValue,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(data: unknown, uid?: string) {
  return {
    data,
    auth: uid ? { uid, token: {} as never } : undefined,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('submitFeedback handler — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn({
        get: mockTransactionGet,
        set: mockTransactionSet,
        update: mockTransactionUpdate,
      });
    });
    mockTransactionGet.mockResolvedValue({ exists: false, data: () => undefined });
  });

  it('throws unauthenticated when caller has no auth', async () => {
    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await expect(
      submitFeedbackHandler(makeRequest({ debateId: 'AAPL_v1', section: 'bullCase', rating: 'up' }))
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('throws invalid-argument when debateId is missing', async () => {
    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await expect(
      submitFeedbackHandler(makeRequest({ section: 'bullCase', rating: 'up' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when section is invalid', async () => {
    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await expect(
      submitFeedbackHandler(makeRequest({ debateId: 'AAPL_v1', section: 'invalid', rating: 'up' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when rating is invalid', async () => {
    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await expect(
      submitFeedbackHandler(makeRequest({ debateId: 'AAPL_v1', section: 'bullCase', rating: 'meh' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when debateId contains a forward slash (path injection)', async () => {
    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await expect(
      submitFeedbackHandler(makeRequest({ debateId: 'debates/evil', section: 'bullCase', rating: 'up' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when debateId contains a dot (path injection)', async () => {
    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await expect(
      submitFeedbackHandler(makeRequest({ debateId: 'AAPL.v1', section: 'bullCase', rating: 'up' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when debateId contains whitespace (path injection)', async () => {
    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await expect(
      submitFeedbackHandler(makeRequest({ debateId: 'AAPL v1', section: 'bullCase', rating: 'up' }, 'user-1'))
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('submitFeedback handler — write behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
      await fn({
        get: mockTransactionGet,
        set: mockTransactionSet,
        update: mockTransactionUpdate,
      });
    });
  });

  it('writes feedback to debates/{debateId}/feedback/{uid} on new rating', async () => {
    mockTransactionGet.mockResolvedValue({ exists: false, data: () => undefined });

    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    const result = await submitFeedbackHandler(
      makeRequest({ debateId: 'AAPL_v1', section: 'bullCase', rating: 'up' }, 'user-123')
    ) as { success: boolean };

    expect(result.success).toBe(true);
    expect(mockTransactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        section: 'bullCase',
        rating: 'up',
        uid: 'user-123',
      })
    );
  });

  it('upserts — updates existing feedback doc if user rated before', async () => {
    mockTransactionGet.mockResolvedValue({
      exists: true,
      data: () => ({ section: 'bullCase', rating: 'up', uid: 'user-123' }),
    });

    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    const result = await submitFeedbackHandler(
      makeRequest({ debateId: 'AAPL_v1', section: 'bullCase', rating: 'down' }, 'user-123')
    ) as { success: boolean };

    expect(result.success).toBe(true);
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rating: 'down' })
    );
  });

  it('updates feedbackSummary on parent debate doc (aggregate counts)', async () => {
    mockTransactionGet.mockResolvedValue({ exists: false, data: () => undefined });

    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    await submitFeedbackHandler(
      makeRequest({ debateId: 'AAPL_v1', section: 'bullCase', rating: 'up' }, 'user-123')
    );

    // Should update the parent doc with feedbackSummary
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        [`feedbackSummary.bullCase.up`]: expect.anything(),
      })
    );
  });

  it('returns { success: true } on valid submission', async () => {
    mockTransactionGet.mockResolvedValue({ exists: false, data: () => undefined });

    const { submitFeedbackHandler } = await import('../../functions/submitFeedback.js');
    const result = await submitFeedbackHandler(
      makeRequest({ debateId: 'AAPL_v1', section: 'synthesis', rating: 'up' }, 'user-abc')
    );

    expect(result).toEqual({ success: true });
  });
});
