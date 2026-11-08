// SPDX-License-Identifier: GPL-3.0-or-later
/** Performance budgets (`pnpm perf`): no coverage, which would skew the timings. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['perf/**/*.perf.ts'],
    testTimeout: 120_000,
  },
});
