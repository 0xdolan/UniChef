// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Core performance budgets for the web (PRD §13.1), in the V8 engine the browser worker
 * uses. Run with `pnpm perf` (`make perf`), without coverage instrumentation. Each budget
 * is checked against the median of a few runs after a warm-up run.
 */

import { describe, expect, it } from 'vitest';

import { ready } from '../src/unicode/index.js';
import { query } from '../src/unicode/query.js';
import { bake } from '../src/recipe/run.js';
import { parseRecipe } from '../src/recipe/validate.js';

const RUNS = 3;
const MIB = 1024 * 1024;

async function medianMs(fn: () => unknown): Promise<number> {
  await fn();
  const runs: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const started = performance.now();
    await fn();
    runs.push(performance.now() - started);
  }
  return runs.sort((a, b) => a - b)[Math.floor(RUNS / 2)] ?? Infinity;
}

describe('performance budgets', () => {
  it('NFR-002: to-base64, from-base64 and sha2-256 on 10 MiB in 1.0 s', async () => {
    const text = 'UniChef ☕ '.padEnd(64, 'x').repeat((10 * MIB) / 64);
    const recipe = parseRecipe({
      version: 1,
      steps: [{ op: 'to-base64' }, { op: 'from-base64' }, { op: 'sha2', args: { size: '256' } }],
    });
    expect(await medianMs(() => bake(recipe, { type: 'string', value: text }))).toBeLessThanOrEqual(
      1000,
    );
  });

  it.each(['name~/WITH/', 'name~/ARROW$/'])(
    'NFR-004: %s over all named code points in 200 ms',
    async (text) => {
      await ready('core', 'names');
      expect(query(text).total).toBeGreaterThan(0);
      expect(await medianMs(() => query(text))).toBeLessThanOrEqual(200);
    },
  );
});
