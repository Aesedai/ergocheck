import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // DB-backed tests share one database; run files serially.
    fileParallelism: false,
    passWithNoTests: true,
    globalSetup: ['tests/global-setup.ts'],
  },
});
