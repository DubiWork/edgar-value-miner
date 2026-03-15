import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * TDD RED phase — golden file regression tests.
 * Ensures AAPL.json is a valid DebateOutput and passes the evaluator.
 */
describe('AAPL golden file', () => {
  it('can be parsed as valid JSON', () => {
    const filePath = join(__dirname, '../../services/prompts/goldenFiles/AAPL.json');
    const raw = readFileSync(filePath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('satisfies the DebateOutput schema', async () => {
    const { isValidDebateOutput } = await import('../../services/prompts/types.js');
    const filePath = join(__dirname, '../../services/prompts/goldenFiles/AAPL.json');
    const output = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(isValidDebateOutput(output)).toBe(true);
  });

  it('passes the evaluation harness with company name Apple', async () => {
    const { evaluateDebateOutput } = await import('../../services/prompts/evaluation.js');
    const filePath = join(__dirname, '../../services/prompts/goldenFiles/AAPL.json');
    const output = JSON.parse(readFileSync(filePath, 'utf8'));
    const result = evaluateDebateOutput(output, 'Apple');
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('matches itself in golden file comparison (self-referential regression)', async () => {
    const { compareToGoldenFile } = await import('../../services/prompts/evaluation.js');
    const filePath = join(__dirname, '../../services/prompts/goldenFiles/AAPL.json');
    const output = JSON.parse(readFileSync(filePath, 'utf8'));
    const result = compareToGoldenFile(output, output);
    expect(result.match).toBe(true);
    expect(result.differences).toHaveLength(0);
  });
});
