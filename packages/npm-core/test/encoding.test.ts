// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import { setDataSource } from '../src/data/load.js';
import { ofBytes, ofString } from '../src/dish/types.js';
import { UniChefError } from '../src/errors.js';
import { OpContext } from '../src/ops/types.js';
import { runOperation } from '../src/recipe/run.js';

const realSource = async (file: string): Promise<Uint8Array> =>
  new Uint8Array(await readFile(new URL(`../data/${file}`, import.meta.url)));

describe('encoding ops', () => {
  afterEach(() => {
    setDataSource(realSource);
  });

  it('stops a cancelled encode', async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = new OpContext({ signal: controller.signal });
    await expect(
      runOperation('to-base64', new Map(), ofBytes(new Uint8Array(4)), { ctx }),
    ).rejects.toMatchObject({ code: 'E_CANCELLED' });
  });

  it('round-trips astral text through UTF-16 and UTF-32', async () => {
    for (const encoding of ['utf-16le', 'utf-16be', 'utf-32le', 'utf-32be']) {
      const args = new Map([['encoding', encoding]]);
      const bytes = await runOperation('encode-text', args, ofString('a😀'));
      const back = await runOperation('decode-text', args, bytes.dish);
      expect(back.dish.value).toBe('a😀');
    }
  });

  it('reloads the entity table after a failed load', async () => {
    setDataSource(() => Promise.reject(new Error('offline')));
    await expect(
      runOperation('html-entity-decode', new Map(), ofString('&amp;')),
    ).rejects.toBeInstanceOf(UniChefError);
    setDataSource(realSource);
    const ok = await runOperation('html-entity-decode', new Map(), ofString('&amp;'));
    expect(ok.dish.value).toBe('&');
  });
});
