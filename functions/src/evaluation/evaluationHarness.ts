import type {
  CriteriaScores,
  DebateEvaluationResult,
  EvaluationCriterion,
} from './evaluationTypes.js';

/**
 * Minimum debate shape expected by the harness.
 * Mirrors DebateOutput from services/prompts/types.ts without re-importing
 * to keep the evaluation layer decoupled.
 */
interface DebateArg {
  title: string;
  detail: string;
  citation?: string;
}

interface DebateRiskFactor {
  title: string;
  detail: string;
  dataPoint?: string;
}

interface DebateKeyFactor {
  title: string;
  analysis: string;
}

interface EvaluatableDebate {
  bullCase: {
    arguments: DebateArg[];
    confidence: number;
    generatedAt: string;
  };
  bearCase: {
    riskFactors: DebateRiskFactor[];
    confidence: number;
    generatedAt: string;
  };
  synthesis: {
    keyFactors: DebateKeyFactor[];
    recommendation: string;
    confidence: number;
    disclaimer: string;
    generatedAt: string;
  };
}

// ─── Scoring constants ───────────────────────────────────────────────────────

/** Regex patterns that signal SEC filing citations. */
const SEC_CITATION_PATTERN = /10-K|10-Q|8-K|annual report|quarterly report|p\.\s*\d+/i;

/**
 * Keywords from Feroldi's Business Quality Score and Buffett's framework.
 * Presence of these terms signals methodology alignment.
 */
const METHODOLOGY_KEYWORDS = [
  'feroldi',
  'buffett',
  'free cash flow',
  'economic moat',
  'competitive advantage',
  'return on invested capital',
  'roic',
  'intrinsic value',
  'margin of safety',
  'durable',
  'switching costs',
  'network effect',
  'pricing power',
  'capital allocation',
  'revenue quality',
];

/**
 * Keywords that make a recommendation actionable — the investor can
 * actually DO something based on the analysis.
 */
const ACTIONABILITY_KEYWORDS = [
  'monitor',
  'watch',
  'track',
  'if',
  'when',
  'catalyst',
  'trigger',
  'threshold',
  'consider',
  'entry',
  'exit',
  'position',
];

// ─── Criterion scorers ───────────────────────────────────────────────────────

/**
 * Specificity (1-5): Measures whether arguments are grounded with data.
 * - Citations in bull args: +1 each (max 3)
 * - dataPoints in bear args: +1 each (max 2)
 * Score maps to 1-5 range.
 */
function scoreSpecificity(debate: EvaluatableDebate): number {
  const bullCitationCount = debate.bullCase.arguments.filter(
    (a) => a.citation && SEC_CITATION_PATTERN.test(a.citation)
  ).length;

  const bearDataPointCount = debate.bearCase.riskFactors.filter(
    (r) => r.dataPoint && r.dataPoint.trim().length > 5
  ).length;

  // Each bull citation: +0.6, each bear data point: +0.5, baseline 1
  const raw = 1 + bullCitationCount * 0.6 + bearDataPointCount * 0.5;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

/**
 * Distinctness (1-5): Measures whether bull and bear are non-overlapping.
 * - No duplicate titles: base score 5
 * - Each overlapping title: -2
 */
function scoreDistinctness(debate: EvaluatableDebate): number {
  const bullTitles = debate.bullCase.arguments.map((a) => a.title.toLowerCase().trim());
  const bearTitles = debate.bearCase.riskFactors.map((r) => r.title.toLowerCase().trim());
  const overlaps = bullTitles.filter((t) => bearTitles.includes(t)).length;
  const raw = 5 - overlaps * 2;
  return Math.min(5, Math.max(1, raw));
}

/**
 * Accuracy (1-5): Measures whether numerical data points are present.
 * - Numbers (%, $, B, M) in argument details: +0.5 each (max 4)
 */
function scoreAccuracy(debate: EvaluatableDebate): number {
  const NUMBER_PATTERN = /[\d]+\.?\d*\s*(%|\$|B|M|bn|m|billion|million|x\s|\d{4})/i;
  const allDetails = [
    ...debate.bullCase.arguments.map((a) => a.detail),
    ...debate.bearCase.riskFactors.map((r) => r.detail + (r.dataPoint ?? '')),
  ];
  const countWithNumbers = allDetails.filter((d) => NUMBER_PATTERN.test(d)).length;
  const raw = 1 + countWithNumbers * 0.5;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

/**
 * Actionability (1-5): Measures how useful the synthesis is for decision-making.
 * - Actionability keywords in synthesis analysis: +0.7 each (max 4)
 */
function scoreActionability(debate: EvaluatableDebate): number {
  const synthText = debate.synthesis.keyFactors
    .map((f) => f.title.toLowerCase() + ' ' + f.analysis.toLowerCase())
    .join(' ');

  const matchCount = ACTIONABILITY_KEYWORDS.filter((kw) => synthText.includes(kw)).length;
  const raw = 1 + matchCount * 0.7;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

/**
 * Methodology (1-5): Measures alignment with Feroldi/Buffett frameworks.
 * - Each methodology keyword found across all text: +0.4 (max 4)
 */
function scoreMethodology(debate: EvaluatableDebate): number {
  const allText = [
    ...debate.bullCase.arguments.map((a) => a.detail + ' ' + a.title),
    ...debate.bearCase.riskFactors.map((r) => r.detail + ' ' + r.title + ' ' + (r.dataPoint ?? '')),
    ...debate.synthesis.keyFactors.map((f) => f.analysis + ' ' + f.title),
  ]
    .join(' ')
    .toLowerCase();

  const matchCount = METHODOLOGY_KEYWORDS.filter((kw) => allText.includes(kw)).length;
  const raw = 1 + matchCount * 0.4;
  return Math.min(5, Math.max(1, Math.round(raw)));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluates a debate output against all 5 quality criteria.
 *
 * @param debate - The debate output to evaluate (must conform to EvaluatableDebate shape)
 * @param companyName - Human-readable company name (e.g. 'Apple Inc.')
 * @param ticker - Stock ticker symbol (e.g. 'AAPL')
 */
export function evaluateDebate(
  debate: unknown,
  companyName: string,
  ticker: string
): DebateEvaluationResult {
  const d = debate as EvaluatableDebate;

  const scores: CriteriaScores = {
    Specificity: scoreSpecificity(d),
    Distinctness: scoreDistinctness(d),
    Accuracy: scoreAccuracy(d),
    Actionability: scoreActionability(d),
    Methodology: scoreMethodology(d),
  };

  const criteriaList: EvaluationCriterion[] = [
    'Specificity',
    'Distinctness',
    'Accuracy',
    'Actionability',
    'Methodology',
  ];
  const overallScore = criteriaList.reduce((sum, c) => sum + scores[c], 0) / criteriaList.length;

  return { ticker, companyName, scores, overallScore };
}

/**
 * Generates a Markdown evaluation report from a list of evaluation results.
 *
 * @param results - Array of DebateEvaluationResult from evaluateDebate()
 */
export function generateEvaluationReport(results: DebateEvaluationResult[]): string {
  const criteriaList: EvaluationCriterion[] = [
    'Specificity',
    'Distinctness',
    'Accuracy',
    'Actionability',
    'Methodology',
  ];

  const header = `# Prompt Quality Evaluation Report

## Criteria
- **Specificity** (1-5): Are arguments grounded in SEC filing citations and specific data points?
- **Distinctness** (1-5): Are bull and bear arguments non-overlapping and complementary?
- **Accuracy** (1-5): Are numerical metrics present and verifiable?
- **Actionability** (1-5): Does the synthesis give the investor something to monitor or act on?
- **Methodology** (1-5): Does the analysis reference Feroldi/Buffett frameworks explicitly?

## Results

| Ticker | Specificity | Distinctness | Accuracy | Actionability | Methodology | Overall |
|--------|-------------|--------------|----------|---------------|-------------|---------|
`;

  const rows = results
    .map((r) => {
      const cols = criteriaList.map((c) => r.scores[c]).join(' | ');
      return `| ${r.ticker} | ${cols} | ${r.overallScore.toFixed(2)} |`;
    })
    .join('\n');

  const totals: Record<EvaluationCriterion, number> = {
    Specificity: 0,
    Distinctness: 0,
    Accuracy: 0,
    Actionability: 0,
    Methodology: 0,
  };

  for (const r of results) {
    for (const c of criteriaList) {
      totals[c] += r.scores[c];
    }
  }

  const count = results.length || 1;
  const avgCols = criteriaList.map((c) => (totals[c] / count).toFixed(2)).join(' | ');
  const overallAvg = (results.reduce((s, r) => s + r.overallScore, 0) / count).toFixed(2);

  const footer = `

## Average Scores (${results.length} companies evaluated)

| Metric | Specificity | Distinctness | Accuracy | Actionability | Methodology | Overall Average |
|--------|-------------|--------------|----------|---------------|-------------|-----------------|
| Average | ${avgCols} | ${overallAvg} |
`;

  return header + rows + footer;
}
