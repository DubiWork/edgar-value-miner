/* global process */
/**
 * Validates Playwright configuration matches CI requirements.
 *
 * Since vitest cannot resolve @playwright/test imports, we parse the raw
 * config source and verify key structural properties via string matching.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Playwright configuration', () => {
  let src;

  beforeAll(() => {
    const configPath = resolve(process.cwd(), 'playwright.config.js');
    src = readFileSync(configPath, 'utf-8');
  });

  // -- Projects ---------------------------------------------------------------

  it('defines a "smoke" named project with testMatch for smoke.spec.js', () => {
    expect(src).toContain("name: 'smoke'");
    expect(src).toContain("testMatch: 'smoke.spec.js'");
  });

  it('defines a "regression" named project with testDir ./e2e/regression', () => {
    expect(src).toContain("name: 'regression'");
    expect(src).toContain("testDir: './e2e/regression'");
  });

  it('defines a "features" named project with testDir ./e2e/features', () => {
    expect(src).toContain("name: 'features'");
    expect(src).toContain("testDir: './e2e/features'");
  });

  it('defines a "chromium" project', () => {
    expect(src).toContain("name: 'chromium'");
  });

  // -- Timeouts ---------------------------------------------------------------

  it('sets global timeout to 30 seconds', () => {
    expect(src).toMatch(/timeout:\s*30[_,]?000/);
  });

  it('sets actionTimeout to 10 seconds', () => {
    expect(src).toMatch(/actionTimeout:\s*10[_,]?000/);
  });

  it('sets navigationTimeout to 5 seconds', () => {
    expect(src).toMatch(/navigationTimeout:\s*5[_,]?000/);
  });

  it('sets expect timeout to 5 seconds', () => {
    expect(src).toMatch(/expect:\s*\{\s*timeout:\s*5[_,]?000/);
  });

  // -- Retries ----------------------------------------------------------------

  it('configures retries: 0 locally, 2 in CI', () => {
    expect(src).toMatch(/retries:\s*process\.env\.CI\s*\?\s*2\s*:\s*0/);
  });

  // -- Reporter ---------------------------------------------------------------

  it('has HTML reporter with outputFolder playwright-report for CI', () => {
    expect(src).toContain("open: 'never'");
    expect(src).toContain("outputFolder: 'playwright-report'");
  });

  it('has github reporter for CI', () => {
    expect(src).toContain("'github'");
  });

  // -- BASE_URL ---------------------------------------------------------------

  it('uses BASE_URL env var for remote deployments', () => {
    expect(src).toContain('process.env.BASE_URL');
  });

  it('falls back to localhost when BASE_URL is not set', () => {
    expect(src).toContain('localhost');
  });

  // -- All projects use Chromium -----------------------------------------------

  it('uses Chromium device for all projects', () => {
    const matches = src.match(/devices\['Desktop Chrome'\]/g);
    expect(matches).toHaveLength(4);
  });
});
