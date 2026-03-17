import { describe, it, expect } from 'vitest';

/**
 * TDD RED phase — tests for the quality evaluation harness.
 * Scores debates on 5 criteria (Specificity, Distinctness, Accuracy,
 * Actionability, Methodology) each on a 1-5 scale.
 */

describe('EvaluationCriteria constants', () => {
  it('exports the five required criteria names', async () => {
    const { EVALUATION_CRITERIA } = await import('../../evaluation/evaluationTypes.js');
    expect(EVALUATION_CRITERIA).toContain('Specificity');
    expect(EVALUATION_CRITERIA).toContain('Distinctness');
    expect(EVALUATION_CRITERIA).toContain('Accuracy');
    expect(EVALUATION_CRITERIA).toContain('Actionability');
    expect(EVALUATION_CRITERIA).toContain('Methodology');
  });

  it('exports EVALUATION_COMPANY_SET with the 10 required tickers', async () => {
    const { EVALUATION_COMPANY_SET } = await import('../../evaluation/evaluationTypes.js');
    const tickers = EVALUATION_COMPANY_SET.map((c) => c.ticker);
    expect(tickers).toContain('AAPL');
    expect(tickers).toContain('MSFT');
    expect(tickers).toContain('GOOGL');
    expect(tickers).toContain('CRM');
    expect(tickers).toContain('SNOW');
    expect(tickers).toContain('PLTR');
    expect(tickers).toContain('NET');
    expect(tickers).toContain('BRK.B');
    expect(tickers).toContain('JNJ');
    expect(tickers).toContain('INTC');
    expect(EVALUATION_COMPANY_SET).toHaveLength(10);
  });
});

describe('evaluateDebate — scoring', () => {
  it('returns scores for all 5 criteria with values between 1 and 5', async () => {
    const { evaluateDebate } = await import('../../evaluation/evaluationHarness.js');
    const debate = buildValidDebate('Apple');
    const result = evaluateDebate(debate, 'Apple Inc.', 'AAPL');
    expect(result.scores.Specificity).toBeGreaterThanOrEqual(1);
    expect(result.scores.Specificity).toBeLessThanOrEqual(5);
    expect(result.scores.Distinctness).toBeGreaterThanOrEqual(1);
    expect(result.scores.Distinctness).toBeLessThanOrEqual(5);
    expect(result.scores.Accuracy).toBeGreaterThanOrEqual(1);
    expect(result.scores.Accuracy).toBeLessThanOrEqual(5);
    expect(result.scores.Actionability).toBeGreaterThanOrEqual(1);
    expect(result.scores.Actionability).toBeLessThanOrEqual(5);
    expect(result.scores.Methodology).toBeGreaterThanOrEqual(1);
    expect(result.scores.Methodology).toBeLessThanOrEqual(5);
  });

  it('computes an overall score as the average of the five criteria', async () => {
    const { evaluateDebate } = await import('../../evaluation/evaluationHarness.js');
    const debate = buildValidDebate('Apple');
    const result = evaluateDebate(debate, 'Apple Inc.', 'AAPL');
    const expectedOverall =
      (result.scores.Specificity +
        result.scores.Distinctness +
        result.scores.Accuracy +
        result.scores.Actionability +
        result.scores.Methodology) /
      5;
    expect(result.overallScore).toBeCloseTo(expectedOverall, 5);
  });

  it('scores higher Specificity when arguments include SEC filing citations', async () => {
    const { evaluateDebate } = await import('../../evaluation/evaluationHarness.js');
    const withCitations = buildValidDebate('Apple');
    const withoutCitations = buildDebateWithNoCitations('Apple');
    const highScore = evaluateDebate(withCitations, 'Apple Inc.', 'AAPL');
    const lowScore = evaluateDebate(withoutCitations, 'Apple Inc.', 'AAPL');
    expect(highScore.scores.Specificity).toBeGreaterThan(lowScore.scores.Specificity);
  });

  it('scores lower Distinctness when bull and bear arguments overlap significantly', async () => {
    const { evaluateDebate } = await import('../../evaluation/evaluationHarness.js');
    const distinct = buildValidDebate('Apple');
    const overlapping = buildDebateWithOverlappingArguments('Apple');
    const distinctResult = evaluateDebate(distinct, 'Apple Inc.', 'AAPL');
    const overlapResult = evaluateDebate(overlapping, 'Apple Inc.', 'AAPL');
    expect(distinctResult.scores.Distinctness).toBeGreaterThan(overlapResult.scores.Distinctness);
  });

  it('scores higher Methodology when Feroldi/Buffett terms are present', async () => {
    const { evaluateDebate } = await import('../../evaluation/evaluationHarness.js');
    const withMethodology = buildDebateWithMethodologyTerms('Apple');
    const withoutMethodology = buildValidDebate('Apple');
    const highScore = evaluateDebate(withMethodology, 'Apple Inc.', 'AAPL');
    const lowScore = evaluateDebate(withoutMethodology, 'Apple Inc.', 'AAPL');
    expect(highScore.scores.Methodology).toBeGreaterThanOrEqual(lowScore.scores.Methodology);
  });

  it('returns ticker and companyName on the result', async () => {
    const { evaluateDebate } = await import('../../evaluation/evaluationHarness.js');
    const debate = buildValidDebate('Apple');
    const result = evaluateDebate(debate, 'Apple Inc.', 'AAPL');
    expect(result.ticker).toBe('AAPL');
    expect(result.companyName).toBe('Apple Inc.');
  });
});

describe('generateEvaluationReport', () => {
  it('returns a non-empty markdown report string', async () => {
    const { evaluateDebate, generateEvaluationReport } = await import('../../evaluation/evaluationHarness.js');
    const results = [
      evaluateDebate(buildValidDebate('Apple'), 'Apple Inc.', 'AAPL'),
      evaluateDebate(buildValidDebate('Microsoft'), 'Microsoft Corporation', 'MSFT'),
    ];
    const report = generateEvaluationReport(results);
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('includes each ticker in the report', async () => {
    const { evaluateDebate, generateEvaluationReport } = await import('../../evaluation/evaluationHarness.js');
    const results = [
      evaluateDebate(buildValidDebate('Apple'), 'Apple Inc.', 'AAPL'),
      evaluateDebate(buildValidDebate('Microsoft'), 'Microsoft Corporation', 'MSFT'),
    ];
    const report = generateEvaluationReport(results);
    expect(report).toContain('AAPL');
    expect(report).toContain('MSFT');
  });

  it('includes all five criteria names in the report header', async () => {
    const { evaluateDebate, generateEvaluationReport } = await import('../../evaluation/evaluationHarness.js');
    const results = [evaluateDebate(buildValidDebate('Apple'), 'Apple Inc.', 'AAPL')];
    const report = generateEvaluationReport(results);
    expect(report).toContain('Specificity');
    expect(report).toContain('Distinctness');
    expect(report).toContain('Accuracy');
    expect(report).toContain('Actionability');
    expect(report).toContain('Methodology');
  });

  it('includes an overall average section at the end of the report', async () => {
    const { evaluateDebate, generateEvaluationReport } = await import('../../evaluation/evaluationHarness.js');
    const results = [
      evaluateDebate(buildValidDebate('Apple'), 'Apple Inc.', 'AAPL'),
      evaluateDebate(buildValidDebate('Microsoft'), 'Microsoft Corporation', 'MSFT'),
    ];
    const report = generateEvaluationReport(results);
    expect(report.toLowerCase()).toContain('average');
  });
});

// ─── Test fixture helpers ────────────────────────────────────────────────────

function buildValidDebate(companyName: string) {
  return {
    bullCase: {
      arguments: [
        {
          title: 'Revenue growth',
          detail: `${companyName} grew revenue 8% YoY to $383B driven by Services.`,
          citation: '10-K FY2023, p. 22 — Segment Results',
        },
        {
          title: 'Free cash flow strength',
          detail: `${companyName} generated $90B in free cash flow in FY2023.`,
          citation: '10-K FY2023, p. 44 — Cash Flow Statement',
        },
        {
          title: 'Ecosystem moat',
          detail: `${companyName} has 2B active devices with high switching costs and recurring revenue.`,
          citation: '10-K FY2023, Business Overview, p. 2',
        },
      ],
      confidence: 0.8,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    bearCase: {
      riskFactors: [
        {
          title: 'China concentration risk',
          detail: `${companyName} derives 19% of revenue from China, which faces geopolitical headwinds.`,
          dataPoint: 'China revenue $72.6B FY2023 — 19% of total',
        },
        {
          title: 'Hardware saturation',
          detail: `${companyName} iPhone segment declined 2.3% YoY as developed markets reach saturation.`,
          dataPoint: 'iPhone revenue $200.6B FY2023 vs $205.5B FY2022',
        },
      ],
      confidence: 0.65,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    synthesis: {
      keyFactors: [
        {
          title: 'Services growth trajectory',
          analysis: `Whether ${companyName} can sustain double-digit Services growth determines thesis conviction.`,
        },
        {
          title: 'China revenue resilience',
          analysis: 'Geopolitical risk and domestic competition are the primary swing factors.',
        },
      ],
      recommendation: 'HOLD',
      confidence: 0.72,
      disclaimer:
        'This analysis is for informational purposes only and does not constitute financial advice.',
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
  };
}

function buildDebateWithNoCitations(companyName: string) {
  return {
    bullCase: {
      arguments: [
        {
          title: 'Revenue growth',
          detail: `${companyName} grew revenue strongly last year.`,
          citation: '',
        },
        {
          title: 'Good business',
          detail: `${companyName} is a strong business with recurring revenue.`,
          citation: '',
        },
      ],
      confidence: 0.7,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    bearCase: {
      riskFactors: [
        {
          title: 'Market risk',
          detail: `${companyName} faces various market risks.`,
          dataPoint: '',
        },
      ],
      confidence: 0.5,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    synthesis: {
      keyFactors: [{ title: 'Overall outlook', analysis: 'Balanced view.' }],
      recommendation: 'HOLD',
      confidence: 0.6,
      disclaimer: 'Not financial advice.',
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
  };
}

function buildDebateWithOverlappingArguments(companyName: string) {
  return {
    bullCase: {
      arguments: [
        {
          title: 'Revenue growth',
          detail: `${companyName} revenue grew 8% YoY.`,
          citation: '10-K p.22',
        },
      ],
      confidence: 0.7,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    bearCase: {
      riskFactors: [
        {
          title: 'Revenue growth',
          detail: `${companyName} revenue growth is decelerating rapidly.`,
          dataPoint: 'Growth fell from 15% to 2%',
        },
      ],
      confidence: 0.6,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    synthesis: {
      keyFactors: [{ title: 'Growth outlook', analysis: 'Contested thesis.' }],
      recommendation: 'HOLD',
      confidence: 0.6,
      disclaimer: 'Not financial advice.',
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
  };
}

function buildDebateWithMethodologyTerms(companyName: string) {
  return {
    bullCase: {
      arguments: [
        {
          title: 'Durable competitive advantage',
          detail: `${companyName} has a wide economic moat from its ecosystem and brand, with strong free cash flow yield and return on invested capital above 30%. The Feroldi quality score rates ${companyName} highly on revenue predictability.`,
          citation: '10-K FY2023, p. 22',
        },
        {
          title: 'Management capital allocation',
          detail: `${companyName} demonstrates Buffett-style capital allocation discipline with consistent share buybacks and dividend growth.`,
          citation: '10-K FY2023, p. 30',
        },
        {
          title: 'Revenue quality',
          detail: `${companyName} recurring revenue from services represents durable earnings power with expanding margins.`,
          citation: '10-K FY2023, p. 24',
        },
      ],
      confidence: 0.85,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    bearCase: {
      riskFactors: [
        {
          title: 'Valuation premium risk',
          detail: `${companyName} trades at a significant premium to intrinsic value estimates. Using discounted cash flow analysis with a 10% discount rate, the margin of safety is thin.`,
          dataPoint: 'P/E ~28x vs. fair value estimate of ~22x',
        },
        {
          title: 'Competitive moat erosion',
          detail: `${companyName} faces threats to its competitive position from well-funded rivals.`,
          dataPoint: 'Market share flat at 17% in key segments',
        },
      ],
      confidence: 0.65,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
    synthesis: {
      keyFactors: [
        {
          title: 'Moat durability',
          analysis: `The key investment question is whether ${companyName}'s competitive advantages are durable for the next decade.`,
        },
      ],
      recommendation: 'HOLD',
      confidence: 0.72,
      disclaimer: 'Not financial advice.',
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
  };
}
