import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/services/edgarApi.js',
        'src/services/edgarCache.js',
        'src/services/firestoreCache.js',
        'src/services/cacheCoordinator.js',
        'src/services/cacheInvalidation.js',
        'src/hooks/useTickerAutocomplete.js',
        'src/hooks/useRecentSearches.js',
        'src/components/TickerSearch/TickerSearch.jsx',
        'src/contexts/ThemeProvider.jsx',
        'src/hooks/useTheme.js',
        'src/components/ThemeToggle.jsx',
        'src/utils/storage.js',
      ],
      exclude: [
        'src/**/__tests__/**',
        'src/test-setup.js',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
