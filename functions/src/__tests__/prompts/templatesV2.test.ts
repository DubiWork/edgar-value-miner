import { describe, it, expect } from 'vitest';

/**
 * TDD RED phase — tests for v2 prompt templates.
 * v2 prompts have stronger citation requirements, clearer methodology
 * integration, and explicit distinctness enforcement between bull/bear.
 */

describe('buildBullCasePromptV2', () => {
  it('injects ticker, companyName, financialData and filingContext', async () => {
    const { buildBullCasePromptV2 } = await import('../../services/prompts/bullCaseV2.js');
    const prompt = buildBullCasePromptV2({
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      financialData: 'Revenue: $383B, FCF: $90B',
      filingContext: '10-K FY2023: Services grew 16% YoY',
    });
    expect(prompt).toContain('AAPL');
    expect(prompt).toContain('Apple Inc.');
    expect(prompt).toContain('Revenue: $383B');
    expect(prompt).toContain('10-K FY2023: Services grew 16% YoY');
  });

  it('explicitly requires 10-K or 10-Q SEC filing citations in each argument', async () => {
    const { buildBullCasePromptV2 } = await import('../../services/prompts/bullCaseV2.js');
    const prompt = buildBullCasePromptV2({
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      financialData: 'Revenue: $383B',
      filingContext: '10-K data',
    });
    // v2 must mention 10-K or 10-Q as required citation format
    expect(prompt).toMatch(/10-K|10-Q/);
    expect(prompt.toLowerCase()).toContain('citation');
  });

  it('references Feroldi methodology explicitly', async () => {
    const { buildBullCasePromptV2 } = await import('../../services/prompts/bullCaseV2.js');
    const prompt = buildBullCasePromptV2({
      ticker: 'MSFT',
      companyName: 'Microsoft',
      financialData: 'Revenue: $211B',
      filingContext: 'Cloud up 20%',
    });
    expect(prompt.toLowerCase()).toContain('feroldi');
  });

  it('instructs the model to focus on free cash flow, moat and revenue quality', async () => {
    const { buildBullCasePromptV2 } = await import('../../services/prompts/bullCaseV2.js');
    const prompt = buildBullCasePromptV2({
      ticker: 'NVDA',
      companyName: 'NVIDIA',
      financialData: 'Revenue: $60B',
      filingContext: 'Data center revenue tripled',
    });
    expect(prompt.toLowerCase()).toContain('free cash flow');
    expect(prompt.toLowerCase()).toContain('moat');
  });

  it('uses LLM options with temperature 0.7', async () => {
    const { BULL_CASE_V2_OPTIONS } = await import('../../services/prompts/bullCaseV2.js');
    expect(BULL_CASE_V2_OPTIONS.temperature).toBe(0.7);
  });
});

describe('buildBearCasePromptV2', () => {
  it('injects ticker, companyName, financialData and filingContext', async () => {
    const { buildBearCasePromptV2 } = await import('../../services/prompts/bearCaseV2.js');
    const prompt = buildBearCasePromptV2({
      ticker: 'TSLA',
      companyName: 'Tesla Inc.',
      financialData: 'Revenue: $96B, Margin: 8%',
      filingContext: '10-K 2023: Margin compression',
    });
    expect(prompt).toContain('TSLA');
    expect(prompt).toContain('Tesla Inc.');
    expect(prompt).toContain('Revenue: $96B');
    expect(prompt).toContain('Margin compression');
  });

  it('explicitly prohibits repeating bull case arguments (distinctness enforcement)', async () => {
    const { buildBearCasePromptV2 } = await import('../../services/prompts/bearCaseV2.js');
    const prompt = buildBearCasePromptV2({
      ticker: 'TSLA',
      companyName: 'Tesla',
      financialData: 'Revenue: $96B',
      filingContext: 'Price cuts',
      bullCaseContext: 'Revenue growth, Ecosystem moat',
    });
    // v2 must instruct to avoid repeating bull arguments
    expect(prompt.toLowerCase()).toMatch(/distinct|different|avoid|not repeat/);
  });

  it('references specific risk categories: valuation, competition, balance sheet', async () => {
    const { buildBearCasePromptV2 } = await import('../../services/prompts/bearCaseV2.js');
    const prompt = buildBearCasePromptV2({
      ticker: 'NET',
      companyName: 'Cloudflare',
      financialData: 'Revenue: $1.6B',
      filingContext: '10-K data',
    });
    expect(prompt.toLowerCase()).toContain('valuation');
    expect(prompt.toLowerCase()).toContain('competition');
  });

  it('uses LLM options with temperature 0.7', async () => {
    const { BEAR_CASE_V2_OPTIONS } = await import('../../services/prompts/bearCaseV2.js');
    expect(BEAR_CASE_V2_OPTIONS.temperature).toBe(0.7);
  });
});

describe('buildSynthesisPromptV2', () => {
  it('injects bullCaseJson, bearCaseJson and financialData', async () => {
    const { buildSynthesisPromptV2 } = await import('../../services/prompts/synthesisV2.js');
    const prompt = buildSynthesisPromptV2({
      bullCaseJson: '{"arguments":[{"title":"Growth"}]}',
      bearCaseJson: '{"riskFactors":[{"title":"Risk"}]}',
      financialData: 'P/E: 28, FCF Yield: 3%',
    });
    expect(prompt).toContain('"arguments"');
    expect(prompt).toContain('"riskFactors"');
    expect(prompt).toContain('P/E: 28');
  });

  it('explicitly instructs actionable monitoring criteria', async () => {
    const { buildSynthesisPromptV2 } = await import('../../services/prompts/synthesisV2.js');
    const prompt = buildSynthesisPromptV2({
      bullCaseJson: '{}',
      bearCaseJson: '{}',
      financialData: 'Revenue: $100B',
    });
    // v2 must ask for actionable monitoring
    expect(prompt.toLowerCase()).toMatch(/monitor|watch|track|actionable/);
  });

  it('includes Buffett-style framing language in the prompt', async () => {
    const { buildSynthesisPromptV2 } = await import('../../services/prompts/synthesisV2.js');
    const prompt = buildSynthesisPromptV2({
      bullCaseJson: '{}',
      bearCaseJson: '{}',
      financialData: 'Revenue: $100B',
    });
    expect(prompt.toLowerCase()).toMatch(/buffett|intrinsic value|margin of safety/);
  });

  it('uses LLM options with temperature 0.3', async () => {
    const { SYNTHESIS_V2_OPTIONS } = await import('../../services/prompts/synthesisV2.js');
    expect(SYNTHESIS_V2_OPTIONS.temperature).toBe(0.3);
  });
});
