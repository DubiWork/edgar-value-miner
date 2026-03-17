export type {
  EvaluationCriterion,
  CriteriaScores,
  DebateEvaluationResult,
  EvaluationCompany,
} from './evaluationTypes.js';
export { EVALUATION_CRITERIA, EVALUATION_COMPANY_SET } from './evaluationTypes.js';
export { evaluateDebate, generateEvaluationReport } from './evaluationHarness.js';
