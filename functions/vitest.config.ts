import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Backend (node) tests have no CSS. An explicit empty inline PostCSS config
  // stops Vite from walking up to the repo-root postcss.config.js (which needs
  // @tailwindcss/postcss, not installed in functions/). `css: false` alone does
  // NOT prevent config discovery in this Vite version.
  css: { postcss: {} },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
