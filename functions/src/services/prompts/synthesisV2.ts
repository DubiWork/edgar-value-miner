import type { LLMOptions } from '../llm/types.js';

export interface SynthesisV2PromptParams {
  bullCaseJson: string;
  bearCaseJson: string;
  financialData: string;
}

/** LLM options for v2 synthesis generation. Lower temperature for measured output. */
export const SYNTHESIS_V2_OPTIONS: LLMOptions = {
  maxTokens: 1400,
  temperature: 0.3,
};

/**
 * v2 synthesis prompt — improvements over v1:
 * 1. Explicit Buffett / intrinsic value framing
 * 2. Mandatory actionable monitoring criteria (what to watch)
 * 3. Margin of safety consideration included
 * 4. Clearer investor decision framing
 */
export function buildSynthesisPromptV2(params: SynthesisV2PromptParams): string {
  const { bullCaseJson, bearCaseJson, financialData } = params;
  return `You are a balanced investment analyst synthesising competing viewpoints using Buffett value-investing principles.

You have received both a bull case and a bear case for a company. Your task is to weigh both sides, assess intrinsic value, and produce an actionable synthesis for a long-term investor.

## Bull Case
${bullCaseJson}

## Bear Case
${bearCaseJson}

## Financial Data
${financialData}

## Instructions
1. **Key decision factors**: Identify 2-4 factors that will determine whether the bull or bear case plays out. Be specific about what must be true for each outcome.
2. **Margin of safety**: Comment briefly on whether the current valuation offers a margin of safety or demands near-perfect execution — use Buffett's framework.
3. **Actionable monitoring**: For each key factor, specify at least one concrete metric or event that an investor should monitor (e.g., "Track quarterly Services gross margin — bull case requires >70%").
4. **Recommendation**: Provide a balanced recommendation: BUY, HOLD, or WATCH (do not use SELL — this is a long-term, buy-and-hold framework).
5. **Disclaimer**: Always include an investment disclaimer.

## Output Format
Respond ONLY with valid JSON — no markdown, no commentary. Structure:

{
  "keyFactors": [
    {
      "title": "short title of the factor (max 8 words)",
      "analysis": "2-3 sentences: what this factor means, what to monitor, and what would change the thesis"
    }
  ],
  "recommendation": "BUY | HOLD | WATCH",
  "confidence": 0.0,
  "disclaimer": "This analysis is for informational purposes only and does not constitute financial advice. Past performance is not indicative of future results. Always conduct your own due diligence before making investment decisions.",
  "generatedAt": "${new Date().toISOString()}"
}

Set "confidence" to a float between 0.0 and 1.0 reflecting conviction in the recommendation given the evidence.`;
}
