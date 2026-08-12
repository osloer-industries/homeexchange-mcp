import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/api.ts', 'src/security.ts'],
      thresholds: {
        branches: 60,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
