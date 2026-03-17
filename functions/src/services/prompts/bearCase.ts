import type { LLMOptions } from '../llm/types.js';

export interface BearCasePromptParams {
  ticker: string;
  companyName: string;
  financialData: string;
  filingContext: string;
}

/** LLM options for bear case generation. Temperature 0.7 encourages diverse risk identification. */
export const BEAR_CASE_OPTIONS: LLMOptions = {
  maxTokens: 1500,
  temperature: 0.7,
};

/**
 * Builds the bear case prompt string.
 * The LLM service calls this output — this function only renders the text.
 */
export function buildBearCasePrompt(params: BearCasePromptParams): string {
  const { ticker, companyName, financialData, filingContext } = params;
  return `You are a skeptical equity analyst trained to stress-test investment theses and identify risks.

Your task: generate a PESSIMISTIC investment thesis (bear case) for ${companyName} (${ticker}).

## Financial Data
${financialData}

## SEC Filing Context
${filingContext}

## Instructions
- Identify 3-5 of the most significant risk factors and bear case arguments from the data above.
- Each risk factor must reference specific data points, metrics, or filing details.
- Focus on valuation risks, competitive threats, margin pressure, balance sheet concerns, and macro headwinds.
- Mention "${companyName}" explicitly in each risk factor detail to ground the analysis.

## Output Format
Respond ONLY with valid JSON — no markdown, no commentary. Structure:

{
  "riskFactors": [
    {
      "title": "short title of the risk (max 8 words)",
      "detail": "2-3 sentence explanation of the risk, mentioning ${companyName}",
      "dataPoint": "specific metric or data point supporting this risk (e.g., 'Gross margin declined from 43% to 38% YoY')"
    }
  ],
  "confidence": 0.0,
  "generatedAt": "${new Date().toISOString()}"
}

Set "confidence" to a float between 0.0 and 1.0 reflecting how compelling the bear case is based on the evidence provided.`;
}
