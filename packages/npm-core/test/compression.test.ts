// SPDX-License-Identifier: GPL-3.0-or-later
// Compression ops: what the shared vectors cannot carry (output limits, large inputs).
import { deflateRawSync, gzipSync, inflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { UniChefError } from '../src/errors.js';
import { adler32, crc32, inflateRaw } from '../src/ops/inflate.js';
import { DEFAULT_LIMITS } from '../src/ops/types.js';
import { runOperation } from '../src/recipe/run.js';

const bytes = (value: Uint8Array) => ({ type: 'bytes', value }) as const;
const noop = (): void => undefined;

function errorCode(fn: () => unknown): string {
  try {
    fn();
  } catch (exc) {
    if (exc instanceof UniChefError) {
      return exc.code;
    }
    throw exc;
  }
  return 'ok';
}

describe('compression', () => {
  it('stops inflating at the limit', () => {
    const bomb = new Uint8Array(deflateRawSync(new Uint8Array(1 << 20), { level: 9 }));
    expect(errorCode(() => inflateRaw(bomb, 1000, 'raw-inflate', noop))).toBe('E_LIMIT');
    const withTrailer = new Uint8Array([...bomb, 0x78, 0x79]);
    const { output, used } = inflateRaw(withTrailer, 1 << 20, 'raw-inflate', noop);
    expect(output).toEqual(new Uint8Array(1 << 20));
    expect(used).toBe(bomb.length);
  });

  it('shares the limit across gzip members', async () => {
    const member = new Uint8Array(gzipSync(new Uint8Array(80)));
    const limits = { ...DEFAULT_LIMITS, minOutputSize: 100, outputFactor: 1 };
    const data = new Uint8Array([...member, ...member]);
    await expect(runOperation('gunzip', {}, bytes(data), { limits })).rejects.toMatchObject({
      code: 'E_LIMIT',
    });
  });

  it('splits stored blocks at 65535 bytes', async () => {
    const data = new Uint8Array(76800).map((_, i) => i % 256);
    const result = await runOperation('raw-deflate', { level: 0 }, bytes(data));
    const out = result.dish.value as Uint8Array;
    const rest = 76800 - 65535;
    expect([...out.subarray(0, 5)]).toEqual([0, 0xff, 0xff, 0, 0]);
    expect([...out.subarray(65540, 65545)]).toEqual([
      1,
      rest & 0xff,
      rest >> 8,
      ~rest & 0xff,
      (~rest >> 8) & 0xff,
    ]);
    expect(new Uint8Array(inflateRawSync(out))).toEqual(data);
  });

  it('matches the zlib checksums', () => {
    expect(adler32(new Uint8Array(100000).fill(0xff))).toBe(0x149a302c);
    expect(adler32(new TextEncoder().encode('Wikipedia'))).toBe(0x11e60398);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
