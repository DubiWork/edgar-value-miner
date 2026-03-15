import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMOptions, LLMResponse } from './types.js';

/** Haiku pricing per 1M tokens (USD) */
const HAIKU_INPUT_COST_PER_M = 0.25;
const HAIKU_OUTPUT_COST_PER_M = 1.25;

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Use Haiku pricing for the default model; same pricing for any unrecognised model as a safe default
  void model;
  return (
    (inputTokens / 1_000_000) * HAIKU_INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_COST_PER_M
  );
}

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateCompletion(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    const model = options.model ?? DEFAULT_MODEL;

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature ?? 0.7,
      ...(options.systemPrompt
        ? { system: options.systemPrompt }
        : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const content = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const estimatedCost = estimateCost(model, inputTokens, outputTokens);

    return {
      content,
      model: response.model,
      usage: { inputTokens, outputTokens, estimatedCost },
    };
  }
}
