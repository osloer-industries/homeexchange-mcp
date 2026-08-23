import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/api.ts',
        'src/mcp.ts',
        'src/security.ts',
        'src/tools/messaging.ts',
        'src/tools/tool-schema.ts',
        'src/tools/user.ts',
      ],
      thresholds: {
        branches: 60,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
