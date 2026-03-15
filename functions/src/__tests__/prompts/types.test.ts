import { describe, it, expect } from 'vitest';

/**
 * TDD RED phase — tests for DebateOutput types and runtime guards.
 * These tests will fail until types.ts is implemented.
 */
describe('isValidArgument', () => {
  it('accepts a valid Argument object', async () => {
    const { isValidArgument } = await import('../../services/prompts/types.js');
    expect(isValidArgument({ title: 'Revenue growth', detail: 'Strong YoY growth', citation: '10-K p.42' })).toBe(true);
  });

  it('rejects argument missing required fields', async () => {
    const { isValidArgument } = await import('../../services/prompts/types.js');
    expect(isValidArgument({ title: 'No detail' })).toBe(false);
    expect(isValidArgument({ detail: 'No title', citation: 'x' })).toBe(false);
    expect(isValidArgument(null)).toBe(false);
  });
});

describe('isValidRiskFactor', () => {
  it('accepts a valid RiskFactor object', async () => {
    const { isValidRiskFactor } = await import('../../services/prompts/types.js');
    expect(isValidRiskFactor({ title: 'Competition', detail: 'Market share pressure', dataPoint: 'Share -5% YoY' })).toBe(true);
  });

  it('rejects risk factor missing required fields', async () => {
    const { isValidRiskFactor } = await import('../../services/prompts/types.js');
    expect(isValidRiskFactor({ title: 'x', detail: 'y' })).toBe(false);
    expect(isValidRiskFactor({})).toBe(false);
  });
});

describe('isValidFactor', () => {
  it('accepts a valid Factor object', async () => {
    const { isValidFactor } = await import('../../services/prompts/types.js');
    expect(isValidFactor({ title: 'Valuation', analysis: 'P/E is elevated' })).toBe(true);
  });

  it('rejects factor missing required fields', async () => {
    const { isValidFactor } = await import('../../services/prompts/types.js');
    expect(isValidFactor({ title: 'x' })).toBe(false);
    expect(isValidFactor({ analysis: 'y' })).toBe(false);
  });
});

describe('isValidBullCase', () => {
  it('accepts a valid BullCase object', async () => {
    const { isValidBullCase } = await import('../../services/prompts/types.js');
    const bullCase = {
      arguments: [{ title: 'Growth', detail: 'Strong revenue', citation: '10-K p.5' }],
      confidence: 0.75,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(isValidBullCase(bullCase)).toBe(true);
  });

  it('rejects bull case with confidence outside 0-1 range', async () => {
    const { isValidBullCase } = await import('../../services/prompts/types.js');
    const bullCase = {
      arguments: [{ title: 'Growth', detail: 'Strong', citation: 'p.1' }],
      confidence: 1.5,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(isValidBullCase(bullCase)).toBe(false);
  });

  it('rejects bull case with empty arguments array', async () => {
    const { isValidBullCase } = await import('../../services/prompts/types.js');
    const bullCase = {
      arguments: [],
      confidence: 0.8,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(isValidBullCase(bullCase)).toBe(false);
  });
});

describe('isValidBearCase', () => {
  it('accepts a valid BearCase object', async () => {
    const { isValidBearCase } = await import('../../services/prompts/types.js');
    const bearCase = {
      riskFactors: [{ title: 'Competition', detail: 'Pressure', dataPoint: 'Share -5%' }],
      confidence: 0.6,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(isValidBearCase(bearCase)).toBe(true);
  });

  it('rejects bear case with empty riskFactors array', async () => {
    const { isValidBearCase } = await import('../../services/prompts/types.js');
    const bearCase = {
      riskFactors: [],
      confidence: 0.6,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(isValidBearCase(bearCase)).toBe(false);
  });
});

describe('isValidSynthesis', () => {
  it('accepts a valid Synthesis object', async () => {
    const { isValidSynthesis } = await import('../../services/prompts/types.js');
    const synthesis = {
      keyFactors: [{ title: 'Moat', analysis: 'Strong brand' }],
      recommendation: 'HOLD',
      confidence: 0.7,
      disclaimer: 'Not financial advice.',
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(isValidSynthesis(synthesis)).toBe(true);
  });

  it('rejects synthesis missing disclaimer', async () => {
    const { isValidSynthesis } = await import('../../services/prompts/types.js');
    const synthesis = {
      keyFactors: [{ title: 'Moat', analysis: 'Strong' }],
      recommendation: 'BUY',
      confidence: 0.8,
      generatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(isValidSynthesis(synthesis)).toBe(false);
  });
});

describe('isValidDebateOutput', () => {
  it('accepts a complete DebateOutput object', async () => {
    const { isValidDebateOutput } = await import('../../services/prompts/types.js');
    const output = {
      bullCase: {
        arguments: [{ title: 'Growth', detail: 'Revenue up 20%', citation: '10-K p.5' }],
        confidence: 0.8,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      bearCase: {
        riskFactors: [{ title: 'Competition', detail: 'Market pressure', dataPoint: 'Share -5%' }],
        confidence: 0.6,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Valuation', analysis: 'Fairly priced' }],
        recommendation: 'HOLD',
        confidence: 0.7,
        disclaimer: 'Not financial advice.',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    expect(isValidDebateOutput(output)).toBe(true);
  });

  it('rejects output missing bearCase', async () => {
    const { isValidDebateOutput } = await import('../../services/prompts/types.js');
    const output = {
      bullCase: {
        arguments: [{ title: 'Growth', detail: 'Revenue up', citation: 'p.1' }],
        confidence: 0.8,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    expect(isValidDebateOutput(output)).toBe(false);
  });
});
