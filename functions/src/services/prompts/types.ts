/**
 * Output types for AI Bull vs Bear Debate generation.
 */

export interface Argument {
  title: string;
  detail: string;
  citation: string;
}

export interface RiskFactor {
  title: string;
  detail: string;
  dataPoint: string;
}

export interface Factor {
  title: string;
  analysis: string;
}

export interface BullCase {
  arguments: Argument[];
  confidence: number;
  generatedAt: string;
}

export interface BearCase {
  riskFactors: RiskFactor[];
  confidence: number;
  generatedAt: string;
}

export interface Synthesis {
  keyFactors: Factor[];
  recommendation: string;
  confidence: number;
  disclaimer: string;
  generatedAt: string;
}

export interface DebateOutput {
  bullCase: BullCase;
  bearCase: BearCase;
  synthesis: Synthesis;
}

// ─── Runtime guards ───────────────────────────────────────────────────────────

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function isValidArgument(val: unknown): val is Argument {
  if (!isObject(val)) return false;
  return (
    typeof val['title'] === 'string' &&
    typeof val['detail'] === 'string' &&
    typeof val['citation'] === 'string'
  );
}

export function isValidRiskFactor(val: unknown): val is RiskFactor {
  if (!isObject(val)) return false;
  return (
    typeof val['title'] === 'string' &&
    typeof val['detail'] === 'string' &&
    typeof val['dataPoint'] === 'string'
  );
}

export function isValidFactor(val: unknown): val is Factor {
  if (!isObject(val)) return false;
  return (
    typeof val['title'] === 'string' &&
    typeof val['analysis'] === 'string'
  );
}

function isConfidenceInRange(val: unknown): val is number {
  return typeof val === 'number' && val >= 0 && val <= 1;
}

export function isValidBullCase(val: unknown): val is BullCase {
  if (!isObject(val)) return false;
  if (!Array.isArray(val['arguments']) || val['arguments'].length === 0) return false;
  if (!val['arguments'].every(isValidArgument)) return false;
  if (!isConfidenceInRange(val['confidence'])) return false;
  if (typeof val['generatedAt'] !== 'string') return false;
  return true;
}

export function isValidBearCase(val: unknown): val is BearCase {
  if (!isObject(val)) return false;
  if (!Array.isArray(val['riskFactors']) || val['riskFactors'].length === 0) return false;
  if (!val['riskFactors'].every(isValidRiskFactor)) return false;
  if (!isConfidenceInRange(val['confidence'])) return false;
  if (typeof val['generatedAt'] !== 'string') return false;
  return true;
}

export function isValidSynthesis(val: unknown): val is Synthesis {
  if (!isObject(val)) return false;
  if (!Array.isArray(val['keyFactors']) || val['keyFactors'].length === 0) return false;
  if (!val['keyFactors'].every(isValidFactor)) return false;
  if (typeof val['recommendation'] !== 'string') return false;
  if (!isConfidenceInRange(val['confidence'])) return false;
  if (typeof val['disclaimer'] !== 'string') return false;
  if (typeof val['generatedAt'] !== 'string') return false;
  return true;
}

export function isValidDebateOutput(val: unknown): val is DebateOutput {
  if (!isObject(val)) return false;
  return (
    isValidBullCase(val['bullCase']) &&
    isValidBearCase(val['bearCase']) &&
    isValidSynthesis(val['synthesis'])
  );
}
