import { defineConfig } from 'vite';

export default defineConfig({
  // ─── Dev Server ────────────────────────────────────────────────────────────
  server: {
    proxy: {
      // Proxies /api/price/* → CSFloat API in development.
      // Resolves CORS restriction without needing a production proxy if CSFloat
      // allows browser origins directly. See ADR-0008.
      '/api/price': {
        target: 'https://csfloat.com/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/price/, ''),
      },
    },
  },

  // ─── Build ─────────────────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  // ─── Test (Vitest) ─────────────────────────────────────────────────────────
  // Vitest shares this config — no separate vitest.config.js needed. (ADR-0009)
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/__mocks__/browser-apis.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/main.js'],
    },
  },
});
