import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL || '/',
  server: {
    proxy: {
      // Proxy SEC tickers API to avoid CORS issues in development
      '/api/sec-tickers': {
        target: 'https://www.sec.gov',
        changeOrigin: true,
        rewrite: () => '/files/company_tickers.json',
      },
    },
  },
})
