export type {
  Argument,
  RiskFactor,
  Factor,
  BullCase,
  BearCase,
  Synthesis,
  DebateOutput,
} from './types.js';
export {
  isValidArgument,
  isValidRiskFactor,
  isValidFactor,
  isValidBullCase,
  isValidBearCase,
  isValidSynthesis,
  isValidDebateOutput,
} from './types.js';

export type { BullCasePromptParams } from './bullCase.js';
export { buildBullCasePrompt, BULL_CASE_OPTIONS } from './bullCase.js';

export type { BearCasePromptParams } from './bearCase.js';
export { buildBearCasePrompt, BEAR_CASE_OPTIONS } from './bearCase.js';

export type { SynthesisPromptParams } from './synthesis.js';
export { buildSynthesisPrompt, SYNTHESIS_OPTIONS } from './synthesis.js';

export type { ValidationResult } from './validation.js';
export {
  validateBullCase,
  validateBearCase,
  validateSynthesis,
  validateDebateArgumentsAreDistinct,
} from './validation.js';

export type { EvaluationResult, GoldenFileComparisonResult } from './evaluation.js';
export { evaluateDebateOutput, compareToGoldenFile } from './evaluation.js';
