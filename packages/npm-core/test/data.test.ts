// SPDX-License-Identifier: GPL-3.0-or-later
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { loadData, setDataSource } from '../src/data/load.js';
import { UniChefError } from '../src/errors.js';

const realSource = async (file: string): Promise<Uint8Array> => {
  const { readFile } = await import('node:fs/promises');
  return new Uint8Array(await readFile(new URL(`../data/${file}`, import.meta.url)));
};

describe('data loader', () => {
  afterEach(() => {
    setDataSource(realSource);
  });

  it('reads a shipped data file once', async () => {
    const a = loadData('ucd-core-18.0.0.json.gz');
    expect(loadData('ucd-core-18.0.0.json.gz')).toBe(a);
    expect((await a) as { version: string }).toMatchObject({ version: '18.0.0' });
  });

  it('uses a custom source and reports failures', async () => {
    setDataSource(() => Promise.resolve(new Uint8Array(gzipSync('{"x":1}'))));
    expect(await loadData('any.json.gz')).toEqual({ x: 1 });
    // A server that sends the file with Content-Encoding: gzip hands over plain JSON.
    setDataSource(() => Promise.resolve(new TextEncoder().encode('{"y":2}')));
    expect(await loadData('plain.json.gz')).toEqual({ y: 2 });
    setDataSource(() => Promise.reject(new Error('gone')));
    await expect(loadData('missing.json.gz')).rejects.toBeInstanceOf(UniChefError);
  });
});
