import { describe, it, expect } from 'vitest';

/**
 * TDD RED phase — tests for prompt template rendering.
 * Templates return prompt strings with parameters injected.
 */
describe('buildBullCasePrompt', () => {
  it('injects ticker, companyName, financialData and filingContext into the prompt', async () => {
    const { buildBullCasePrompt } = await import('../../services/prompts/bullCase.js');
    const params = {
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      financialData: 'Revenue: $383B, FCF: $90B, Net Margin: 25%',
      filingContext: '10-K 2023: Services revenue grew 16% YoY',
    };
    const prompt = buildBullCasePrompt(params);
    expect(prompt).toContain('AAPL');
    expect(prompt).toContain('Apple Inc.');
    expect(prompt).toContain('Revenue: $383B');
    expect(prompt).toContain('10-K 2023: Services revenue grew 16% YoY');
  });

  it('instructs the model to return JSON with arguments array', async () => {
    const { buildBullCasePrompt } = await import('../../services/prompts/bullCase.js');
    const params = {
      ticker: 'MSFT',
      companyName: 'Microsoft',
      financialData: 'Revenue: $211B',
      filingContext: 'Cloud revenue up 20%',
    };
    const prompt = buildBullCasePrompt(params);
    expect(prompt.toLowerCase()).toContain('json');
    expect(prompt.toLowerCase()).toContain('arguments');
  });

  it('requires between 3 and 5 arguments', async () => {
    const { buildBullCasePrompt } = await import('../../services/prompts/bullCase.js');
    const params = {
      ticker: 'NVDA',
      companyName: 'NVIDIA',
      financialData: 'Revenue: $60B',
      filingContext: 'Data center revenue tripled',
    };
    const prompt = buildBullCasePrompt(params);
    // Should mention 3-5 arguments
    expect(prompt).toMatch(/3.{0,10}5/);
  });

  it('returns the configured LLM options with temperature 0.7', async () => {
    const { BULL_CASE_OPTIONS } = await import('../../services/prompts/bullCase.js');
    expect(BULL_CASE_OPTIONS.temperature).toBe(0.7);
  });
});

describe('buildBearCasePrompt', () => {
  it('injects ticker, companyName, financialData and filingContext into the prompt', async () => {
    const { buildBearCasePrompt } = await import('../../services/prompts/bearCase.js');
    const params = {
      ticker: 'TSLA',
      companyName: 'Tesla Inc.',
      financialData: 'Revenue: $96B, Margin: 8%',
      filingContext: '10-K 2023: Margin compression due to price cuts',
    };
    const prompt = buildBearCasePrompt(params);
    expect(prompt).toContain('TSLA');
    expect(prompt).toContain('Tesla Inc.');
    expect(prompt).toContain('Revenue: $96B');
    expect(prompt).toContain('Margin compression due to price cuts');
  });

  it('instructs the model to return JSON with riskFactors array', async () => {
    const { buildBearCasePrompt } = await import('../../services/prompts/bearCase.js');
    const params = {
      ticker: 'TSLA',
      companyName: 'Tesla',
      financialData: 'Revenue: $96B',
      filingContext: 'Price cuts hit margins',
    };
    const prompt = buildBearCasePrompt(params);
    expect(prompt.toLowerCase()).toContain('json');
    expect(prompt.toLowerCase()).toContain('riskfactors');
  });

  it('returns the configured LLM options with temperature 0.7', async () => {
    const { BEAR_CASE_OPTIONS } = await import('../../services/prompts/bearCase.js');
    expect(BEAR_CASE_OPTIONS.temperature).toBe(0.7);
  });
});

describe('buildSynthesisPrompt', () => {
  it('injects bullCaseJson, bearCaseJson and financialData into the prompt', async () => {
    const { buildSynthesisPrompt } = await import('../../services/prompts/synthesis.js');
    const params = {
      bullCaseJson: '{"arguments":[{"title":"Growth"}]}',
      bearCaseJson: '{"riskFactors":[{"title":"Risk"}]}',
      financialData: 'P/E: 28, FCF Yield: 3%',
    };
    const prompt = buildSynthesisPrompt(params);
    expect(prompt).toContain('"arguments"');
    expect(prompt).toContain('"riskFactors"');
    expect(prompt).toContain('P/E: 28');
  });

  it('instructs the model to return JSON with keyFactors, recommendation, and disclaimer', async () => {
    const { buildSynthesisPrompt } = await import('../../services/prompts/synthesis.js');
    const params = {
      bullCaseJson: '{}',
      bearCaseJson: '{}',
      financialData: 'Revenue: $100B',
    };
    const prompt = buildSynthesisPrompt(params);
    expect(prompt.toLowerCase()).toContain('json');
    expect(prompt.toLowerCase()).toContain('keyfactors');
    expect(prompt.toLowerCase()).toContain('recommendation');
    expect(prompt.toLowerCase()).toContain('disclaimer');
  });

  it('returns the configured LLM options with temperature 0.3', async () => {
    const { SYNTHESIS_OPTIONS } = await import('../../services/prompts/synthesis.js');
    expect(SYNTHESIS_OPTIONS.temperature).toBe(0.3);
  });
});
