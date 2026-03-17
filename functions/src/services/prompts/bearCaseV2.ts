import type { LLMOptions } from '../llm/types.js';

export interface BearCaseV2PromptParams {
  ticker: string;
  companyName: string;
  financialData: string;
  filingContext: string;
  /**
   * Optional: comma-separated bull case argument titles.
   * Provide this so the bear case can explicitly avoid repeating bull arguments.
   */
  bullCaseContext?: string;
}

/** LLM options for v2 bear case generation. */
export const BEAR_CASE_V2_OPTIONS: LLMOptions = {
  maxTokens: 1800,
  temperature: 0.7,
};

/**
 * v2 bear case prompt — improvements over v1:
 * 1. Explicit distinctness enforcement — must not repeat bull arguments
 * 2. Required risk categories: valuation, competition, balance sheet
 * 3. Mandatory numerical data points per risk factor
 * 4. Stronger instruction to be contrarian, not a mirror of the bull case
 */
export function buildBearCasePromptV2(params: BearCaseV2PromptParams): string {
  const { ticker, companyName, financialData, filingContext, bullCaseContext } = params;

  const distinctnessInstruction = bullCaseContext
    ? `\n## Distinctness Requirement
The bull case already covers these themes: ${bullCaseContext}.
You MUST avoid repeating or simply negating these titles. Your risk factors must be different, covering alternative dimensions of risk not already addressed.`
    : `\n## Distinctness Requirement
Your risk factors must be distinct from any bull case arguments — do not repeat or simply negate the same titles. Each risk must cover a different dimension of risk.`;

  return `You are a skeptical equity analyst specialising in stress-testing investment theses and identifying overlooked risks.

Your task: generate a PESSIMISTIC investment thesis (bear case) for ${companyName} (${ticker}).

## Financial Data
${financialData}

## SEC Filing Context
${filingContext}
${distinctnessInstruction}

## Instructions
Identify 3-5 of the most significant risk factors. Each risk factor MUST:

1. **Risk categories**: Cover at least one of: valuation risk, competition / competitive threat, margin pressure / balance sheet concern, regulatory or macro headwind, or management execution risk.
2. **Data point requirement**: Include a specific metric or quantified data point (e.g., "Gross margin declined from 43% to 38% YoY" — not just "margins are declining").
3. **Company specificity**: Mention "${companyName}" explicitly in each risk factor detail.
4. **Contrarian perspective**: Be genuinely distinct from typical bull-case themes. Ask: what could materially wrong for investors who own this stock?

## Output Format
Respond ONLY with valid JSON — no markdown, no commentary. Structure:

{
  "riskFactors": [
    {
      "title": "short title of the risk (max 8 words)",
      "detail": "2-3 sentence explanation of the risk, mentioning ${companyName}",
      "dataPoint": "mandatory: specific metric supporting this risk (e.g., 'Gross margin 38% vs. 43% prior year; operating leverage deteriorating')"
    }
  ],
  "confidence": 0.0,
  "generatedAt": "${new Date().toISOString()}"
}

Set "confidence" to a float between 0.0 and 1.0 reflecting how compelling the bear case is based on the evidence provided.`;
}
