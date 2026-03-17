import type { DebateOutput } from './types.js';
import {
  validateBullCase,
  validateBearCase,
  validateSynthesis,
  validateDebateArgumentsAreDistinct,
} from './validation.js';

export interface EvaluationResult {
  passed: boolean;
  errors: string[];
}

export interface GoldenFileComparisonResult {
  match: boolean;
  differences: string[];
}

/**
 * Evaluates a DebateOutput for schema validity and content quality.
 * Can be invoked manually or in CI as a regression guard.
 *
 * @param output - The debate output to evaluate (may be raw unknown from LLM)
 * @param companyName - Company name used for content heuristic checks
 */
export function evaluateDebateOutput(output: unknown, companyName: string): EvaluationResult {
  const errors: string[] = [];

  if (typeof output !== 'object' || output === null) {
    return { passed: false, errors: ['Output must be a non-null object'] };
  }

  const o = output as Record<string, unknown>;

  // --- Bull case validation ---
  const bullResult = validateBullCase(o['bullCase'], companyName);
  errors.push(...bullResult.errors);

  // --- Bear case validation ---
  const bearResult = validateBearCase(o['bearCase'], companyName);
  errors.push(...bearResult.errors);

  // --- Synthesis validation ---
  const synthResult = validateSynthesis(o['synthesis']);
  errors.push(...synthResult.errors);

  // --- Cross-case: distinct arguments ---
  if (bullResult.valid && bearResult.valid) {
    const bullCase = o['bullCase'] as { arguments: Array<{ title: string }> };
    const bearCase = o['bearCase'] as { riskFactors: Array<{ title: string }> };
    const bullTitles = bullCase.arguments.map((a) => a.title);
    const bearTitles = bearCase.riskFactors.map((r) => r.title);
    const distinctResult = validateDebateArgumentsAreDistinct(bullTitles, bearTitles);
    errors.push(...distinctResult.errors);
  }

  return { passed: errors.length === 0, errors };
}

/**
 * Compares a DebateOutput against a golden file for structural regression testing.
 * Checks array lengths and key field presence — not exact string matching.
 */
export function compareToGoldenFile(
  actual: DebateOutput,
  golden: DebateOutput
): GoldenFileComparisonResult {
  const differences: string[] = [];

  if (actual.bullCase.arguments.length !== golden.bullCase.arguments.length) {
    differences.push(
      `Bull case argument count mismatch: expected ${golden.bullCase.arguments.length}, got ${actual.bullCase.arguments.length}`
    );
  }

  if (actual.bearCase.riskFactors.length !== golden.bearCase.riskFactors.length) {
    differences.push(
      `Bear case risk factor count mismatch: expected ${golden.bearCase.riskFactors.length}, got ${actual.bearCase.riskFactors.length}`
    );
  }

  if (actual.synthesis.keyFactors.length !== golden.synthesis.keyFactors.length) {
    differences.push(
      `Synthesis key factor count mismatch: expected ${golden.synthesis.keyFactors.length}, got ${actual.synthesis.keyFactors.length}`
    );
  }

  // Check structural field presence in each bull argument
  for (let i = 0; i < actual.bullCase.arguments.length; i++) {
    const arg = actual.bullCase.arguments[i];
    if (!arg.title || !arg.detail || !arg.citation) {
      differences.push(`Bull case argument[${i}] is missing title, detail, or citation`);
    }
  }

  // Check structural field presence in each bear risk factor
  for (let i = 0; i < actual.bearCase.riskFactors.length; i++) {
    const rf = actual.bearCase.riskFactors[i];
    if (!rf.title || !rf.detail || !rf.dataPoint) {
      differences.push(`Bear case riskFactor[${i}] is missing title, detail, or dataPoint`);
    }
  }

  return { match: differences.length === 0, differences };
}
