import { describe, it, expect } from 'vitest';

/**
 * Tests for LLM types — verifying the shape of interfaces at runtime
 * via objects that satisfy them.
 */
describe('LLMOptions', () => {
  it('accepts all required and optional fields', async () => {
    const { isValidLLMOptions } = await import('../../services/llm/types.js');

    const options = {
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 1024,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant.',
    };

    expect(isValidLLMOptions(options)).toBe(true);
  });

  it('requires at least maxTokens', async () => {
    const { isValidLLMOptions } = await import('../../services/llm/types.js');

    expect(isValidLLMOptions({ maxTokens: 512 })).toBe(true);
    expect(isValidLLMOptions({})).toBe(false);
  });
});

describe('LLMResponse', () => {
  it('contains content, model, and usage fields', async () => {
    const { isValidLLMResponse } = await import('../../services/llm/types.js');

    const response = {
      content: 'Hello, world!',
      model: 'claude-3-5-haiku-20241022',
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        estimatedCost: 0.0000063,
      },
    };

    expect(isValidLLMResponse(response)).toBe(true);
  });

  it('rejects response missing required fields', async () => {
    const { isValidLLMResponse } = await import('../../services/llm/types.js');

    expect(isValidLLMResponse({ content: 'hi' })).toBe(false);
    expect(isValidLLMResponse({ model: 'x', usage: { inputTokens: 1, outputTokens: 1, estimatedCost: 0 } })).toBe(false);
  });
});
