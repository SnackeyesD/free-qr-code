import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    conditions: ['node'],
    // @cf-wasm/resvg est workerd-only : son glue importe 'wbg',
    // irrésolvable sous Node. Stub déterministe pour les tests
    // (voir tests/mocks/resvg-workerd.ts).
    alias: {
      '@cf-wasm/resvg/workerd': './tests/mocks/resvg-workerd.ts',
    },
  },
});
