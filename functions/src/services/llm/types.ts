/**
 * LLM abstraction layer — core types and interfaces.
 */

export interface LLMOptions {
  /** Model identifier (e.g. 'claude-3-5-haiku-20241022'). Provider uses its default when omitted. */
  model?: string;
  /** Maximum tokens to generate in the response. Required. */
  maxTokens: number;
  /** Sampling temperature 0–1. Default: 0.7 */
  temperature?: number;
  /** System prompt to set context for the model. */
  systemPrompt?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: TokenUsage;
}

export interface LLMProvider {
  generateCompletion(prompt: string, options: LLMOptions): Promise<LLMResponse>;
}

/** Runtime guard — verifies an object satisfies LLMOptions. */
export function isValidLLMOptions(obj: unknown): obj is LLMOptions {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o['maxTokens'] === 'number';
}

/** Runtime guard — verifies an object satisfies LLMResponse. */
export function isValidLLMResponse(obj: unknown): obj is LLMResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o['content'] !== 'string') return false;
  if (typeof o['model'] !== 'string') return false;
  if (typeof o['usage'] !== 'object' || o['usage'] === null) return false;
  const u = o['usage'] as Record<string, unknown>;
  return (
    typeof u['inputTokens'] === 'number' &&
    typeof u['outputTokens'] === 'number' &&
    typeof u['estimatedCost'] === 'number'
  );
}
