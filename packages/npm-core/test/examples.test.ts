// SPDX-License-Identifier: GPL-3.0-or-later
/** Every operation's examples run and give their stated output (FR-030, PRD §3.3). */

import { describe, expect, it } from 'vitest';

import { coerce } from '../src/dish/coerce.js';
import { ofString, type Dish } from '../src/dish/types.js';
import { allOperations } from '../src/ops/registry.js';
import { runOperation } from '../src/recipe/run.js';
import { JUMP_OPS } from '../src/recipe/validate.js';

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

/** The output as the web playground shows it: bytes as UTF-8 when valid, otherwise hex. */
function exampleText(dish: Dish): string {
  if (dish.type === 'bytes') {
    try {
      return strictUtf8.decode(dish.value);
    } catch {
      return Array.from(dish.value, (b) => b.toString(16).padStart(2, '0')).join(' ');
    }
  }
  if (dish.type === 'codepoints') {
    return dish.value.map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`).join(' ');
  }
  return coerce(dish, 'string').value as string;
}

describe('operation examples', () => {
  it.each(allOperations().map((op) => [op.id, op] as const))('%s', async (_id, op) => {
    // A jump needs a label in the same step list, so it cannot run as a one-step example.
    expect(op.examples.length > 0).toBe(!JUMP_OPS.has(op.id));
    for (const example of op.examples) {
      const result = await runOperation(op.id, example.args, ofString(example.input));
      expect(exampleText(result.dish)).toBe(example.output);
    }
  });
});
