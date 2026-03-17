import { describe, it, expect } from 'vitest';

/**
 * TDD RED phase — tests for schema validation and content heuristics.
 */
describe('validateBullCase', () => {
  it('returns valid for a well-formed bull case', async () => {
    const { validateBullCase } = await import('../../services/prompts/validation.js');
    const bullCase = {
      arguments: [
        { title: 'Revenue growth', detail: 'Apple grew revenue 8% YoY', citation: '10-K FY2023 p.22' },
        { title: 'Strong moat', detail: 'Ecosystem lock-in', citation: 'Investor Day transcript' },
      ],
      confidence: 0.8,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateBullCase(bullCase, 'Apple');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when arguments array is empty', async () => {
    const { validateBullCase } = await import('../../services/prompts/validation.js');
    const bullCase = { arguments: [], confidence: 0.8, generatedAt: '2024-01-01T00:00:00.000Z' };
    const result = validateBullCase(bullCase, 'Apple');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /argument/i.test(e))).toBe(true);
  });

  it('fails when company name not present in any argument detail', async () => {
    const { validateBullCase } = await import('../../services/prompts/validation.js');
    const bullCase = {
      arguments: [
        { title: 'Growth', detail: 'Revenue up 20% YoY', citation: 'p.5' },
      ],
      confidence: 0.8,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateBullCase(bullCase, 'Microsoft');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /company name/i.test(e))).toBe(true);
  });

  it('fails when confidence is out of 0-1 range', async () => {
    const { validateBullCase } = await import('../../services/prompts/validation.js');
    const bullCase = {
      arguments: [{ title: 'Growth', detail: 'Apple grew strongly', citation: 'p.1' }],
      confidence: 2.5,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateBullCase(bullCase, 'Apple');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /confidence/i.test(e))).toBe(true);
  });
});

describe('validateBearCase', () => {
  it('returns valid for a well-formed bear case', async () => {
    const { validateBearCase } = await import('../../services/prompts/validation.js');
    const bearCase = {
      riskFactors: [
        { title: 'Competition', detail: 'Tesla faces intense competition from BYD', dataPoint: 'Market share -3% in China' },
      ],
      confidence: 0.7,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateBearCase(bearCase, 'Tesla');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when riskFactors array is empty', async () => {
    const { validateBearCase } = await import('../../services/prompts/validation.js');
    const bearCase = { riskFactors: [], confidence: 0.5, generatedAt: '2024-01-01T00:00:00.000Z' };
    const result = validateBearCase(bearCase, 'Tesla');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /risk factor/i.test(e))).toBe(true);
  });

  it('fails when company name not present in any risk factor detail', async () => {
    const { validateBearCase } = await import('../../services/prompts/validation.js');
    const bearCase = {
      riskFactors: [
        { title: 'Risk', detail: 'Intense competition in EV space', dataPoint: 'Share -3%' },
      ],
      confidence: 0.5,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateBearCase(bearCase, 'Tesla');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /company name/i.test(e))).toBe(true);
  });
});

describe('validateSynthesis', () => {
  it('returns valid for a well-formed synthesis', async () => {
    const { validateSynthesis } = await import('../../services/prompts/validation.js');
    const synthesis = {
      keyFactors: [{ title: 'Valuation', analysis: 'Apple trades at a premium but justified by moat' }],
      recommendation: 'HOLD',
      confidence: 0.65,
      disclaimer: 'This is not financial advice. Do your own research.',
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateSynthesis(synthesis);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when disclaimer is missing or empty', async () => {
    const { validateSynthesis } = await import('../../services/prompts/validation.js');
    const synthesis = {
      keyFactors: [{ title: 'Valuation', analysis: 'Premium valuation' }],
      recommendation: 'BUY',
      confidence: 0.8,
      disclaimer: '',
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateSynthesis(synthesis);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /disclaimer/i.test(e))).toBe(true);
  });

  it('fails when keyFactors array is empty', async () => {
    const { validateSynthesis } = await import('../../services/prompts/validation.js');
    const synthesis = {
      keyFactors: [],
      recommendation: 'BUY',
      confidence: 0.8,
      disclaimer: 'Not financial advice.',
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    const result = validateSynthesis(synthesis);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /key factor/i.test(e))).toBe(true);
  });
});

describe('validateDebateArguments are distinct', () => {
  it('fails when bull and bear arguments have duplicate titles', async () => {
    const { validateDebateArgumentsAreDistinct } = await import('../../services/prompts/validation.js');
    const bullTitles = ['Revenue growth', 'Strong moat', 'Global reach'];
    const bearTitles = ['Revenue growth', 'Debt concerns', 'Regulatory risk'];
    const result = validateDebateArgumentsAreDistinct(bullTitles, bearTitles);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /duplicate/i.test(e))).toBe(true);
  });

  it('passes when bull and bear arguments have no overlapping titles', async () => {
    const { validateDebateArgumentsAreDistinct } = await import('../../services/prompts/validation.js');
    const bullTitles = ['Revenue growth', 'Strong moat'];
    const bearTitles = ['Competition risk', 'Valuation concerns'];
    const result = validateDebateArgumentsAreDistinct(bullTitles, bearTitles);
    expect(result.valid).toBe(true);
  });
});
