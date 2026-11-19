import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttpsCallable, mockFunctions } = vi.hoisted(() => ({
  mockHttpsCallable: vi.fn(),
  mockFunctions: { _isMockFunctions: true },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
  getFunctions: vi.fn(() => mockFunctions),
  connectFunctionsEmulator: vi.fn(),
}));

vi.mock('../../lib/firebase.js', () => ({
  default: {},
  functions: mockFunctions,
  db: {},
  auth: {},
}));

import {
  getOrFetchCompanySummary,
  getCachedSummary,
  setCachedSummary,
  invalidateCachedSummary,
  normalizeMoat,
  normalizeBusinessInfographic,
  normalizeCompetitors,
  normalizeGlossary,
  resolveTraitDisplay,
  translateSummaryOnDemand,
  CANONICAL_MOAT_SOURCES,
} from '../aiSummaryService.js';
import llmFactory from '../llm/llmFactory.js';
import geminiAdapter from '../llm/geminiAdapter.js';
import openAiAdapter from '../llm/openAiAdapter.js';
import claudeAdapter from '../llm/claudeAdapter.js';

describe('llmFactory & Adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns geminiAdapter by default or when gemini is selected', () => {
    const provider = llmFactory.getProvider('gemini');
    expect(provider).toBe(geminiAdapter);
    expect(typeof provider.generateJSON).toBe('function');
    expect(provider.requiresApiKey).toBe(false);
  });

  it('invokes generateAiSummary Firebase Cloud Function and parses JSON (including fenced blocks)', async () => {
    const mockCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: '```json\n{"summary":"סיכום מ-Vertex AI","keyEngines":["Cloud","AI"]}\n```',
      },
    });
    mockHttpsCallable.mockReturnValueOnce(mockCallable);

    const parsed = await geminiAdapter.generateJSON('Summarize MSFT');
    expect(mockHttpsCallable).toHaveBeenCalledWith(mockFunctions, 'generateAiSummary');
    expect(mockCallable).toHaveBeenCalledWith({ prompt: 'Summarize MSFT' });
    expect(parsed).toEqual({
      summary: 'סיכום מ-Vertex AI',
      keyEngines: ['Cloud', 'AI'],
    });
  });

  it('returns openAiAdapter and throws Not Implemented on generateJSON', async () => {
    const provider = llmFactory.getProvider('openai');
    expect(provider).toBe(openAiAdapter);
    await expect(provider.generateJSON('prompt', 'key')).rejects.toThrow(/Not Implemented/i);
  });

  it('returns claudeAdapter and throws Not Implemented on generateJSON', async () => {
    const provider = llmFactory.getProvider('claude');
    expect(provider).toBe(claudeAdapter);
    await expect(provider.generateJSON('prompt', 'key')).rejects.toThrow(/Not Implemented/i);
  });
});

describe('aiSummaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached summary immediately if already in cache', async () => {
    const testTicker = 'TEST1';
    const testData = {
      ticker: testTicker,
      summary: 'סיכום לבדיקה',
      keyEngines: ['Engine 1', 'Engine 2'],
    };

    await setCachedSummary(testTicker, testData);

    const result = await getOrFetchCompanySummary(testTicker);
    expect(result.summary).toBe('סיכום לבדיקה');
    expect(result.source).toBe('cache');
    expect(result.keyEngines).toEqual(['Engine 1', 'Engine 2']);
  });

  it('returns dynamic mock for marquee tickers (MSFT, AAPL, etc.) when Cloud Function rejects', async () => {
    mockHttpsCallable.mockReturnValue(() => Promise.reject(new Error('Offline')));

    const result = await getOrFetchCompanySummary('AAPL');

    expect(result.ticker).toBe('AAPL');
    expect(result.summary).toContain('אפל');
    expect(result.keyEngines.length).toBeGreaterThanOrEqual(3);

    // Since it was cached during first call, second call is immediate
    const secondCall = await getOrFetchCompanySummary('AAPL');
    expect(secondCall.source).toBe('cache');
  }, 10000);

  it('generates dynamic mock containing ticker name for any custom ticker', async () => {
    mockHttpsCallable.mockReturnValue(() => Promise.reject(new Error('Offline')));

    const customTicker = 'XYZCORP';
    const result = await getOrFetchCompanySummary(customTicker, { name: 'XYZ Innovations' });

    expect(result.ticker).toBe(customTicker);
    expect(result.summary).toContain(customTicker);
    expect(result.keyEngines).toContain(`${customTicker} Core Products`);
  }, 10000);

  it('invalidates cached summary and fetches fresh from Vertex AI when forceRefresh is true', async () => {
    const ticker = 'NVDA';
    await setCachedSummary(ticker, {
      ticker,
      summary: 'תקציר ישן מהמטמון',
      keyEngines: ['Old Engine'],
      source: 'mock-preset',
    });

    const cachedFirst = await getOrFetchCompanySummary(ticker);
    expect(cachedFirst.source).toBe('cache');
    expect(cachedFirst.summary).toBe('תקציר ישן מהמטמון');

    const mockCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: JSON.stringify({
          summary: 'תקציר חי חדש מ-Vertex AI עבור אנבידיה',
          keyEngines: ['Blackwell AI', 'CUDA'],
        }),
      },
    });
    mockHttpsCallable.mockReturnValueOnce(mockCallable);

    const freshResult = await getOrFetchCompanySummary(
      ticker,
      { name: 'NVIDIA Corp' },
      { forceRefresh: true }
    );
    expect(freshResult.source).toBe('ai-live');
    expect(freshResult.summary).toBe('תקציר חי חדש מ-Vertex AI עבור אנבידיה');

    await invalidateCachedSummary(ticker);
    const afterInvalidate = await getCachedSummary(ticker);
    expect(afterInvalidate).toBeNull();
  });

  it('preserves existing cached summary when forceRefresh is blocked by AI_BUDGET_EXHAUSTED', async () => {
    const ticker = 'AMZN';
    await setCachedSummary(ticker, {
      ticker,
      summary: 'תקציר אמזון קיים במטמון',
      keyEngines: ['AWS', 'Prime'],
      source: 'ai-live',
    });

    mockHttpsCallable.mockReturnValueOnce(() =>
      Promise.reject(new Error('AI_BUDGET_EXHAUSTED: תקציב ה-AI החודשי תם'))
    );

    const result = await getOrFetchCompanySummary(
      ticker,
      { name: 'Amazon.com Inc.' },
      { forceRefresh: true }
    );

    expect(result.summary).toBe('תקציר אמזון קיים במטמון');
    expect(result.source).toBe('cache');
    expect(result.budgetExhausted).toBe(true);
  });

  it('normalizes any moat object to all 5 canonical categories with deterministic X/5 score', () => {
    const partial = {
      rating: 'Wide Moat',
      score: '5/5', // intentionally mismatched from 3 active inputs
      sources: [
        { name: 'Switching Costs', active: true, rationale: 'High enterprise lock-in' },
        { name: 'Network Effects', active: true, rationale: 'Platform effects' },
        { name: 'Intangible Assets', active: true, rationale: 'Strong brand' },
      ],
    };

    const normalized = normalizeMoat(partial, 'TestCo', 'he');
    expect(normalized.sources).toHaveLength(CANONICAL_MOAT_SOURCES.length);
    expect(normalized.sources).toHaveLength(5);
    expect(normalized.score).toBe('3/5');
    expect(normalized.sources.map((s) => s.name)).toEqual([
      'Switching Costs',
      'Network Effects',
      'Cost Advantage',
      'Intangible Assets',
      'Efficient Scale',
    ]);
    expect(normalized.sources.find((s) => s.name === 'Efficient Scale').active).toBe(false);
  });

  it('resolves both legacy English string traits and structured bilingual trait objects into Hebrew labels and explanations', () => {
    const legacy = resolveTraitDisplay('Recurring SaaS & consumption-based cloud', 'he');
    expect(legacy.displayLabel).toContain('הכנסות חוזרות');
    expect(legacy.explanation).toMatch(/SaaS|מנוי|שימוש/);

    const structured = resolveTraitDisplay(
      {
        label: 'B2B & B2C',
        labelHe: 'מכירה לארגונים וצרכנים (B2B & B2C)',
        explanationHe: 'שילוב מכירות לחברות ולקהל הרחב.',
        explanationEn: 'Balanced enterprise and consumer mix.',
      },
      'he'
    );
    expect(structured.displayLabel).toBe('מכירה לארגונים וצרכנים (B2B & B2C)');
    expect(structured.explanation).toBe('שילוב מכירות לחברות ולקהל הרחב.');
  });

  it('flags legacy generic fallback English cache entries and preserves HE↔EN moat parity during on-demand translation', async () => {
    const ticker = 'AAL';
    await setCachedSummary(ticker, {
      ticker,
      summary: 'אמריקן איירליינס היא חברת תעופה גדולה המפעילה טיסות פנים וטיסות בינלאומיות.',
      keyEngines: ['Passenger Air Travel', 'Cargo Services'],
      moat: {
        rating: 'Narrow Moat',
        score: '1/5',
        summary: 'חפיר צר המבוסס על סלוטים בשדות תעופה.',
        sources: [{ name: 'Intangible Assets', active: true, rationale: 'סלוטים בשדות תעופה מרכזיים.' }],
      },
      translations: {
        en: {
          summary:
            'American Airlines (AAL) operates as a leading provider of products and services in its industry, generating revenue through direct sales.',
        },
      },
      source: 'ai-live',
    });

    const cached = await getOrFetchCompanySummary(ticker);
    expect(cached.translations.en._isFallbackTranslation).toBe(true);
    expect(cached.moat.score).toBe('1/5');

    // Simulate LLM translation returning slightly altered active flags -> parity logic must preserve original active flags & rating
    const mockCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: JSON.stringify({
          summary: 'American Airlines is a major carrier operating domestic and international flights.',
          growthEngines: ['Fleet modernization'],
          moat: {
            rating: 'Wide Moat',
            summary: 'Narrow moat anchored by airport hub slots.',
            sources: [
              { name: 'Switching Costs', active: true, rationale: 'No high switching costs.' },
              { name: 'Intangible Assets', active: true, rationale: 'Scarce airport gate slots.' },
            ],
          },
        }),
      },
    });
    mockHttpsCallable.mockReturnValueOnce(mockCallable);

    const translated = await translateSummaryOnDemand(ticker, cached, 'en');
    expect(translated.translations.en.summary).toBe(
      'American Airlines is a major carrier operating domestic and international flights.'
    );
    expect(translated.translations.en._isFallbackTranslation).toBeUndefined();
    expect(translated.translations.en.moat.rating).toBe('Narrow Moat');
    expect(translated.translations.en.moat.score).toBe('1/5');
    expect(
      translated.translations.en.moat.sources.find((s) => s.name === 'Switching Costs').active
    ).toBe(false);
    expect(
      translated.translations.en.moat.sources.find((s) => s.name === 'Intangible Assets').rationale
    ).toBe('Scarce airport gate slots.');
  });

  it('enforces 0/5 active pillars when qualitative AI rating is "No Moat" while preserving explanatory rationales', () => {
    const contradictory = {
      rating: 'No Moat',
      score: '3/5',
      summary: 'שוק תחרותי מאוד ללא חפיר הגנתי ממושך.',
      sources: [
        { name: 'Switching Costs', active: true, rationale: 'מעבר ספקים פשוט יחסית.' },
        { name: 'Cost Advantage', active: true, rationale: 'יתרון זמני בלבד שקיים גם למתחרים.' },
        { name: 'Intangible Assets', active: true, rationale: 'מותג מוכר ללא כוח תמחור חריג.' },
      ],
    };

    const normalized = normalizeMoat(contradictory, 'CommodityCo', 'he');
    expect(normalized.rating).toBe('No Moat');
    expect(normalized.score).toBe('0/5');
    expect(normalized.sources.every((s) => s.active === false)).toBe(true);
    expect(normalized.sources.find((s) => s.name === 'Switching Costs').rationale).toBe(
      'מעבר ספקים פשוט יחסית.'
    );
  });

  it('normalizes visual businessInfographic (from legacy mermaid or explicit stages), scaled competitors, and jargon glossary', () => {
    const flowFromMermaid = normalizeBusinessInfographic(
      null,
      ['Parts Distribution', 'MRO'],
      'AAR Corp',
      'AIR',
      'he',
      'flowchart LR\n  A["חברות תעופה וממשל"] --> B["חלקי חילוף ו-MRO"]'
    );
    expect(flowFromMermaid).toHaveLength(4);
    expect(flowFromMermaid[0].subtitle).toBe('חברות תעופה וממשל');
    expect(flowFromMermaid[1].subtitle).toBe('חלקי חילוף ו-MRO');

    const peers = normalizeCompetitors(
      [
        {
          name: 'HEICO',
          relativeSize: 'larger',
          competeOnHe: 'חלקי חילוף תעופתיים',
          competeOnEn: 'PMA & USM aviation parts',
        },
        'Legacy String Competitor',
      ],
      'he'
    );
    expect(peers).toHaveLength(2);
    expect(peers[0].sizeShort).toBe('גדולה ↑');
    expect(peers[0].competeOn).toBe('חלקי חילוף תעופתיים');
    expect(peers[1].sizeShort).toBe('דומה ≈');

    const terms = normalizeGlossary(
      [
        { term: 'MRO', definitionHe: 'תחזוקה, תיקון ושיפוץ כלי טיס', definitionEn: 'Maintenance, Repair & Overhaul' },
      ],
      'he'
    );
    expect(terms).toEqual([{ term: 'MRO', definition: 'תחזוקה, תיקון ושיפוץ כלי טיס' }]);
  });
});
