// SPDX-License-Identifier: GPL-3.0-or-later
/** Inspector renderings (FR-002). */

import { describe, expect, it } from 'vitest';

import { hexDump, inputKey, stepAt, utf8Prefix, viewsFor } from '../src/lib/inspect.js';
import { newStep } from '../src/state/recipe.js';

const enc = new TextEncoder();

describe('inspector helpers', () => {
  it('drops a UTF-8 sequence cut off at the end', () => {
    const bytes = enc.encode('a€👋'); // 1 + 3 + 4 bytes
    expect(utf8Prefix(bytes)).toEqual(bytes);
    expect(utf8Prefix(bytes.subarray(0, 7))).toEqual(enc.encode('a€'));
    expect(utf8Prefix(bytes.subarray(0, 5))).toEqual(enc.encode('a€'));
    expect(utf8Prefix(bytes.subarray(0, 2))).toEqual(enc.encode('a'));
    expect(utf8Prefix(new Uint8Array([0xff]))).toEqual(new Uint8Array([0xff]));
  });

  it('writes a hex dump with offsets and an ASCII column', () => {
    const lines = hexDump(enc.encode('Hello, UniChef!\n\x00z')).split('\n');
    expect(lines).toEqual([
      '00000000  48 65 6c 6c 6f 2c 20 55  6e 69 43 68 65 66 21 0a  |Hello, UniChef!.|',
      '00000010  00 7a                                             |.z|',
    ]);
    expect(hexDump(new Uint8Array())).toBe('');
  });

  it('offers views by dish type', () => {
    expect(viewsFor('bytes')).toEqual(['text', 'hex']);
    expect(viewsFor('table')).toEqual(['table', 'text']);
    expect(viewsFor('integer')).toEqual(['text']);
  });

  it('finds model steps by path, nested lists included', () => {
    const inner = newStep('reverse');
    const sub = { ...newStep('sub-recipe'), args: { steps: [inner] } };
    const steps = [newStep('to-hex'), sub];
    expect(stepAt(steps, [1])).toBe(sub);
    expect(stepAt(steps, [1, 0])).toBe(inner);
    expect(stepAt(steps, [0, 0])).toBeNull();
    expect(stepAt(steps, [5])).toBeNull();
  });

  it('finds the snapshot that fed a step', () => {
    const ran = new Set(['0', '2', '3/0']);
    const has = (k: string) => ran.has(k);
    expect(inputKey([3], has)).toBe('2');
    expect(inputKey([2], has)).toBe('0'); // step 1 was disabled
    expect(inputKey([3, 1], has)).toBe('3/0');
    expect(inputKey([3, 0], has)).toBe('2');
    expect(inputKey([0], has)).toBeNull();
  });
});
