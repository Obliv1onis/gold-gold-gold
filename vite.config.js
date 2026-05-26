import { defineConfig } from 'vite';

export default defineConfig({
  // ─── Dev Server ────────────────────────────────────────────────────────────
  server: {
    proxy: {
      // Proxies /api/steam → Steam Community Market priceoverview endpoint.
      // Bypasses CORS (Steam blocks browser fetch; Vite runs server-side).
      // Production requires VITE_PRICE_API_BASE pointing to a serverless proxy.
      // See ADR-0008.
      '/api/steam': {
        target: 'https://steamcommunity.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/steam/, '/market/priceoverview'),
      },
      '/api/steam-search': {
        target: 'https://steamcommunity.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/steam-search/, '/market/search/render'),
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
