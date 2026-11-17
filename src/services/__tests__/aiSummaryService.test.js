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
});
