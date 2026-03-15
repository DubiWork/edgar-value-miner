import type { LLMProvider, LLMOptions, LLMResponse } from './types.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { CostTracker } from './costTracker.js';

const MAX_RETRIES = 2; // 1 initial attempt + 2 retries = 3 total
const DEFAULT_TIMEOUT_MS = 30_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM request timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err); }
    );
  });
}

function selectProvider(): LLMProvider {
  const providerName = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  // Only anthropic is supported for MVP; extend here for additional providers
  void providerName;
  return new AnthropicProvider();
}

export class LLMService {
  private readonly provider: LLMProvider;
  private readonly costTracker: CostTracker;
  private readonly timeoutMs: number;

  constructor(timeoutMs?: number) {
    this.provider = selectProvider();
    this.costTracker = new CostTracker();
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async generateCompletion(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    if (process.env.LLM_KILL_SWITCH === 'true') {
      throw new Error('LLM kill switch is enabled — all LLM calls are disabled.');
    }

    // Estimate cost before sending (rough pre-check; actual check uses real token count)
    // We do a lightweight check with 0 to just verify budget not already exhausted
    await this.costTracker.checkBudget(0);

    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await withTimeout(
          this.provider.generateCompletion(prompt, options),
          this.timeoutMs
        );

        // Log actual usage after success
        await this.costTracker.logUsage({
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          estimatedCost: response.usage.estimatedCost,
        });

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry if kill switch or budget errors
        if (
          lastError.message.includes('kill switch') ||
          lastError.message.toLowerCase().includes('daily budget')
        ) {
          throw lastError;
        }

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s
          await delay(1000 * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }
}
