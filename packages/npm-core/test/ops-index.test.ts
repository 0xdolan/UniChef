// SPDX-License-Identifier: GPL-3.0-or-later
/** The TypeScript registry matches spec/ops.json, generated from the Python registry. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { allOperations } from '../src/ops/registry.js';
import type { ArgSpec } from '../src/ops/types.js';
import { REPO } from './vectors.js';

interface IndexEntry {
  id: string;
  name: string;
  category: string;
  input: string;
  output: string;
  parity: string;
  args: Record<string, unknown>[];
  examples: { input: string; args: Record<string, unknown>; output: string }[];
}

const index = (
  JSON.parse(readFileSync(join(REPO, 'spec', 'ops.json'), 'utf8')) as { ops: IndexEntry[] }
).ops;

/** The same shape scripts/spec/ops.py writes for each argument. */
function argEntry(spec: ArgSpec): Record<string, unknown> {
  const head = { name: spec.name, kind: spec.kind };
  switch (spec.kind) {
    case 'steps':
      return head;
    case 'enum':
      return { ...head, default: spec.default, options: [...spec.options] };
    case 'integer':
      return {
        ...head,
        default: spec.default,
        ...(spec.min === undefined ? {} : { minimum: spec.min }),
        ...(spec.max === undefined ? {} : { maximum: spec.max }),
      };
    case 'bytes':
      return { ...head, default: spec.default, encodings: [...spec.encodings] };
    case 'regex':
      return { ...head, default: spec.default, flags: spec.flags };
    case 'string':
      return {
        ...head,
        default: spec.default,
        ...(spec.multiline === true ? { multiline: true } : {}),
      };
    case 'boolean':
      return { ...head, default: spec.default };
  }
}

describe('spec/ops.json', () => {
  it('lists the same operations as the TypeScript registry', () => {
    expect(allOperations().map((op) => op.id)).toEqual(index.map((e) => e.id));
  });

  it.each(index.map((e) => [e.id, e] as const))('%s has the same metadata', (id, entry) => {
    const op = allOperations().find((o) => o.id === id);
    expect(op).toBeDefined();
    if (op === undefined) return;
    expect({
      name: op.name,
      category: op.category,
      input: op.inputType,
      output: op.outputType,
      parity: op.parity,
      args: op.args.map(argEntry),
      examples: op.examples,
    }).toEqual({
      name: entry.name,
      category: entry.category,
      input: entry.input,
      output: entry.output,
      parity: entry.parity,
      args: entry.args,
      examples: entry.examples,
    });
  });
});
