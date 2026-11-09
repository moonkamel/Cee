import { defineConfig } from 'vitest/config';

// Logique métier couverte à plus de 80 % (CLAUDE.md) : le seuil fait échouer les tests.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/testing/**', 'src/**/index.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
