import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: undefined,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Live-network diagnostic script, not a unit/integration test of app
      // code: it makes real fetch() calls against the deployed production
      // domain to inspect Cloudflare Access edge behavior. It is
      // non-deterministic in CI (depends on live CF Access config/propagation,
      // not on anything this repo controls) and violates the "mock external
      // dependencies" testing rule. Run it manually when debugging Cloudflare
      // Access routing by temporarily removing this entry.
      '**/klines-diagnosis.test.ts',
    ],
  },
});
