import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Backend (node) tests have no CSS; disabling css processing prevents Vite
  // from walking up to the repo-root postcss.config.js (which needs
  // @tailwindcss/postcss, not installed in functions/).
  css: false,
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
