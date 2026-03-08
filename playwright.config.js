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
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',

  use: {
    baseURL: remoteUrl || `http://localhost:${E2E_PORT}/edgar-value-miner/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
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
