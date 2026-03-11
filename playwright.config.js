/* global process */
import { defineConfig, devices } from '@playwright/test';

/**
 * Use a dedicated port for E2E tests to avoid conflicts with other dev servers
 * that may already be running on the default Vite port (5173).
 *
 * When BASE_URL env var is set (CI/staging/production), use that instead
 * and skip the local web server.
 */
const E2E_PORT = 5174;
const remoteUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['html', { open: 'never', outputFolder: 'playwright-report' }], ['github']]
    : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: remoteUrl || `http://localhost:${E2E_PORT}/edgar-value-miner/`,
    actionTimeout: 10_000,
    navigationTimeout: 5_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'smoke',
      testDir: './e2e',
      testMatch: 'smoke.spec.js',
      testIgnore: ['regression/**', 'features/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'regression',
      testDir: './e2e/regression',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'features',
      testDir: './e2e/features',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  ...(remoteUrl ? {} : {
    webServer: {
      command: `npx vite --port ${E2E_PORT} --strictPort`,
      url: `http://localhost:${E2E_PORT}/edgar-value-miner/`,
      reuseExistingServer: true,
      timeout: 60000,
    },
  }),
});
