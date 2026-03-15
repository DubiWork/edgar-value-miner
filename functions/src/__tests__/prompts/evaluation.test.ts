import { describe, it, expect } from 'vitest';

/**
 * TDD RED phase — tests for the evaluation harness.
 */
describe('evaluateDebateOutput — schema validation', () => {
  it('returns passed for a valid DebateOutput', async () => {
    const { evaluateDebateOutput } = await import('../../services/prompts/evaluation.js');
    const output = {
      bullCase: {
        arguments: [
          { title: 'Revenue growth', detail: 'Apple grew revenue 8% YoY', citation: '10-K p.22' },
        ],
        confidence: 0.8,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      bearCase: {
        riskFactors: [
          { title: 'Competition', detail: 'Apple faces intense competition from Android', dataPoint: 'Market share flat in China' },
        ],
        confidence: 0.6,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Valuation', analysis: 'P/E is elevated but justified by Apple moat' }],
        recommendation: 'HOLD',
        confidence: 0.7,
        disclaimer: 'Not financial advice.',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    const result = evaluateDebateOutput(output, 'Apple');
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns failed when bullCase is missing arguments', async () => {
    const { evaluateDebateOutput } = await import('../../services/prompts/evaluation.js');
    const output = {
      bullCase: { arguments: [], confidence: 0.8, generatedAt: '2024-01-01T00:00:00.000Z' },
      bearCase: {
        riskFactors: [{ title: 'Risk', detail: 'Risk detail', dataPoint: 'Data point' }],
        confidence: 0.5,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Factor', analysis: 'Analysis' }],
        recommendation: 'HOLD',
        confidence: 0.6,
        disclaimer: 'Not advice.',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    const result = evaluateDebateOutput(output, 'SomeCompany');
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns failed when synthesis disclaimer is empty', async () => {
    const { evaluateDebateOutput } = await import('../../services/prompts/evaluation.js');
    const output = {
      bullCase: {
        arguments: [{ title: 'Growth', detail: 'Tesla grew strongly', citation: 'p.5' }],
        confidence: 0.8,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      bearCase: {
        riskFactors: [{ title: 'Risk', detail: 'Tesla faces competition', dataPoint: 'Share -3%' }],
        confidence: 0.6,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Valuation', analysis: 'High P/E' }],
        recommendation: 'HOLD',
        confidence: 0.6,
        disclaimer: '',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    const result = evaluateDebateOutput(output, 'Tesla');
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => /disclaimer/i.test(e))).toBe(true);
  });
});

describe('evaluateDebateOutput — content heuristics', () => {
  it('warns when company name not present in bull case', async () => {
    const { evaluateDebateOutput } = await import('../../services/prompts/evaluation.js');
    const output = {
      bullCase: {
        arguments: [{ title: 'Growth', detail: 'Revenue grew strongly YoY', citation: 'p.5' }],
        confidence: 0.8,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      bearCase: {
        riskFactors: [{ title: 'Risk', detail: 'Microsoft faces cloud competition', dataPoint: 'AWS market share 32%' }],
        confidence: 0.6,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Factor', analysis: 'Microsoft analysis' }],
        recommendation: 'HOLD',
        confidence: 0.6,
        disclaimer: 'Not financial advice.',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    const result = evaluateDebateOutput(output, 'Microsoft');
    // Bull case doesn't mention Microsoft — should fail content heuristic
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => /company name/i.test(e))).toBe(true);
  });

  it('warns when bull and bear have duplicate argument titles', async () => {
    const { evaluateDebateOutput } = await import('../../services/prompts/evaluation.js');
    const output = {
      bullCase: {
        arguments: [{ title: 'Revenue growth', detail: 'Apple grew revenue 8%', citation: 'p.1' }],
        confidence: 0.8,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      bearCase: {
        riskFactors: [{ title: 'Revenue growth', detail: 'Apple revenue growth slowing', dataPoint: 'Growth -2%' }],
        confidence: 0.5,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Factor', analysis: 'Analysis of Apple' }],
        recommendation: 'HOLD',
        confidence: 0.6,
        disclaimer: 'Not advice.',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    const result = evaluateDebateOutput(output, 'Apple');
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => /duplicate/i.test(e))).toBe(true);
  });
});

describe('compareToGoldenFile', () => {
  it('returns match:true when output structure matches golden file', async () => {
    const { compareToGoldenFile } = await import('../../services/prompts/evaluation.js');
    const output = {
      bullCase: {
        arguments: [{ title: 'Services Growth', detail: 'Apple services revenue', citation: '10-K p.5' }],
        confidence: 0.85,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      bearCase: {
        riskFactors: [{ title: 'Competition Risk', detail: 'Apple faces Android', dataPoint: 'Market share flat' }],
        confidence: 0.65,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Valuation', analysis: 'Apple P/E analysis' }],
        recommendation: 'HOLD',
        confidence: 0.75,
        disclaimer: 'Not financial advice.',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    const golden = { ...output };
    const result = compareToGoldenFile(output, golden);
    expect(result.match).toBe(true);
  });

  it('returns match:false when structure differs from golden file', async () => {
    const { compareToGoldenFile } = await import('../../services/prompts/evaluation.js');
    const output = {
      bullCase: {
        arguments: [{ title: 'Growth', detail: 'Apple grew', citation: 'p.1' }],
        confidence: 0.8,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      bearCase: {
        riskFactors: [{ title: 'Risk', detail: 'Apple competition', dataPoint: 'Data' }],
        confidence: 0.5,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
      synthesis: {
        keyFactors: [{ title: 'Factor', analysis: 'Analysis' }],
        recommendation: 'HOLD',
        confidence: 0.6,
        disclaimer: 'Not advice.',
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    // Golden has 2 bull arguments, actual has 1 — structural mismatch
    const golden = {
      ...output,
      bullCase: {
        arguments: [
          { title: 'Services Growth', detail: 'Apple services', citation: 'p.5' },
          { title: 'Hardware Moat', detail: 'Apple hardware', citation: 'p.8' },
        ],
        confidence: 0.85,
        generatedAt: '2024-01-01T00:00:00.000Z',
      },
    };
    const result = compareToGoldenFile(output, golden);
    expect(result.match).toBe(false);
    expect(result.differences.length).toBeGreaterThan(0);
  });
});
