import type { LLMOptions } from '../llm/types.js';

export interface BullCaseV2PromptParams {
  ticker: string;
  companyName: string;
  financialData: string;
  filingContext: string;
}

/** LLM options for v2 bull case generation. */
export const BULL_CASE_V2_OPTIONS: LLMOptions = {
  maxTokens: 1800,
  temperature: 0.7,
};

/**
 * v2 bull case prompt — improvements over v1:
 * 1. Explicit Feroldi quality-score methodology integration
 * 2. Mandatory SEC filing citation format (10-K / 10-Q page reference)
 * 3. Stronger grounding instructions — no generic claims
 * 4. Free cash flow, moat, and revenue quality explicitly required
 */
export function buildBullCasePromptV2(params: BullCaseV2PromptParams): string {
  const { ticker, companyName, financialData, filingContext } = params;
  return `You are an experienced equity analyst trained in the Feroldi Business Quality Score methodology and Buffett value-investing principles.

Your task: generate an OPTIMISTIC investment thesis (bull case) for ${companyName} (${ticker}).

## Financial Data
${financialData}

## SEC Filing Context
${filingContext}

## Instructions
Identify 3-5 of the strongest bull case arguments. Each argument MUST:

1. **Citation requirement**: Reference a specific 10-K or 10-Q filing with page number or section (e.g., "10-K FY2023, p. 22 — Segment Results"). Generic references such as "annual report" are not acceptable.
2. **Feroldi methodology**: At least one argument must address the Feroldi quality dimensions: revenue predictability, free cash flow generation, economic moat (switching costs, network effects, pricing power), or management capital allocation quality.
3. **Data grounding**: Include at least one specific metric ($ amount, %, growth rate, or ratio) per argument.
4. **Focus areas**: Prioritise durable competitive advantages, free cash flow yield, revenue quality, and management execution.
5. **Company specificity**: Mention "${companyName}" explicitly in each argument detail.

## Output Format
Respond ONLY with valid JSON — no markdown, no commentary. Structure:

{
  "arguments": [
    {
      "title": "short title of the argument (max 8 words)",
      "detail": "2-3 sentence explanation grounded in the data, mentioning ${companyName}",
      "citation": "mandatory: exact 10-K or 10-Q reference with page/section (e.g., '10-K FY2023, p. 42 — Cash Flow Statement')"
    }
  ],
  "confidence": 0.0,
  "generatedAt": "${new Date().toISOString()}"
}

Set "confidence" to a float between 0.0 and 1.0 reflecting how compelling the bull case is based on the evidence provided.`;
}
