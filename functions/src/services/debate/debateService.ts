import { LLMService } from '../llm/llmService.js';
import {
  buildBullCasePrompt,
  BULL_CASE_OPTIONS,
  buildBearCasePrompt,
  BEAR_CASE_OPTIONS,
  buildSynthesisPrompt,
  SYNTHESIS_OPTIONS,
} from '../prompts/index.js';
import {
  validateBullCase,
  validateBearCase,
  validateSynthesis,
} from '../prompts/validation.js';
import type { BullCase, BearCase, Synthesis } from '../prompts/types.js';
import { isAiDebateEnabled } from '../../config/featureFlags.js';
import {
  readDebate,
  writeDebate,
  incrementViewCount,
  isCacheValid,
} from './cacheManager.js';
import type { CachedDebate, DebateResponse, CallerContext } from './types.js';
import { RateLimitService } from '../rateLimit/rateLimitService.js';
import { incrementDebateCount } from '../rateLimit/usageTracker.js';
import type { UserTier } from '../rateLimit/types.js';

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const DEBATE_VERSION = 1;

/**
 * Placeholder financial data for MVP.
 * In a future phase this will be fetched from SEC EDGAR / a data service.
 */
function buildPlaceholderFinancialData(ticker: string): string {
  return `Financial data for ${ticker} — placeholder for MVP. Real EDGAR data integration is Phase D+.`;
}

function buildPlaceholderFilingContext(ticker: string): string {
  return `SEC filing context for ${ticker} — placeholder for MVP.`;
}

function parseJsonSafe(raw: string): unknown {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

export class DebateService {
  private readonly llm: LLMService;
  private readonly rateLimiter: RateLimitService;

  constructor(llm?: LLMService, rateLimiter?: RateLimitService) {
    this.llm = llm ?? new LLMService();
    this.rateLimiter = rateLimiter ?? new RateLimitService();
  }

  /**
   * Primary debate flow: cache-first with optional fresh generation.
   *
   * 1. Check Firestore for a valid cached debate.
   * 2a. Cache hit  → increment viewCount, return cached (no rate limit check).
   * 2b. Cache miss → gate on auth + feature flag + rate limit → generate → cache → return.
   */
  async getOrGenerate(
    ticker: string,
    companyName: string,
    caller: CallerContext
  ): Promise<DebateResponse> {
    const normalizedTicker = ticker.toUpperCase();

    // Check cache first — cached access is never rate-limited
    const cached = await readDebate(normalizedTicker);
    if (cached && isCacheValid(cached)) {
      // Fire-and-forget the viewCount increment (non-critical)
      incrementViewCount(normalizedTicker).catch(() => { /* best effort */ });

      return this.toResponse(cached, 'cached');
    }

    // Cache miss — generation requires authentication
    if (!caller.isAuthenticated) {
      throw Object.assign(new Error('Authentication required to generate a fresh debate.'), {
        code: 'unauthenticated',
        retryable: false,
      });
    }

    // Check feature flag
    if (!isAiDebateEnabled()) {
      throw Object.assign(new Error('AI debate feature is currently disabled.'), {
        code: 'feature-disabled',
        retryable: false,
      });
    }

    // Check rate limit before generating
    const tier: UserTier = caller.tier ?? 'free';
    const rateLimitResult = await this.rateLimiter.checkRateLimit(caller.uid, tier);
    if (!rateLimitResult.allowed) {
      throw Object.assign(new Error('Rate limit exceeded.'), {
        code: 'rate-limited',
        currentCount: rateLimitResult.currentCount,
        maxCount: rateLimitResult.maxCount,
        upgradeUrl: rateLimitResult.upgradeUrl,
        retryable: false,
      });
    }

    // Generate fresh debate
    const freshDebate = await this.generate(normalizedTicker, companyName);

    // Persist to Firestore (don't let a cache write failure block the response)
    writeDebate(freshDebate).catch(() => { /* best effort — log in future */ });

    // Count this initial view
    incrementViewCount(normalizedTicker).catch(() => { /* best effort */ });

    // Increment debate count (fire-and-forget — non-critical)
    if (caller.uid !== null) {
      Promise.resolve(incrementDebateCount(caller.uid)).catch(() => { /* best effort */ });
    }

    return this.toResponse(freshDebate, 'generated');
  }

  private async generate(ticker: string, companyName: string): Promise<CachedDebate> {
    const financialData = buildPlaceholderFinancialData(ticker);
    const filingContext = buildPlaceholderFilingContext(ticker);
    const now = new Date().toISOString();

    // ── Bull Case ──────────────────────────────────────────────────────────────
    const bullPrompt = buildBullCasePrompt({ ticker, companyName, financialData, filingContext });
    const bullResponse = await this.llm.generateCompletion(bullPrompt, BULL_CASE_OPTIONS);
    const bullParsed = parseJsonSafe(bullResponse.content);
    const bullValidation = validateBullCase(bullParsed, companyName);
    if (!bullValidation.valid) {
      throw Object.assign(
        new Error(`Bull case validation failed: ${bullValidation.errors.join(', ')}`),
        { code: 'generation-failed', retryable: true }
      );
    }
    const bullCase = bullParsed as BullCase;

    // ── Bear Case ──────────────────────────────────────────────────────────────
    const bearPrompt = buildBearCasePrompt({ ticker, companyName, financialData, filingContext });
    const bearResponse = await this.llm.generateCompletion(bearPrompt, BEAR_CASE_OPTIONS);
    const bearParsed = parseJsonSafe(bearResponse.content);
    const bearValidation = validateBearCase(bearParsed, companyName);
    if (!bearValidation.valid) {
      throw Object.assign(
        new Error(`Bear case validation failed: ${bearValidation.errors.join(', ')}`),
        { code: 'generation-failed', retryable: true }
      );
    }
    const bearCase = bearParsed as BearCase;

    // ── Synthesis ──────────────────────────────────────────────────────────────
    const synthPrompt = buildSynthesisPrompt({
      bullCaseJson: JSON.stringify(bullCase),
      bearCaseJson: JSON.stringify(bearCase),
      financialData,
    });
    const synthResponse = await this.llm.generateCompletion(synthPrompt, SYNTHESIS_OPTIONS);
    const synthParsed = parseJsonSafe(synthResponse.content);
    const synthValidation = validateSynthesis(synthParsed);
    if (!synthValidation.valid) {
      throw Object.assign(
        new Error(`Synthesis validation failed: ${synthValidation.errors.join(', ')}`),
        { code: 'generation-failed', retryable: true }
      );
    }
    const synthesis = synthParsed as Synthesis;

    return {
      ticker,
      companyName,
      bullCase,
      bearCase,
      synthesis,
      generatedAt: now,
      version: DEBATE_VERSION,
      viewCount: 0,
      lastViewedAt: null,
      model: bullResponse.model ?? DEFAULT_MODEL,
    };
  }

  private toResponse(debate: CachedDebate, source: 'cached' | 'generated'): DebateResponse {
    return {
      ticker: debate.ticker,
      companyName: debate.companyName,
      generatedAt: debate.generatedAt,
      bullCase: debate.bullCase,
      bearCase: debate.bearCase,
      synthesis: debate.synthesis,
      metadata: {
        model: debate.model,
        version: debate.version,
        viewCount: debate.viewCount,
      },
      source,
    };
  }
}
