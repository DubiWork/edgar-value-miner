import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateContent, mockGetGenerativeModel, MockVertexAI } = vi.hoisted(() => {
  const generateContent = vi.fn();
  const getGenerativeModel = vi.fn(() => ({
    generateContent,
  }));
  const VertexAIClass = vi.fn(() => ({
    getGenerativeModel,
  }));
  return {
    mockGenerateContent: generateContent,
    mockGetGenerativeModel: getGenerativeModel,
    MockVertexAI: VertexAIClass,
  };
});

vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: MockVertexAI,
}));

import {
  generateAiSummaryHandler,
  resetInMemoryBudgetForTesting,
  DEFAULT_VERTEX_MODEL,
  DEFAULT_PROJECT_ID,
  DEFAULT_LOCATION,
  DEFAULT_API_ENDPOINT,
} from '../functions/generateAiSummary.js';

function makeReq(data: unknown) {
  return { data } as any;
}

describe('generateAiSummaryHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInMemoryBudgetForTesting();
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_REGION;
    delete process.env.CLOUD_ML_REGION;
    delete process.env.VERTEX_AI_MODEL;
    delete process.env.AI_MONTHLY_BUDGET_USD;
  });

  it('rejects missing or non-object request data', async () => {
    await expect(generateAiSummaryHandler(makeReq(null))).rejects.toThrow(
      /Request data is required/i
    );
  });

  it('rejects missing or empty prompt', async () => {
    await expect(generateAiSummaryHandler(makeReq({}))).rejects.toThrow(
      /prompt is required/i
    );
    await expect(generateAiSummaryHandler(makeReq({ prompt: '   ' }))).rejects.toThrow(
      /prompt is required/i
    );
  });

  it('initializes Vertex AI, calls Gemini model, and returns generated text', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"summary":"Test summary","keyEngines":["Engine 1"]}' }],
            },
          },
        ],
      },
    });

    const result = await generateAiSummaryHandler(
      makeReq({ prompt: 'Summarize AAPL business model' })
    );

    expect(MockVertexAI).toHaveBeenCalledWith({
      project: DEFAULT_PROJECT_ID,
      location: DEFAULT_LOCATION,
      apiEndpoint: DEFAULT_API_ENDPOINT,
    });
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: DEFAULT_VERTEX_MODEL,
    });
    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'Summarize AAPL business model' }] }],
    });
    expect(result).toEqual({
      text: '{"summary":"Test summary","keyEngines":["Engine 1"]}',
    });
  });

  it('throws internal HttpsError when Vertex AI returns empty response', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [] },
    });

    await expect(
      generateAiSummaryHandler(makeReq({ prompt: 'Summarize MSFT' }))
    ).rejects.toThrow(/Empty response from Vertex AI Gemini model/i);
  });

  it('returns budget status and renewal date when action is getBudgetStatus', async () => {
    const res = await generateAiSummaryHandler(makeReq({ action: 'getBudgetStatus' }));
    expect(res.budget).toBeDefined();
    expect(res.budget?.status).toBe('active');
    expect(res.budget?.monthlyLimitUsd).toBe(5);
    expect(res.budget?.resetsAt).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
    expect(res.budget?.daysUntilReset).toBeGreaterThanOrEqual(1);
  });

  it('automatically stops outgoing Vertex AI calls when monthly budget is exhausted', async () => {
    process.env.AI_MONTHLY_BUDGET_USD = '0.0001';
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"summary":"First call","keyEngines":["Engine 1"]}' }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 500,
          candidatesTokenCount: 500,
          totalTokenCount: 1000,
        },
      },
    });

    // First call succeeds and exceeds the tiny 0.0001 budget
    await generateAiSummaryHandler(makeReq({ prompt: 'Summarize AAPL' }));
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Status should now report exhausted
    const statusRes = await generateAiSummaryHandler(makeReq({ action: 'getBudgetStatus' }));
    expect(statusRes.budget?.status).toBe('exhausted');
    expect(statusRes.budget?.exhaustedReason).toBe('budget_limit');

    // Second call is automatically blocked BEFORE calling Vertex AI
    await expect(
      generateAiSummaryHandler(makeReq({ prompt: 'Summarize MSFT' }))
    ).rejects.toThrow(/AI_BUDGET_EXHAUSTED/);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('trips the budget circuit breaker automatically when Vertex AI throws 429 RESOURCE_EXHAUSTED', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded'));

    await expect(
      generateAiSummaryHandler(makeReq({ prompt: 'Summarize NVDA' }))
    ).rejects.toThrow(/AI_BUDGET_EXHAUSTED/);

    const statusRes = await generateAiSummaryHandler(makeReq({ action: 'getBudgetStatus' }));
    expect(statusRes.budget?.status).toBe('exhausted');
    expect(statusRes.budget?.exhaustedReason).toBe('vertex_quota');

    // Subsequent call does not even invoke Vertex AI
    await expect(
      generateAiSummaryHandler(makeReq({ prompt: 'Summarize GOOGL' }))
    ).rejects.toThrow(/AI_BUDGET_EXHAUSTED/);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
