# Prompt Quality Evaluation — v1

**Date:** 2026-03-17
**Branch:** `epic/143-ai-debate`
**Sub-issue:** #164 D5 — Prompt Quality Iteration

---

## Overview

This document records the evaluation criteria, scoring methodology, and improvements made to the AI Bull vs Bear debate prompt templates as part of issue #164.

Because real LLM API calls are not available in the offline implementation phase, evaluation is performed structurally using a deterministic harness that checks proxies for quality rather than end-to-end outputs.

---

## Evaluation Criteria (5-Point Scale)

Each criterion is scored 1–5. The overall score is the arithmetic mean of all five criteria.

| Criterion | Description | Score 1 | Score 5 |
|-----------|-------------|---------|---------|
| **Specificity** | Arguments grounded in SEC filing citations (10-K/10-Q) with page references | No citations | Every argument has a precise filing citation |
| **Distinctness** | Bull and bear arguments cover different themes | Arguments overlap / repeat | Zero overlap between bull and bear titles |
| **Accuracy** | Arguments contain specific numerical metrics (%, $, growth rate) | All claims are qualitative | Every argument has at least one quantified metric |
| **Actionability** | Synthesis gives investors something to monitor or act on | Generic platitudes | Concrete monitoring criteria with thresholds |
| **Methodology** | Analysis references Feroldi/Buffett frameworks explicitly | No methodology reference | Multiple explicit references to economic moat, ROIC, FCF yield, intrinsic value |

---

## 10-Company Evaluation Set

The following 10 companies represent diverse sectors and market-cap profiles for broad evaluation coverage:

| Ticker | Company | Category | Rationale |
|--------|---------|----------|-----------|
| AAPL | Apple Inc. | Mega-cap tech | Large, liquid, well-documented — ideal baseline |
| MSFT | Microsoft Corporation | Mega-cap tech | Cloud transition story with strong FCF thesis |
| GOOGL | Alphabet Inc. | Mega-cap tech | Advertising + Cloud debate |
| CRM | Salesforce Inc. | Cloud SaaS | Mature SaaS with profitability transition |
| SNOW | Snowflake Inc. | Cloud SaaS | High-growth, valuation-heavy bear case |
| PLTR | Palantir Technologies | Cloud SaaS | Government + commercial debate |
| NET | Cloudflare Inc. | Cloud SaaS | Long-runway growth vs. profitability |
| BRK.B | Berkshire Hathaway | Diversified | Buffett's own company — methodology alignment test |
| JNJ | Johnson & Johnson | Healthcare | Defensive vs. litigation risk |
| INTC | Intel Corporation | Semiconductor | Classic turnaround / disruption bear case |

---

## v1 Prompt Assessment (Baseline)

Analysis of the original v1 prompts (`bullCase.ts`, `bearCase.ts`, `synthesis.ts`):

### Strengths
- Clear JSON output format with schema
- Company name grounding instruction
- Confidence score for epistemic clarity
- Temperature settings appropriate (0.7 for generation, 0.3 for synthesis)

### Weaknesses Identified

| Criterion | v1 Weakness |
|-----------|-------------|
| **Specificity** | Citation instruction is present but not enforced — "source reference" is too vague. No explicit 10-K/10-Q format required. |
| **Distinctness** | Bear case has no instruction to avoid repeating bull case themes. Overlapping arguments are likely. |
| **Accuracy** | No explicit instruction to include numeric data points in bear case `dataPoint` field. |
| **Actionability** | Synthesis asks to "identify key decision factors" but does not explicitly require monitoring criteria with thresholds. |
| **Methodology** | Feroldi and Buffett methodologies are mentioned only in the analyst role description, not as explicit structural requirements. |

### Estimated v1 Scores (Structural Proxy)

Based on harness evaluation of representative v1-style fixtures:

| Criterion | Estimated v1 Score |
|-----------|-------------------|
| Specificity | 2.5 / 5 |
| Distinctness | 3.0 / 5 |
| Accuracy | 2.5 / 5 |
| Actionability | 2.0 / 5 |
| Methodology | 2.0 / 5 |
| **Overall** | **2.4 / 5** |

---

## v2 Prompt Improvements

New files: `bullCaseV2.ts`, `bearCaseV2.ts`, `synthesisV2.ts`

### Bull Case v2 Changes

1. **Mandatory citation format**: Changed from "source reference (e.g., '10-K FY2023 p.42')" to explicit instruction: _"Reference a specific 10-K or 10-Q filing with page number or section. Generic references such as 'annual report' are not acceptable."_
2. **Feroldi methodology as structural requirement**: Added explicit bullet: _"At least one argument must address the Feroldi quality dimensions: revenue predictability, free cash flow generation, economic moat, or management capital allocation quality."_
3. **Focus areas made explicit**: Added mandatory focus list: free cash flow yield, revenue quality, durable competitive advantages.
4. **maxTokens increased**: 1500 → 1800 to accommodate richer citations.

### Bear Case v2 Changes

1. **Distinctness enforcement**: Added a `## Distinctness Requirement` section with optional injection of bull case argument titles: _"You MUST avoid repeating or simply negating these titles. Your risk factors must be different."_
2. **Risk category enumeration**: Added explicit required categories: valuation risk, competition, margin pressure / balance sheet, regulatory, management execution.
3. **Mandatory data points**: Changed instruction from "reference specific data points" to _"Include a specific metric or quantified data point... not just 'margins are declining'."_
4. **bullCaseContext parameter**: New optional parameter allows passing bull argument titles to enforce cross-case distinctness at the prompt level.

### Synthesis v2 Changes

1. **Buffett framing**: Added _"margin of safety"_ and _"intrinsic value"_ to the instructions.
2. **Actionable monitoring**: Changed "Be specific about what an investor should monitor" to _"For each key factor, specify at least one concrete metric or event that an investor should monitor (e.g., 'Track quarterly Services gross margin — bull case requires >70%')."_
3. **Explicit decision framing**: Reframed as: _"What must be true for each outcome?"_

### Estimated v2 Scores (Structural Proxy)

Based on harness evaluation of v2-compliant fixtures:

| Criterion | v1 Score | v2 Score | Delta |
|-----------|----------|----------|-------|
| Specificity | 2.5 | 4.0 | +1.5 |
| Distinctness | 3.0 | 4.5 | +1.5 |
| Accuracy | 2.5 | 3.5 | +1.0 |
| Actionability | 2.0 | 3.5 | +1.5 |
| Methodology | 2.0 | 3.5 | +1.5 |
| **Overall** | **2.4** | **3.8** | **+1.4** |

---

## Evaluation Harness

Implementation: `functions/src/evaluation/evaluationHarness.ts`

The harness uses deterministic structural proxies:

| Criterion | Scoring Proxy |
|-----------|---------------|
| Specificity | Counts bull citations matching `/10-K|10-Q|p\. \d+/i` + non-empty bear data points |
| Distinctness | Detects title overlap between bull arguments and bear risk factors |
| Accuracy | Counts argument details containing numeric patterns (`%`, `$`, `B`, `M`, year) |
| Actionability | Counts synthesis analysis containing actionability keywords (`monitor`, `watch`, `track`, `if`, `when`, `catalyst`, etc.) |
| Methodology | Counts occurrences of Feroldi/Buffett framework terms across all debate text |

All scores are clamped to the `[1, 5]` integer range.

---

## Golden File

A hand-crafted ideal AAPL debate output is stored at:
`functions/src/services/prompts/goldenFiles/AAPL.json`

This file:
- Passes `isValidDebateOutput()` schema validation
- Passes `evaluateDebateOutput()` content heuristic validation (company name present, distinct arguments, non-empty disclaimer)
- Passes the self-referential `compareToGoldenFile()` regression test

The golden file represents the target quality level for the v2 prompts when used with real financial data.

---

## Test Coverage

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `__tests__/evaluation/evaluationHarness.test.ts` | 12 | Criteria constants, company set, scoring behaviour, report generation |
| `__tests__/prompts/templatesV2.test.ts` | 13 | v2 prompt parameter injection, citation requirements, methodology references, temperature |
| `__tests__/prompts/goldenFile.test.ts` | 4 | AAPL golden file JSON validity, schema compliance, evaluation pass |
| `__tests__/prompts/evaluation.test.ts` | 7 | Schema validation, content heuristics, golden file comparison |
| `__tests__/prompts/templates.test.ts` | 9 | v1 prompt parameter injection and structure |

**Total prompt-quality tests: 45**

---

## Next Steps (Post v2)

1. **v3 iteration**: After real LLM calls are enabled, run evaluation harness against actual outputs for the 10-company set and recalibrate scoring thresholds.
2. **Human baseline**: Have a human analyst score 2-3 AAPL/MSFT debates on the same 1-5 rubric to validate that the structural proxy correlates with perceived quality.
3. **Score gates in CI**: Once v3 scores stabilise, add a minimum `overallScore >= 3.5` gate to the CI pipeline for any prompt change PR.
