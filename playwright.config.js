/* global process */
import { defineConfig, devices } from '@playwright/test';

/**
 * Use a dedicated port for E2E tests to avoid conflicts with other dev servers
 * that may already be running on the default Vite port (5173).
 */
const E2E_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: `http://localhost:${E2E_PORT}/edgar-value-miner/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npx vite --port ${E2E_PORT} --strictPort`,
    url: `http://localhost:${E2E_PORT}/edgar-value-miner/`,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
