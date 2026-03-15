import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK before importing the provider
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  const MockAnthropic = vi.fn(() => ({
    messages: { create: mockCreate },
  }));
  (MockAnthropic as unknown as { _mockCreate: typeof mockCreate })._mockCreate = mockCreate;
  return { default: MockAnthropic, Anthropic: MockAnthropic };
});

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Provide a fake API key
    process.env.ANTHROPIC_API_KEY = 'test-key-abc123';
  });

  it('calls the Anthropic messages.create with correct parameters', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as () => { messages: { create: ReturnType<typeof vi.fn> } })();
    const mockCreate = instance.messages.create;
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Bull case: strong revenue growth.' }],
      model: 'claude-3-5-haiku-20241022',
      usage: { input_tokens: 50, output_tokens: 30 },
    });

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const provider = new AnthropicProvider();

    const result = await provider.generateCompletion('Analyze AAPL', {
      maxTokens: 256,
      temperature: 0.5,
      systemPrompt: 'You are a financial analyst.',
    });

    expect(result.content).toBe('Bull case: strong revenue growth.');
    expect(result.model).toBe('claude-3-5-haiku-20241022');
    expect(result.usage.inputTokens).toBe(50);
    expect(result.usage.outputTokens).toBe(30);
    expect(result.usage.estimatedCost).toBeGreaterThan(0);
  });

  it('uses claude-3-5-haiku-20241022 as the default model', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as () => { messages: { create: ReturnType<typeof vi.fn> } })();
    const mockCreate = instance.messages.create;
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Response text' }],
      model: 'claude-3-5-haiku-20241022',
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const provider = new AnthropicProvider();
    await provider.generateCompletion('test prompt', { maxTokens: 100 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-haiku-20241022' })
    );
  });

  it('allows overriding the model via options', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as () => { messages: { create: ReturnType<typeof vi.fn> } })();
    const mockCreate = instance.messages.create;
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Response' }],
      model: 'claude-3-5-sonnet-20241022',
      usage: { input_tokens: 20, output_tokens: 15 },
    });

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const provider = new AnthropicProvider();
    await provider.generateCompletion('test', { maxTokens: 100, model: 'claude-3-5-sonnet-20241022' });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-sonnet-20241022' })
    );
  });

  it('throws a structured error when the API call fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as () => { messages: { create: ReturnType<typeof vi.fn> } })();
    const mockCreate = instance.messages.create;
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const provider = new AnthropicProvider();

    await expect(
      provider.generateCompletion('test', { maxTokens: 100 })
    ).rejects.toThrow('API rate limit exceeded');
  });

  it('estimates cost based on Haiku pricing ($0.25/$1.25 per 1M tokens)', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as () => { messages: { create: ReturnType<typeof vi.fn> } })();
    const mockCreate = instance.messages.create;
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Result' }],
      model: 'claude-3-5-haiku-20241022',
      usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 },
    });

    const { AnthropicProvider } = await import('../../services/llm/anthropicProvider.js');
    const provider = new AnthropicProvider();
    const result = await provider.generateCompletion('test', { maxTokens: 2000 });

    // $0.25 input + $1.25 output = $1.50 for 1M each
    expect(result.usage.estimatedCost).toBeCloseTo(1.5, 2);
  });
});
