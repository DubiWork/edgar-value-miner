/**
 * Types for the prompt quality evaluation harness.
 * Used to score debate outputs on 5 criteria on a 1-5 scale.
 */

/** The five quality criteria used to evaluate debate output. */
export const EVALUATION_CRITERIA = [
  'Specificity',
  'Distinctness',
  'Accuracy',
  'Actionability',
  'Methodology',
] as const;

export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

/** Score map: each criterion maps to a 1-5 integer score. */
export type CriteriaScores = Record<EvaluationCriterion, number>;

/** Result of evaluating a single debate output. */
export interface DebateEvaluationResult {
  ticker: string;
  companyName: string;
  scores: CriteriaScores;
  /** Mean of the five criteria scores. */
  overallScore: number;
  /** Human-readable notes per criterion (optional). */
  notes?: Partial<Record<EvaluationCriterion, string>>;
}

/** A company in the standard 10-company evaluation set. */
export interface EvaluationCompany {
  ticker: string;
  companyName: string;
  /** General category used in test fixtures. */
  category: 'mega-cap-tech' | 'cloud-saas' | 'diversified' | 'semiconductor' | 'healthcare';
}

/**
 * The canonical 10-company evaluation set covering diverse sectors.
 * Used for offline prompt quality assessment.
 */
export const EVALUATION_COMPANY_SET: EvaluationCompany[] = [
  { ticker: 'AAPL', companyName: 'Apple Inc.', category: 'mega-cap-tech' },
  { ticker: 'MSFT', companyName: 'Microsoft Corporation', category: 'mega-cap-tech' },
  { ticker: 'GOOGL', companyName: 'Alphabet Inc.', category: 'mega-cap-tech' },
  { ticker: 'CRM', companyName: 'Salesforce Inc.', category: 'cloud-saas' },
  { ticker: 'SNOW', companyName: 'Snowflake Inc.', category: 'cloud-saas' },
  { ticker: 'PLTR', companyName: 'Palantir Technologies Inc.', category: 'cloud-saas' },
  { ticker: 'NET', companyName: 'Cloudflare Inc.', category: 'cloud-saas' },
  { ticker: 'BRK.B', companyName: 'Berkshire Hathaway Inc.', category: 'diversified' },
  { ticker: 'JNJ', companyName: 'Johnson & Johnson', category: 'healthcare' },
  { ticker: 'INTC', companyName: 'Intel Corporation', category: 'semiconductor' },
];
