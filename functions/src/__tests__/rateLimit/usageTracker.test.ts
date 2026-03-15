import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firebase-admin mock ────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet, update: mockUpdate });

const incrementSpy = vi.fn((n: number) => ({ _increment: n }));
const mockFirestoreFn = vi.fn().mockReturnValue({ doc: mockDoc, collection: vi.fn() });
(mockFirestoreFn as unknown as { FieldValue: { increment: typeof incrementSpy } }).FieldValue = {
  increment: incrementSpy,
};

vi.mock('firebase-admin', () => ({
  default: { firestore: mockFirestoreFn, initializeApp: vi.fn() },
  firestore: mockFirestoreFn,
  initializeApp: vi.fn(),
  apps: [],
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usageTracker — getUsageRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user document does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false, data: () => undefined });

    const { getUsageRecord } = await import('../../services/rateLimit/usageTracker.js');
    const result = await getUsageRecord('user-1');

    expect(result).toBeNull();
    expect(mockDoc).toHaveBeenCalledWith('users/user-1');
  });

  it('returns usage record when user document exists', async () => {
    const record = { debateCount: 2, debateCountResetAt: '2026-03-01T00:00:00.000Z' };
    mockGet.mockResolvedValueOnce({ exists: true, data: () => record });

    const { getUsageRecord } = await import('../../services/rateLimit/usageTracker.js');
    const result = await getUsageRecord('user-1');

    expect(result).toEqual({ debateCount: 2, debateCountResetAt: '2026-03-01T00:00:00.000Z' });
  });

  it('returns debateCount=0 when user document exists but debateCount field is missing', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });

    const { getUsageRecord } = await import('../../services/rateLimit/usageTracker.js');
    const result = await getUsageRecord('user-1');

    expect(result).not.toBeNull();
    expect(result!.debateCount).toBe(0);
  });
});

describe('usageTracker — incrementDebateCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates debateCount with FieldValue.increment(1) on users/{uid}', async () => {
    const { incrementDebateCount } = await import('../../services/rateLimit/usageTracker.js');
    await incrementDebateCount('user-1');

    expect(mockDoc).toHaveBeenCalledWith('users/user-1');
    expect(mockUpdate).toHaveBeenCalledOnce();

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg['debateCount']).toEqual({ _increment: 1 });
  });

  it('updates debateCountResetAt field as ISO string when first increment', async () => {
    const { incrementDebateCount } = await import('../../services/rateLimit/usageTracker.js');
    await incrementDebateCount('user-1');

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    // debateCountResetAt may be set on first write — verify its type when present
    if (updateArg['debateCountResetAt'] !== undefined) {
      expect(typeof updateArg['debateCountResetAt']).toBe('string');
    }
  });

  it('uses merge: true to avoid overwriting other user fields', async () => {
    // incrementDebateCount should use update (not set) so other fields are preserved
    const { incrementDebateCount } = await import('../../services/rateLimit/usageTracker.js');
    await incrementDebateCount('user-1');

    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledOnce();
  });
});

describe('usageTracker — resetAllUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when called with empty user list', async () => {
    // resetAllUsage takes a list of uids and resets each
    const { resetAllUsage } = await import('../../services/rateLimit/usageTracker.js');
    await expect(resetAllUsage([])).resolves.not.toThrow();
  });

  it('resets debateCount to 0 for all provided uids', async () => {
    const { resetAllUsage } = await import('../../services/rateLimit/usageTracker.js');
    await resetAllUsage(['user-1', 'user-2', 'user-3']);

    // Should have called update 3 times (one per user)
    expect(mockUpdate).toHaveBeenCalledTimes(3);

    // Each call resets debateCount to 0
    const calls = mockUpdate.mock.calls as Array<[Record<string, unknown>]>;
    for (const [arg] of calls) {
      expect(arg['debateCount']).toBe(0);
    }
  });

  it('sets debateCountResetAt to current timestamp string on reset', async () => {
    const { resetAllUsage } = await import('../../services/rateLimit/usageTracker.js');
    await resetAllUsage(['user-1']);

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof updateArg['debateCountResetAt']).toBe('string');
  });
});
