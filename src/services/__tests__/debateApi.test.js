/**
 * Tests for debateApi service
 *
 * Covers Cloud Function calls, response mapping, error mapping,
 * and rate limit handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDebate, submitFeedback } from '../debateApi';

// =============================================================================
// Mocks
// =============================================================================

const mockGetOrGenerateDebate = vi.fn();
const mockSubmitFeedback = vi.fn();

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn((_, name) => {
    if (name === 'getOrGenerateDebate') return mockGetOrGenerateDebate;
    if (name === 'submitFeedback') return mockSubmitFeedback;
    return vi.fn();
  }),
}));

vi.mock('../../lib/firebase', () => ({
  default: {},
  firebaseAvailable: true,
}));

// =============================================================================
// Fixtures
// =============================================================================

const mockDebateResponse = {
  data: {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    generatedAt: '2026-03-17T10:00:00.000Z',
    bullCase: {
      arguments: [
        { title: 'Strong Ecosystem', detail: 'Loyal customer base', citation: 'Annual Report 2025' },
      ],
      confidence: 0.75,
      generatedAt: '2026-03-17T10:00:00.000Z',
    },
    bearCase: {
      riskFactors: [
        { title: 'Market Saturation', detail: 'Slowing iPhone growth', dataPoint: 'Q4 2025' },
      ],
      confidence: 0.6,
      generatedAt: '2026-03-17T10:00:00.000Z',
    },
    synthesis: {
      keyFactors: [{ title: 'Services Growth', analysis: 'Strong recurring revenue' }],
      recommendation: 'Hold with cautious optimism',
      confidence: 0.65,
      disclaimer: 'Not financial advice',
      generatedAt: '2026-03-17T10:00:00.000Z',
    },
    metadata: { model: 'claude-3-5-haiku-20241022', version: 1, viewCount: 42 },
    source: 'cached',
  },
};

const mockRateLimitError = {
  data: {
    error: {
      code: 'rate-limited',
      message: 'Rate limit exceeded.',
      retryable: false,
      currentCount: 5,
      maxCount: 5,
      upgradeUrl: 'https://example.com/upgrade',
    },
  },
};

// =============================================================================
// Tests: getDebate
// =============================================================================

describe('debateApi.getDebate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls getOrGenerateDebate Cloud Function with ticker', async () => {
    mockGetOrGenerateDebate.mockResolvedValue(mockDebateResponse);

    await getDebate('AAPL');

    expect(mockGetOrGenerateDebate).toHaveBeenCalledWith({ ticker: 'AAPL' });
  });

  it('normalizes ticker to uppercase before calling CF', async () => {
    mockGetOrGenerateDebate.mockResolvedValue(mockDebateResponse);

    await getDebate('aapl');

    expect(mockGetOrGenerateDebate).toHaveBeenCalledWith({ ticker: 'AAPL' });
  });

  it('returns typed DebateResponse on success', async () => {
    mockGetOrGenerateDebate.mockResolvedValue(mockDebateResponse);

    const result = await getDebate('AAPL');

    expect(result).toMatchObject({
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      generatedAt: expect.any(String),
      bullCase: expect.objectContaining({ arguments: expect.any(Array) }),
      bearCase: expect.objectContaining({ riskFactors: expect.any(Array) }),
      synthesis: expect.objectContaining({ recommendation: expect.any(String) }),
      metadata: expect.objectContaining({ model: expect.any(String) }),
      source: expect.stringMatching(/^(cached|generated)$/),
    });
  });

  it('throws mapped error on network failure', async () => {
    mockGetOrGenerateDebate.mockRejectedValue(new Error('Network error'));

    await expect(getDebate('AAPL')).rejects.toMatchObject({
      message: expect.stringContaining('Unable to connect'),
      code: 'network',
      retryable: true,
    });
  });

  it('throws mapped error on auth failure (unauthenticated)', async () => {
    const authError = Object.assign(new Error('Unauthenticated'), { code: 'unauthenticated' });
    mockGetOrGenerateDebate.mockRejectedValue(authError);

    await expect(getDebate('AAPL')).rejects.toMatchObject({
      message: expect.stringContaining('sign in'),
      code: 'auth',
      retryable: false,
    });
  });

  it('throws rate limit error when CF returns rate-limited payload', async () => {
    mockGetOrGenerateDebate.mockResolvedValue(mockRateLimitError);

    await expect(getDebate('AAPL')).rejects.toMatchObject({
      code: 'rate-limited',
      retryable: false,
      rateLimitInfo: {
        currentCount: 5,
        maxCount: 5,
        upgradeUrl: 'https://example.com/upgrade',
      },
    });
  });

  it('throws mapped error on internal CF error', async () => {
    mockGetOrGenerateDebate.mockResolvedValue({
      data: { error: { code: 'internal', message: 'Unexpected error', retryable: true } },
    });

    await expect(getDebate('AAPL')).rejects.toMatchObject({
      message: expect.stringContaining('unexpected error'),
      code: 'internal',
      retryable: true,
    });
  });
});

// =============================================================================
// Tests: submitFeedback
// =============================================================================

describe('debateApi.submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls submitFeedback Cloud Function with correct args', async () => {
    mockSubmitFeedback.mockResolvedValue({ data: { success: true } });

    await submitFeedback('debate-id-123', 'bullCase', 4);

    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      debateId: 'debate-id-123',
      section: 'bullCase',
      rating: 4,
    });
  });

  it('returns success result on CF call', async () => {
    mockSubmitFeedback.mockResolvedValue({ data: { success: true } });

    const result = await submitFeedback('debate-id-123', 'synthesis', 5);

    expect(result).toEqual({ success: true });
  });

  it('throws mapped error on submitFeedback failure', async () => {
    mockSubmitFeedback.mockRejectedValue(new Error('Network error'));

    await expect(submitFeedback('debate-id-123', 'bearCase', 2)).rejects.toMatchObject({
      message: expect.stringContaining('Unable to connect'),
      code: 'network',
    });
  });
});
