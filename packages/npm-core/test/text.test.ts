// SPDX-License-Identifier: GPL-3.0-or-later
/** Text operations: edge cases the shared vectors do not reach. */

import { describe, expect, it } from 'vitest';

import { compareCodePoints } from '../src/ops/text.js';
import { runOperation } from '../src/recipe/run.js';

async function text(op: string, args: Record<string, unknown>, input: string): Promise<unknown> {
  return (await runOperation(op, args, { type: 'string', value: input })).dish.value;
}

describe('text ops', () => {
  it('replaces only the first literal match without global', async () => {
    const args = { pattern: '$&', replacement: '$1', literal: true, global: false };
    expect(await text('find-replace', args, 'a$&b$&')).toBe('a$1b$&');
    expect(await text('find-replace', { ...args, pattern: 'zz' }, 'abc')).toBe('abc');
  });

  it('takes every unit when count exceeds the input', async () => {
    // Python's `_take` slices parts[len - count:], which wraps when count > len.
    expect(await text('tail', { count: 4, unit: 'code-points' }, 'abc')).toBe('abc');
    expect(await text('tail', { count: 0, unit: 'code-points' }, 'abc')).toBe('');
    expect(await text('head', { count: 2, unit: 'graphemes' }, 'éxy')).toBe('éx');
  });

  it('compares strings by code point', () => {
    expect(compareCodePoints('\u{1f600}', '￿')).toBe(1);
    expect(compareCodePoints('ab', 'abc')).toBe(-1);
    expect(compareCodePoints('abc', 'ab')).toBe(1);
    expect(compareCodePoints('ab', 'ab')).toBe(0);
  });
});
