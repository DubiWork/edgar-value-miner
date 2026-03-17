import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-admin before importing costTracker
vi.mock('firebase-admin', () => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
  const mockFirestore = vi.fn().mockReturnValue({
    collection: mockCollection,
  });
  return {
    default: { firestore: mockFirestore, initializeApp: vi.fn() },
    firestore: mockFirestore,
    initializeApp: vi.fn(),
    apps: [],
  };
});

describe('CostTracker', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LLM_DAILY_BUDGET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('logs usage to Firestore collection llm_usage', async () => {
    const admin = await import('firebase-admin');
    const firestoreMock = admin.firestore as unknown as ReturnType<typeof vi.fn>;
    const collectionMock = firestoreMock().collection as ReturnType<typeof vi.fn>;
    const docMock = collectionMock().doc as ReturnType<typeof vi.fn>;
    const setMock = docMock().set as ReturnType<typeof vi.fn>;

    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const tracker = new CostTracker();

    await tracker.logUsage({
      model: 'claude-3-5-haiku-20241022',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.0000875,
    });

    expect(collectionMock).toHaveBeenCalledWith('llm_usage');
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-5-haiku-20241022',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0.0000875,
      })
    );
  });

  it('allows a request when daily usage is below budget', async () => {
    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const tracker = new CostTracker();

    // Simulate $2 already spent today
    tracker._setDailyUsageForTest(2.0);

    // Default dev budget is $10
    await expect(tracker.checkBudget(0.5)).resolves.not.toThrow();
  });

  it('rejects a request when daily budget cap is reached', async () => {
    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const tracker = new CostTracker();

    // Simulate $9.80 already spent today (dev budget $10)
    tracker._setDailyUsageForTest(9.80);

    await expect(tracker.checkBudget(0.5)).rejects.toThrow(/daily budget/i);
  });

  it('respects LLM_DAILY_BUDGET env var override', async () => {
    process.env.LLM_DAILY_BUDGET = '5';

    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const tracker = new CostTracker();

    tracker._setDailyUsageForTest(4.8);

    await expect(tracker.checkBudget(0.5)).rejects.toThrow(/daily budget/i);
  });

  it('uses $10 default dev budget when env var is not set', async () => {
    delete process.env.LLM_DAILY_BUDGET;

    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const tracker = new CostTracker();

    tracker._setDailyUsageForTest(9.0);

    // $9.00 + $0.50 = $9.50 — still under $10
    await expect(tracker.checkBudget(0.5)).resolves.not.toThrow();
  });

  it('accumulates usage after each logUsage call', async () => {
    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const tracker = new CostTracker();

    tracker._setDailyUsageForTest(0);

    await tracker.logUsage({ model: 'claude-3-5-haiku-20241022', inputTokens: 100, outputTokens: 50, estimatedCost: 3.0 });
    await tracker.logUsage({ model: 'claude-3-5-haiku-20241022', inputTokens: 100, outputTokens: 50, estimatedCost: 3.0 });
    await tracker.logUsage({ model: 'claude-3-5-haiku-20241022', inputTokens: 100, outputTokens: 50, estimatedCost: 3.0 });

    // $9.00 spent. Next $2 request should be rejected
    await expect(tracker.checkBudget(2.0)).rejects.toThrow(/daily budget/i);
  });
});
