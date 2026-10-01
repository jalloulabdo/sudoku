import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'virtual:pwa-register/react': fileURLToPath(new URL('./tests/mocks/pwa-register.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    testTimeout: 60_000,
  },
});
