import type { LLMOptions } from '../llm/types.js';

export interface BullCasePromptParams {
  ticker: string;
  companyName: string;
  financialData: string;
  filingContext: string;
}

/** LLM options for bull case generation. Temperature 0.7 encourages diverse reasoning. */
export const BULL_CASE_OPTIONS: LLMOptions = {
  maxTokens: 1500,
  temperature: 0.7,
};

/**
 * Builds the bull case prompt string.
 * The LLM service calls this output — this function only renders the text.
 */
export function buildBullCasePrompt(params: BullCasePromptParams): string {
  const { ticker, companyName, financialData, filingContext } = params;
  return `You are an experienced equity analyst specialising in value investing, trained on the Feroldi and Buffett methodologies.

Your task: generate an OPTIMISTIC investment thesis (bull case) for ${companyName} (${ticker}).

## Financial Data
${financialData}

## SEC Filing Context
${filingContext}

## Instructions
- Identify 3-5 of the strongest bull case arguments grounded in the financial data and SEC filings above.
- Each argument must reference specific numbers, metrics, or filing citations.
- Focus on durable competitive advantages, revenue quality, free cash flow generation, and management execution.
- Mention "${companyName}" explicitly in each argument detail to ground the analysis.

## Output Format
Respond ONLY with valid JSON — no markdown, no commentary. Structure:

{
  "arguments": [
    {
      "title": "short title of the argument (max 8 words)",
      "detail": "2-3 sentence explanation grounded in the data, mentioning ${companyName}",
      "citation": "source reference (e.g., '10-K FY2023 p.42' or 'Q3 2023 Earnings Call')"
    }
  ],
  "confidence": 0.0,
  "generatedAt": "${new Date().toISOString()}"
}

Set "confidence" to a float between 0.0 and 1.0 reflecting how compelling the bull case is based on the evidence provided.`;
}
