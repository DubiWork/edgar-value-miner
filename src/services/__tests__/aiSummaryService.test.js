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
  AI_SUMMARY_SCHEMA_VERSION,
  BUSINESS_ARCHETYPES,
  getOrFetchCompanySummary,
  getCachedSummary,
  setCachedSummary,
  invalidateCachedSummary,
  getCompanyContextStatus,
  normalizeMoat,
  normalizeBusinessInfographic,
  normalizeCompetitors,
  normalizeGlossary,
  normalizeQualitativeFlags,
  resolveTraitDisplay,
  translateSummaryOnDemand,
  inferArchetypeFromXbrlAndMeta,
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

  it('returns dynamic mock when Cloud Function rejects without poisoning IndexedDB cache (#328)', async () => {
    await invalidateCachedSummary('AAPL');
    mockHttpsCallable.mockReturnValue(() => Promise.reject(new Error('Offline')));

    const result = await getOrFetchCompanySummary('AAPL');

    expect(result.ticker).toBe('AAPL');
    expect(result.summary).toContain('אפל');
    expect(result.source).toBe('mock-preset');
    expect(result.keyEngines.length).toBeGreaterThanOrEqual(3);

    // Ungrounded mock fallback MUST NOT be saved into IndexedDB cache (#328)
    expect(await getCachedSummary('AAPL')).toBeNull();

    // Next call retries Cloud Function instead of serving stale mock from cache
    const liveCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: JSON.stringify({
          summary: 'תקציר מאומת מ-SEC עבור אפל',
          keyEngines: ['iPhone', 'Services'],
        }),
        ingestionStatus: {
          tenK: { status: 'ok', date: '2026-10-30' },
          eightK: { status: 'ok', date: '2026-11-01' },
          transcript: { status: 'fallback_8k' },
        },
      },
    });
    mockHttpsCallable.mockReturnValueOnce(liveCallable);

    const secondCall = await getOrFetchCompanySummary('AAPL');
    expect(secondCall.source).toBe('ai-live');
    expect(secondCall.summary).toBe('תקציר מאומת מ-SEC עבור אפל');
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

  it('forwards numeric CIK from options/companyProfile and exposes _contextMissing on null server context (#324, #328)', async () => {
    const adapterCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: '{"summary":"Shopify summary","keyEngines":["Merchant Solutions"]}',
        ingestionStatus: {
          tenK: { status: 'ok', date: '2026-02-11' },
          eightK: { status: 'ok', date: '2026-11-03' },
          transcript: { status: 'fallback_8k' },
        },
      },
    });
    mockHttpsCallable.mockReturnValueOnce(adapterCallable);

    const adapterParsed = await geminiAdapter.generateJSON('Summarize SHOP', undefined, {
      ticker: 'SHOP',
      cik: 1594805,
    });
    expect(adapterCallable).toHaveBeenCalledWith({
      prompt: 'Summarize SHOP',
      ticker: 'SHOP',
      cik: 1594805,
    });
    expect(adapterParsed._ingestionStatus?.tenK?.status).toBe('ok');

    await invalidateCachedSummary('SHOP');
    const summaryCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: JSON.stringify({
          summary: 'שופיפיי מספקת תשתית מסחר',
          keyEngines: ['Subscription Solutions', 'Merchant Solutions'],
        }),
        ingestionStatus: {
          tenK: { status: 'ok', date: '2026-02-11' },
          eightK: { status: 'ok', date: '2026-11-03' },
          transcript: { status: 'fallback_8k' },
        },
      },
    });
    mockHttpsCallable.mockReturnValueOnce(summaryCallable);

    const liveShop = await getOrFetchCompanySummary('SHOP', {
      name: 'Shopify Inc.',
      cik: '0001594805',
    });
    expect(summaryCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: 'SHOP',
        cik: 1594805,
      })
    );
    expect(liveShop.source).toBe('ai-live');

    // getCompanyContextStatus returns _contextMissing: true when server has no Firestore doc yet (e.g. MA)
    const missingCtxCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: '',
        budget: { status: 'active' },
        ingestionStatus: null,
        hasNewerFilings: false,
        latestFilingDates: { tenKDate: null, eightKDate: null },
      },
    });
    mockHttpsCallable.mockReturnValueOnce(missingCtxCallable);

    const status = await getCompanyContextStatus('MA', null, { cik: '0001141391' });
    expect(missingCtxCallable).toHaveBeenCalledWith({
      action: 'getCompanyContextStatus',
      ticker: 'MA',
      cik: 1141391,
    });
    expect(status?._serverReachable).toBe(true);
    expect(status?._contextMissing).toBe(true);
    expect(status?.budgetStatus).toBe('active');

    // Returns null only when server call itself fails
    mockHttpsCallable.mockReturnValueOnce(() => Promise.reject(new Error('Network down')));
    expect(await getCompanyContextStatus('MA')).toBeNull();
  });
});

describe('Slice 2 (#357) — Schema v2, Bilingual Red Flags & Deterministic Archetype Classifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes AI_SUMMARY_SCHEMA_VERSION = 2, populates PRESET_MOCKS defaults, and preserves null businessArchetype for legacy v1 cache entries', async () => {
    expect(AI_SUMMARY_SCHEMA_VERSION).toBe(2);
    expect(BUSINESS_ARCHETYPES).toHaveLength(6);

    // Preset mock fallback emits v2 schema + valid businessArchetype
    await invalidateCachedSummary('MSFT');
    mockHttpsCallable.mockReturnValueOnce(() => Promise.reject(new Error('Offline')));
    const presetMsft = await getOrFetchCompanySummary('MSFT', { name: 'Microsoft Corp' });
    expect(presetMsft.schemaVersion).toBe(2);
    expect(presetMsft.businessArchetype).toBe('TECH_SAAS');
    expect(presetMsft.financialSubType).toBe('NONE');
    expect(presetMsft.qualitativeFlags).toEqual([]);
    expect(presetMsft.customerConcentration).toEqual({
      detected: false,
      maxCustomerPct: null,
      detailHe: '',
      detailEn: '',
      quoteEn: null,
    });
    expect(presetMsft.governanceAndMoatRisks.hasRestatement).toBe(false);

    // Legacy v1 cached object without businessArchetype keeps businessArchetype: null for opportunistic upgrade
    await setCachedSummary('LEG1', {
      ticker: 'LEG1',
      summary: 'תקציר גרסה 1 ישנה',
      keyEngines: ['Core Product'],
      source: 'ai-live',
    });
    const legacy = await getOrFetchCompanySummary('LEG1');
    expect(legacy.schemaVersion).toBe(1);
    expect(legacy.businessArchetype).toBeNull();
    expect(legacy.qualitativeFlags).toEqual([]);
  }, 10000);

  it('preserves valid v1 cached summary in IndexedDB when forceRefresh fails on transient error (no pre-deletion bug)', async () => {
    await setCachedSummary('SAP', {
      ticker: 'SAP',
      summary: 'סאפ תקציר v1 מאומת מהמטמון',
      keyEngines: ['Cloud ERP'],
      source: 'ai-live',
    });

    mockHttpsCallable.mockReturnValueOnce(() => Promise.reject(new Error('504 Gateway Timeout')));

    const result = await getOrFetchCompanySummary(
      'SAP',
      { name: 'SAP SE' },
      { forceRefresh: true }
    );

    // Must serve valid cached summary instead of deleting it or replacing with generic mock
    expect(result.source).toBe('cache');
    expect(result.summary).toBe('סאפ תקציר v1 מאומת מהמטמון');
    const stillCached = await getCachedSummary('SAP');
    expect(stillCached?.summary).toBe('סאפ תקציר v1 מאומת מהמטמון');
  });

  it('parses Schema v2 bilingual qualitativeFlags + verbatim SEC quotes in callLlmApi and preserves quoteEn across translateSummaryOnDemand', async () => {
    await invalidateCachedSummary('SMCI');
    const liveCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: JSON.stringify({
          summary: 'סופר מיקרו מייצרת שרתי AI ופתרונות קירור למרכזי נתונים.',
          businessArchetype: 'CYCLICAL_INDUSTRIAL',
          financialSubType: 'NONE',
          keyEngines: ['AI Server Racks', 'Liquid Cooling Systems'],
          customerConcentration: {
            detected: true,
            maxCustomerPct: 24,
            detailHe: 'לקוח יחיד מהווה 24% מהכנסות החברה',
            detailEn: 'A single customer accounts for 24% of total revenue',
            quoteEn: 'Customer A accounted for 24% of net sales in fiscal 2025.',
          },
          governanceAndMoatRisks: {
            hasRestatement: true,
            hasExecutiveTurnover: false,
            hasOptionRepricing: false,
            supplyChainOrSovereignRisk: false,
            erodingMoatRisk: false,
            summaryHe: 'זוהה תיקון דוחות (Restatement) בדוח 10-K/A.',
            summaryEn: 'Restatement disclosed in Form 10-K/A.',
          },
          qualitativeFlags: [
            {
              id: 'customer-concentration',
              severity: 'fail',
              category: 'concentration',
              titleHe: 'ריכוזיות לקוחות קיצונית (24%)',
              rationaleHe: 'אובדן של לקוח מרכזי אחד יפגע בחמישית מההכנסות.',
              quoteEn: 'Customer A accounted for 24% of net sales in fiscal 2025.',
              sourceRef: '10-K Item 1A',
            },
          ],
        }),
      },
    });
    mockHttpsCallable.mockReturnValueOnce(liveCallable);

    const liveRes = await getOrFetchCompanySummary('SMCI', { name: 'Super Micro Computer Inc.' });
    expect(liveRes.schemaVersion).toBe(2);
    expect(liveRes.businessArchetype).toBe('CYCLICAL_INDUSTRIAL');
    expect(liveRes.customerConcentration.maxCustomerPct).toBe(24);
    expect(liveRes.governanceAndMoatRisks.hasRestatement).toBe(true);
    expect(liveRes.qualitativeFlags).toHaveLength(1);
    expect(liveRes.qualitativeFlags[0].quoteEn).toBe(
      'Customer A accounted for 24% of net sales in fiscal 2025.'
    );
    expect(liveRes.qualitativeFlags[0].sourceRef).toBe('10-K Item 1A');

    // On-demand translation translates qualitativeFlags + concentration while preserving verbatim quoteEn
    const translateCallable = vi.fn().mockResolvedValueOnce({
      data: {
        text: JSON.stringify({
          summary: 'Super Micro builds AI server racks and liquid cooling solutions.',
          qualitativeFlags: [
            {
              id: 'customer-concentration',
              title: 'Extreme Customer Concentration (24%)',
              rationale: 'Losing one anchor customer would hit nearly a quarter of sales.',
            },
          ],
          customerConcentrationDetail: 'One customer generates 24% of total net sales.',
          governanceSummary: 'Financial restatement disclosed in Form 10-K/A.',
        }),
      },
    });
    mockHttpsCallable.mockReturnValueOnce(translateCallable);

    const translated = await translateSummaryOnDemand('SMCI', liveRes, 'en');
    const enFlags = normalizeQualitativeFlags(translated.translations.en.qualitativeFlags, 'en');
    expect(enFlags[0].title).toBe('Extreme Customer Concentration (24%)');
    expect(enFlags[0].rationale).toBe(
      'Losing one anchor customer would hit nearly a quarter of sales.'
    );
    // Verbatim SEC quote and severity remain untouched
    expect(enFlags[0].quoteEn).toBe(
      'Customer A accounted for 24% of net sales in fiscal 2025.'
    );
    expect(enFlags[0].severity).toBe('fail');
    expect(enFlags[0].sourceRef).toBe('10-K Item 1A');
    expect(translated.translations.en.customerConcentration.detailEn).toBe(
      'One customer generates 24% of total net sales.'
    );
    expect(translated.translations.en.governanceAndMoatRisks.summaryEn).toBe(
      'Financial restatement disclosed in Form 10-K/A.'
    );
  });

  it('deterministically classifies all 6 archetypes & 9 benchmark companies (MSFT, ADBE, SAP, AER, JPM, HD, COST, JNJ, CAT) from XBRL and metadata', () => {
    // 1. MSFT (Pure XBRL: deferred revenue + high GM + R&D + low inventory)
    expect(
      inferArchetypeFromXbrlAndMeta({
        metrics: {
          revenue: { annual: [{ fiscalYear: 2025, value: 281700000000 }] },
          grossProfit: { annual: [{ fiscalYear: 2025, value: 194000000000 }] }, // 68.9%
          researchAndDevelopment: { annual: [{ fiscalYear: 2025, value: 32000000000 }] }, // 11.4%
          deferredRevenueCurrent: { annual: [{ fiscalYear: 2025, value: 57000000000 }] },
          inventory: { annual: [{ fiscalYear: 2025, value: 1200000000 }] },
        },
      }).archetype
    ).toBe('TECH_SAAS');

    // 2. ADBE (Pure XBRL: deferred revenue / currentLiabilities >= 10%, 88% GM)
    expect(
      inferArchetypeFromXbrlAndMeta({
        metrics: {
          revenue: { annual: [{ fiscalYear: 2025, value: 21500000000 }] },
          grossProfit: { annual: [{ fiscalYear: 2025, value: 19100000000 }] }, // 88.8%
          researchAndDevelopment: { annual: [{ fiscalYear: 2025, value: 3900000000 }] },
          deferredRevenueCurrent: { annual: [{ fiscalYear: 2025, value: 6200000000 }] },
          currentLiabilities: { annual: [{ fiscalYear: 2025, value: 10000000000 }] },
        },
      }).archetype
    ).toBe('TECH_SAAS');

    // 3. SAP (Pure XBRL IFRS contract liabilities + 73% GM)
    expect(
      inferArchetypeFromXbrlAndMeta({
        metadata: { accountingStandard: 'IFRS' },
        metrics: {
          revenue: { annual: [{ fiscalYear: 2025, value: 36800000000 }] },
          grossProfit: { annual: [{ fiscalYear: 2025, value: 27000000000 }] },
          researchAndDevelopment: { annual: [{ fiscalYear: 2025, value: 6600000000 }] },
          deferredRevenueCurrent: {
            tag: 'CurrentContractLiabilities',
            annual: [{ fiscalYear: 2025, value: 5200000000 }],
          },
        },
      }).archetype
    ).toBe('TECH_SAAS');

    // 4. AER (Pure XBRL non-bank aircraft leasing: high interest/rev, leverage, heavy PPE, zero inventory)
    const aerRes = inferArchetypeFromXbrlAndMeta({
      metrics: {
        revenue: { annual: [{ fiscalYear: 2024, value: 8000000000 }] },
        interestExpense: { annual: [{ fiscalYear: 2024, value: 1900000000 }] }, // 23.8% of rev
        totalAssets: { annual: [{ fiscalYear: 2024, value: 71000000000 }] },
        totalLiabilities: { annual: [{ fiscalYear: 2024, value: 54000000000 }] },
        stockholdersEquity: { annual: [{ fiscalYear: 2024, value: 17000000000 }] }, // L/E 3.18x
        propertyPlantEquipment: { annual: [{ fiscalYear: 2024, value: 58000000000 }] }, // 81.7% PPE/Assets
      },
    });
    expect(aerRes.archetype).toBe('FINANCIAL_SPREAD');
    expect(aerRes.financialSubType).toBe('NON_BANK_FINANCE');

    // 5. JPM (Deposit bank via BANK_REVENUE_TAGS + SIC 6021)
    const jpmRes = inferArchetypeFromXbrlAndMeta({
      metrics: {
        revenue: {
          tag: 'InterestRevenueExpense',
          annual: [{ fiscalYear: 2025, value: 177000000000 }],
        },
        totalAssets: { annual: [{ fiscalYear: 2025, value: 4000000000000 }] },
        stockholdersEquity: { annual: [{ fiscalYear: 2025, value: 345000000000 }] },
      },
    });
    expect(jpmRes.archetype).toBe('FINANCIAL_SPREAD');
    expect(jpmRes.financialSubType).toBe('DEPOSIT_BANK');

    // 6. HD (Pure XBRL retail: inventory + 33.5% GM + zero R&D + low CapEx/Rev)
    expect(
      inferArchetypeFromXbrlAndMeta({
        metrics: {
          revenue: { annual: [{ fiscalYear: 2025, value: 159500000000 }] },
          grossProfit: { annual: [{ fiscalYear: 2025, value: 53400000000 }] }, // 33.5%
          operatingIncome: { annual: [{ fiscalYear: 2025, value: 21500000000 }] },
          inventory: { annual: [{ fiscalYear: 2025, value: 23500000000 }] }, // 14.7%
          capitalExpenditures: { annual: [{ fiscalYear: 2025, value: 3200000000 }] }, // 2.0%
        },
      }).archetype
    ).toBe('RETAIL_ECOMMERCE');

    // 7. COST (Pure XBRL low-margin warehouse retail: 12.6% GM + inventory + steady margin)
    expect(
      inferArchetypeFromXbrlAndMeta({
        metrics: {
          revenue: { annual: [{ fiscalYear: 2025, value: 254000000000 }] },
          grossProfit: { annual: [{ fiscalYear: 2025, value: 32000000000 }] }, // 12.6%
          operatingIncome: { annual: [{ fiscalYear: 2025, value: 9300000000 }] },
          inventory: { annual: [{ fiscalYear: 2025, value: 18600000000 }] }, // 7.3%
          capitalExpenditures: { annual: [{ fiscalYear: 2025, value: 4700000000 }] }, // 1.85%
        },
      }).archetype
    ).toBe('RETAIL_ECOMMERCE');

    // 8. JNJ (Pure XBRL pharma: 69% GM + 16% R&D + physical drug inventory + zero deferred revenue)
    expect(
      inferArchetypeFromXbrlAndMeta({
        metrics: {
          revenue: { annual: [{ fiscalYear: 2025, value: 88800000000 }] },
          grossProfit: { annual: [{ fiscalYear: 2025, value: 61300000000 }] }, // 69%
          researchAndDevelopment: { annual: [{ fiscalYear: 2025, value: 14500000000 }] }, // 16.3%
          inventory: { annual: [{ fiscalYear: 2025, value: 12400000000 }] }, // 14.0%
        },
      }).archetype
    ).toBe('HEALTHCARE_PHARMA');

    // 9. CAT (Pure XBRL cyclical machinery: inventory + 35% GM + 3.2% R&D + 4.5% CapEx)
    expect(
      inferArchetypeFromXbrlAndMeta({
        metrics: {
          revenue: { annual: [{ fiscalYear: 2025, value: 64800000000 }] },
          grossProfit: { annual: [{ fiscalYear: 2025, value: 22700000000 }] }, // 35%
          researchAndDevelopment: { annual: [{ fiscalYear: 2025, value: 2100000000 }] }, // 3.2%
          inventory: { annual: [{ fiscalYear: 2025, value: 16800000000 }] }, // 25.9%
          capitalExpenditures: { annual: [{ fiscalYear: 2025, value: 2900000000 }] }, // 4.5%
        },
      }).archetype
    ).toBe('CYCLICAL_INDUSTRIAL');

    // 10. SIC & Staples/Utilities metadata + null fallback
    expect(inferArchetypeFromXbrlAndMeta(null, { sic: 2086, name: 'Coca-Cola Co' }).archetype).toBe(
      'STAPLES_GENERAL'
    );
    expect(inferArchetypeFromXbrlAndMeta(null, { sic: 7359, name: 'AerCap Holdings' }).archetype).toBe(
      'FINANCIAL_SPREAD'
    );
    expect(inferArchetypeFromXbrlAndMeta(null, null).archetype).toBe('STAPLES_GENERAL');
  });
});
