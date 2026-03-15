import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase-admin for costTracker dependency
vi.mock('firebase-admin', () => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
  const mockFirestore = vi.fn().mockReturnValue({ collection: mockCollection });
  return {
    default: { firestore: mockFirestore, initializeApp: vi.fn() },
    firestore: mockFirestore,
    initializeApp: vi.fn(),
    apps: [],
  };
});

// Mock AnthropicProvider
vi.mock('../../services/llm/anthropicProvider.js', () => {
  const mockGenerateCompletion = vi.fn();
  const MockAnthropicProvider = vi.fn().mockImplementation(() => ({
    generateCompletion: mockGenerateCompletion,
  }));
  (MockAnthropicProvider as unknown as { _mockGenerate: typeof mockGenerateCompletion })._mockGenerate = mockGenerateCompletion;
  return { AnthropicProvider: MockAnthropicProvider };
});

// Mock CostTracker
vi.mock('../../services/llm/costTracker.js', () => {
  const mockCheckBudget = vi.fn().mockResolvedValue(undefined);
  const mockLogUsage = vi.fn().mockResolvedValue(undefined);
  const MockCostTracker = vi.fn().mockImplementation(() => ({
    checkBudget: mockCheckBudget,
    logUsage: mockLogUsage,
    _setDailyUsageForTest: vi.fn(),
  }));
  (MockCostTracker as unknown as { _mockCheckBudget: typeof mockCheckBudget; _mockLogUsage: typeof mockLogUsage })._mockCheckBudget = mockCheckBudget;
  (MockCostTracker as unknown as { _mockLogUsage: typeof mockLogUsage })._mockLogUsage = mockLogUsage;
  return { CostTracker: MockCostTracker };
});

describe('LLMService — provider selection', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LLM_KILL_SWITCH;
    delete process.env.LLM_PROVIDER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('selects AnthropicProvider when LLM_PROVIDER=anthropic', async () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;
    mockGenerate.mockResolvedValueOnce({
      content: 'response text',
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 10, outputTokens: 5, estimatedCost: 0.000005 },
    });

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();
    const result = await service.generateCompletion('test prompt', { maxTokens: 100 });

    expect(AnthropicProvider).toHaveBeenCalledOnce();
    expect(result.content).toBe('response text');
  });

  it('selects AnthropicProvider by default (no LLM_PROVIDER set)', async () => {
    delete process.env.LLM_PROVIDER;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;
    mockGenerate.mockResolvedValueOnce({
      content: 'default response',
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 10, outputTokens: 5, estimatedCost: 0.000005 },
    });

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();
    await service.generateCompletion('test', { maxTokens: 100 });

    expect(AnthropicProvider).toHaveBeenCalledOnce();
  });
});

describe('LLMService — kill switch', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects all requests when LLM_KILL_SWITCH=true', async () => {
    process.env.LLM_KILL_SWITCH = 'true';

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();

    await expect(
      service.generateCompletion('test', { maxTokens: 100 })
    ).rejects.toThrow(/kill switch/i);
  });

  it('allows requests when LLM_KILL_SWITCH is not set', async () => {
    delete process.env.LLM_KILL_SWITCH;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;
    mockGenerate.mockResolvedValueOnce({
      content: 'ok',
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 5, outputTokens: 3, estimatedCost: 0.000003 },
    });

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();

    await expect(service.generateCompletion('test', { maxTokens: 100 })).resolves.toBeDefined();
  });
});

describe('LLMService — retry logic', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LLM_KILL_SWITCH;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('retries up to 2 times on transient failure then succeeds', async () => {
    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;

    // Fail twice, succeed on third
    mockGenerate
      .mockRejectedValueOnce(new Error('transient error 1'))
      .mockRejectedValueOnce(new Error('transient error 2'))
      .mockResolvedValueOnce({
        content: 'finally worked',
        model: 'claude-3-5-haiku-20241022',
        usage: { inputTokens: 10, outputTokens: 5, estimatedCost: 0.000005 },
      });

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();

    const result = await service.generateCompletion('test', { maxTokens: 100 });

    expect(result.content).toBe('finally worked');
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all retries (3 total attempts)', async () => {
    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;

    mockGenerate
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();

    await expect(service.generateCompletion('test', { maxTokens: 100 })).rejects.toThrow('fail 3');
    expect(mockGenerate).toHaveBeenCalledTimes(3);
  });
});

describe('LLMService — timeout', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LLM_KILL_SWITCH;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects with timeout error when request exceeds the configured timeout', async () => {
    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;

    // Never resolves — attach a no-op catch to suppress unhandled rejection
    mockGenerate.mockImplementation(() => {
      const p = new Promise<never>(() => { /* intentionally never resolves */ });
      p.catch(() => { /* suppress unhandled rejection */ });
      return p;
    });

    const { LLMService } = await import('../../services/llm/llmService.js');
    // Inject a very short 50ms timeout to keep test fast
    const service = new LLMService(50);

    await expect(
      service.generateCompletion('test', { maxTokens: 100 })
    ).rejects.toThrow(/timeout/i);
  }, 10_000);
});

describe('LLMService — cost tracking integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LLM_KILL_SWITCH;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('calls costTracker.checkBudget before making an LLM call', async () => {
    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const mockCheckBudget = (CostTracker as unknown as { _mockCheckBudget: ReturnType<typeof vi.fn> })._mockCheckBudget;

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;
    mockGenerate.mockResolvedValueOnce({
      content: 'ok',
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 5, outputTokens: 3, estimatedCost: 0.000003 },
    });

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();
    await service.generateCompletion('test', { maxTokens: 100 });

    expect(mockCheckBudget).toHaveBeenCalledOnce();
  });

  it('calls costTracker.logUsage after a successful call', async () => {
    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const mockLogUsage = (CostTracker as unknown as { _mockLogUsage: ReturnType<typeof vi.fn> })._mockLogUsage;

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const mockGenerate = (AnthropicProvider as unknown as { _mockGenerate: ReturnType<typeof vi.fn> })._mockGenerate;
    mockGenerate.mockResolvedValueOnce({
      content: 'logged',
      model: 'claude-3-5-haiku-20241022',
      usage: { inputTokens: 20, outputTokens: 10, estimatedCost: 0.00001750 },
    });

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();
    await service.generateCompletion('test', { maxTokens: 100 });

    expect(mockLogUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3-5-haiku-20241022',
        inputTokens: 20,
        outputTokens: 10,
      })
    );
  });

  it('rejects immediately when budget cap is reached', async () => {
    const { CostTracker } = await import('../../services/llm/costTracker.js');
    const mockCheckBudget = (CostTracker as unknown as { _mockCheckBudget: ReturnType<typeof vi.fn> })._mockCheckBudget;
    mockCheckBudget.mockRejectedValueOnce(new Error('daily budget cap reached'));

    const { LLMService } = await import('../../services/llm/llmService.js');
    const service = new LLMService();

    await expect(
      service.generateCompletion('test', { maxTokens: 100 })
    ).rejects.toThrow(/daily budget cap reached/i);
  });
});
