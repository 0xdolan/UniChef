// SPDX-License-Identifier: GPL-3.0-or-later
/** CyberChef recipe import (FR-009): the shared vectors and the packaged map. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isUniChefError } from '../src/errors.js';
import { hasOperation } from '../src/ops/registry.js';
import { cyberChefOperations, importCyberChef, parseCyberChef } from '../src/recipe/cyberchef.js';
import MAP from '../src/recipe/cyberchef-map.json' with { type: 'json' };
import { parseRecipe } from '../src/recipe/validate.js';
import { REPO } from './vectors.js';

interface Case {
  name: string;
  input: string;
  output?: unknown;
  error?: { code: string; detail?: unknown };
}

const spec = (name: string): unknown =>
  JSON.parse(readFileSync(join(REPO, 'spec', name), 'utf8')) as unknown;
const CASES = (spec('cyberchef-vectors.json') as { cases: Case[] }).cases;

describe('FR-009: CyberChef import', () => {
  it('ships the same map as spec/cyberchef-map.json', () => {
    expect(MAP).toEqual(spec('cyberchef-map.json'));
  });

  it('maps every CyberChef operation to a UniChef operation', () => {
    const ops = (MAP as { operations: Record<string, { op?: string; merge?: boolean }> })
      .operations;
    for (const name of cyberChefOperations()) {
      const entry = ops[name];
      if (entry?.merge !== true) expect(hasOperation(entry?.op ?? ''), name).toBe(true);
    }
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_, c) => {
    if (c.error === undefined) {
      const doc = importCyberChef(c.input);
      expect(doc).toEqual(c.output);
      expect(() => parseRecipe(doc)).not.toThrow();
      return;
    }
    let caught: unknown;
    try {
      importCyberChef(c.input);
    } catch (e) {
      caught = e;
    }
    expect(isUniChefError(caught)).toBe(true);
    if (!isUniChefError(caught)) return;
    expect(caught.code).toBe(c.error.code);
    expect(caught.detail).toEqual(c.error.detail);
  });

  it('parses the chef format flags and escapes', () => {
    expect(parseCyberChef("To_Hex('Space',0)/disabled Label([1,-2.5,null])")).toEqual([
      { op: 'To Hex', args: ['Space', 0], disabled: true },
      { op: 'Label', args: [[1, -2.5, null]] },
    ]);
    expect(parseCyberChef("A({'k':'\\u0041\\x42\\q'})")).toEqual([
      { op: 'A', args: [{ k: 'ABq' }] },
    ]);
  });
});
