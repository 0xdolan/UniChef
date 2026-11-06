// SPDX-License-Identifier: GPL-3.0-or-later
/** Run every shared vector in spec/vectors (PRD §3.9, FR-010). */

import { describe, expect, it } from 'vitest';

import type { JsonValue } from '../../src/dish/types.js';
import { UniChefError } from '../../src/errors.js';
import { allOperations, hasOperation } from '../../src/ops/registry.js';
import { bake, runOperation, type BakeResult } from '../../src/recipe/run.js';
import { parseRecipe } from '../../src/recipe/validate.js';
import {
  dishEqual,
  dishFromVector,
  get,
  showDish,
  vectorFiles,
  type VectorFile,
} from '../vectors.js';

const FILES = vectorFiles();

/** Every op id a vector file uses, including nested steps. */
function opsUsed(file: VectorFile): Set<string> {
  const out = new Set<string>();
  const walk = (steps: JsonValue | undefined): void => {
    if (!Array.isArray(steps)) {
      return;
    }
    for (const step of steps) {
      const op = get(step, 'op');
      if (typeof op === 'string') {
        out.add(op);
      }
      walk(get(get(step, 'args'), 'steps'));
    }
  };
  const op = get(file.doc, 'op');
  if (typeof op === 'string') {
    out.add(op);
  } else {
    walk(get(get(file.doc, 'recipe'), 'steps'));
  }
  return out;
}

/** Ops that exist in no core; vectors use them to test E_OP_UNKNOWN. */
const UNKNOWN_OPS = new Set(['no-such-op']);

/** A vector runs once every op it uses is ported (a port is in progress). */
function ported(file: VectorFile): boolean {
  return [...opsUsed(file)].every((op) => UNKNOWN_OPS.has(op) || hasOperation(op));
}

async function run(file: VectorFile, kase: JsonValue): Promise<BakeResult> {
  const dish = dishFromVector(get(kase, 'input'));
  const op = get(file.doc, 'op');
  if (typeof op === 'string') {
    return runOperation(op, get(kase, 'args') ?? new Map(), dish);
  }
  return bake(parseRecipe(get(file.doc, 'recipe')), dish);
}

for (const file of FILES) {
  const runIt = ported(file) ? it : it.skip;
  describe(`${file.dir}/${file.stem}`, () => {
    for (const kase of get(file.doc, 'cases') as JsonValue[]) {
      runIt(get(kase, 'name') as string, async () => {
        const expected = get(kase, 'expected');
        const error = get(expected, 'error');
        if (typeof error === 'string') {
          const outcome = await run(file, kase).then(
            (r) => r,
            (exc: unknown) => exc,
          );
          if (!(outcome instanceof UniChefError)) {
            throw new Error(
              `expected ${error}, got ${outcome instanceof Error ? outcome.stack : showDish((outcome as BakeResult).dish)}`,
            );
          }
          expect(outcome.code, outcome.message).toBe(error);
          return;
        }
        const result = await run(file, kase);
        const want = dishFromVector(expected);
        if (!dishEqual(result.dish, want)) {
          expect(showDish(result.dish)).toBe(showDish(want));
        }
        const warnings = (get(kase, 'warnings') ?? []) as JsonValue[];
        expect(result.warnings.map((w) => w.code)).toEqual(warnings);
      });
    }
  });
}

describe('vector coverage', () => {
  it('finds vector files', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it('names op vector files after their op', () => {
    for (const file of FILES) {
      const op = get(file.doc, 'op');
      if (typeof op === 'string') {
        expect(file.stem).toBe(op);
      }
    }
  });

  it('exercises every registered operation', () => {
    const covered = new Set<string>();
    for (const file of FILES) {
      for (const op of opsUsed(file)) {
        covered.add(op);
      }
    }
    const missing = allOperations()
      .map((op) => op.id)
      .filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });
});
