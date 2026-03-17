import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mutable snapshot used by the firebase-admin mock ─────────────────────────
let currentSnapshot: { empty: boolean; docs: Array<{ id: string }>; size: number } = {
  empty: true,
  docs: [],
  size: 0,
};

// ── Firebase-admin mock ────────────────────────────────────────────────────────
vi.mock('firebase-admin', () => {
  const mockFirestoreFn = vi.fn().mockReturnValue({
    collection: vi.fn().mockReturnValue({
      get: () => Promise.resolve(currentSnapshot),
    }),
    doc: vi.fn().mockReturnValue({
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    default: { firestore: mockFirestoreFn, initializeApp: vi.fn() },
    firestore: mockFirestoreFn,
    initializeApp: vi.fn(),
    apps: [],
  };
});

// ── firebase-functions mock ───────────────────────────────────────────────────
vi.mock('firebase-functions', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  scheduler: {
    onSchedule: vi.fn().mockReturnValue({}),
  },
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

// ── usageTracker mock ──────────────────────────────────────────────────────────
const mockResetAllUsage = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/rateLimit/usageTracker.js', () => ({
  getUsageRecord: vi.fn(),
  incrementDebateCount: vi.fn().mockResolvedValue(undefined),
  resetAllUsage: mockResetAllUsage,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('monthlyUsageReset — handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetAllUsage.mockResolvedValue(undefined);
    currentSnapshot = { empty: true, docs: [], size: 0 };
  });

  it('calls resetAllUsage with empty array when no users exist', async () => {
    currentSnapshot = { empty: true, docs: [], size: 0 };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    expect(mockResetAllUsage).toHaveBeenCalledWith([]);
  });

  it('calls resetAllUsage with all user IDs from snapshot', async () => {
    currentSnapshot = {
      empty: false,
      docs: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
      size: 3,
    };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    expect(mockResetAllUsage).toHaveBeenCalledWith(['user-1', 'user-2', 'user-3']);
  });

  it('processes users in batches of 500', async () => {
    currentSnapshot = {
      empty: false,
      docs: Array.from({ length: 501 }, (_, i) => ({ id: `user-${i}` })),
      size: 501,
    };

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    // resetAllUsage should be called twice: batch of 500, then batch of 1
    expect(mockResetAllUsage).toHaveBeenCalledTimes(2);

    const firstBatch = mockResetAllUsage.mock.calls[0][0] as string[];
    const secondBatch = mockResetAllUsage.mock.calls[1][0] as string[];
    expect(firstBatch.length).toBe(500);
    expect(secondBatch.length).toBe(1);
  });

  it('does not throw when resetAllUsage rejects — logs error and continues', async () => {
    currentSnapshot = {
      empty: false,
      docs: [{ id: 'user-1' }, { id: 'user-2' }],
      size: 2,
    };

    mockResetAllUsage.mockRejectedValueOnce(new Error('Firestore batch failed'));

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await expect(monthlyUsageResetHandler()).resolves.not.toThrow();
  });

  it('fetches users from the users collection (not another collection)', async () => {
    currentSnapshot = { empty: true, docs: [], size: 0 };

    const adminModule = await import('firebase-admin');
    const firestoreInstance = adminModule.firestore();

    const { monthlyUsageResetHandler } = await import('../../functions/monthlyUsageReset.js');
    await monthlyUsageResetHandler();

    expect(firestoreInstance.collection).toHaveBeenCalledWith('users');
  });
});
