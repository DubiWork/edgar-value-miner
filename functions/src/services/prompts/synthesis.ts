import type { LLMOptions } from '../llm/types.js';

export interface SynthesisPromptParams {
  bullCaseJson: string;
  bearCaseJson: string;
  financialData: string;
}

/** LLM options for synthesis generation. Lower temperature 0.3 for more measured, factual output. */
export const SYNTHESIS_OPTIONS: LLMOptions = {
  maxTokens: 1200,
  temperature: 0.3,
};

/**
 * Builds the synthesis prompt string that weighs bull and bear cases.
 * The LLM service calls this output — this function only renders the text.
 */
export function buildSynthesisPrompt(params: SynthesisPromptParams): string {
  const { bullCaseJson, bearCaseJson, financialData } = params;
  return `You are a balanced investment analyst synthesising competing viewpoints to help investors make informed decisions.

You have received both a bull case and a bear case for a company. Your task is to weigh both sides and produce a balanced synthesis.

## Bull Case
${bullCaseJson}

## Bear Case
${bearCaseJson}

## Financial Data
${financialData}

## Instructions
- Identify 2-4 key decision factors that will determine whether the bull or bear case plays out.
- Provide a balanced recommendation: BUY, HOLD, or WATCH (do not use SELL — this is a long-term framework).
- Be specific about what an investor should monitor.
- Always include an investment disclaimer.

## Output Format
Respond ONLY with valid JSON — no markdown, no commentary. Structure:

{
  "keyFactors": [
    {
      "title": "short title of the factor (max 8 words)",
      "analysis": "2-3 sentence balanced analysis of this factor"
    }
  ],
  "recommendation": "BUY | HOLD | WATCH",
  "confidence": 0.0,
  "disclaimer": "This analysis is for informational purposes only and does not constitute financial advice. Past performance is not indicative of future results. Always conduct your own due diligence before making investment decisions.",
  "generatedAt": "${new Date().toISOString()}"
}

Set "confidence" to a float between 0.0 and 1.0 reflecting your conviction in the recommendation given the evidence.`;
}
