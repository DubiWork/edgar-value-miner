import type { BullCase, BearCase, Synthesis } from './types.js';
import { isValidBullCase, isValidBearCase, isValidSynthesis } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Checks whether the company name (case-insensitive) appears in at least one
 * argument detail or title, ensuring the output is grounded in the company.
 */
function companyNamePresent(texts: string[], companyName: string): boolean {
  const lower = companyName.toLowerCase();
  return texts.some((t) => t.toLowerCase().includes(lower));
}

export function validateBullCase(val: unknown, companyName: string): ValidationResult {
  const errors: string[] = [];

  if (!isValidBullCase(val)) {
    if (typeof val !== 'object' || val === null) {
      errors.push('Bull case must be an object');
      return { valid: false, errors };
    }
    const o = val as Record<string, unknown>;
    if (!Array.isArray(o['arguments']) || o['arguments'].length === 0) {
      errors.push('Bull case must have at least one argument');
    }
    const confidence = o['confidence'];
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      errors.push('Bull case confidence must be a number between 0 and 1');
    }
    if (errors.length === 0) errors.push('Bull case has invalid structure');
    return { valid: false, errors };
  }

  // Content heuristics
  const texts = val.arguments.flatMap((a) => [a.title, a.detail]);
  if (!companyNamePresent(texts, companyName)) {
    errors.push(`Company name "${companyName}" not present in bull case arguments — output may not be grounded`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateBearCase(val: unknown, companyName: string): ValidationResult {
  const errors: string[] = [];

  if (!isValidBearCase(val)) {
    if (typeof val !== 'object' || val === null) {
      errors.push('Bear case must be an object');
      return { valid: false, errors };
    }
    const o = val as Record<string, unknown>;
    if (!Array.isArray(o['riskFactors']) || o['riskFactors'].length === 0) {
      errors.push('Bear case must have at least one risk factor');
    }
    const confidence = o['confidence'];
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      errors.push('Bear case confidence must be a number between 0 and 1');
    }
    if (errors.length === 0) errors.push('Bear case has invalid structure');
    return { valid: false, errors };
  }

  // Content heuristics
  const texts = val.riskFactors.flatMap((r) => [r.title, r.detail]);
  if (!companyNamePresent(texts, companyName)) {
    errors.push(`Company name "${companyName}" not present in bear case risk factors — output may not be grounded`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateSynthesis(val: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isValidSynthesis(val)) {
    if (typeof val !== 'object' || val === null) {
      errors.push('Synthesis must be an object');
      return { valid: false, errors };
    }
    const o = val as Record<string, unknown>;
    if (!Array.isArray(o['keyFactors']) || o['keyFactors'].length === 0) {
      errors.push('Synthesis must have at least one key factor');
    }
    if (typeof o['disclaimer'] !== 'string' || (o['disclaimer'] as string).trim() === '') {
      errors.push('Synthesis must include a non-empty disclaimer');
    }
    if (errors.length === 0) errors.push('Synthesis has invalid structure');
    return { valid: false, errors };
  }

  // Content heuristics — disclaimer must be non-empty (already enforced by isValidSynthesis
  // but double-check the trimmed value)
  if (val.disclaimer.trim() === '') {
    errors.push('Synthesis disclaimer must not be blank');
  }

  return { valid: errors.length === 0, errors };
}

export function validateDebateArgumentsAreDistinct(
  bullTitles: string[],
  bearTitles: string[]
): ValidationResult {
  const errors: string[] = [];

  const bullLower = bullTitles.map((t) => t.toLowerCase());
  const bearLower = bearTitles.map((t) => t.toLowerCase());

  const duplicates = bullLower.filter((t) => bearLower.includes(t));
  if (duplicates.length > 0) {
    errors.push(
      `Duplicate argument titles found in bull and bear cases: "${duplicates.join('", "')}". Arguments should be distinct.`
    );
  }

  return { valid: errors.length === 0, errors };
}

/** Convenience — validates a BullCase. */
export { BullCase, BearCase, Synthesis };
