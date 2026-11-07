// SPDX-License-Identifier: GPL-3.0-or-later

import { beforeAll, describe, expect, it } from 'vitest';

import { expandQuery, handle } from '../src/worker/ucd.js';
import { useDiskData } from './ucd-data.js';

beforeAll(useDiskData);

describe('character lookups', () => {
  it('turns plain words into a case-insensitive name search', () => {
    expect(expandQuery('arrow')).toBe('name~/arrow/i');
    expect(expandQuery(' a.b ')).toBe('name~/a\\.b/i');
    expect(expandQuery('gc=Sm')).toBe('gc=Sm');
  });

  it('runs the FR-006 query', async () => {
    const found = await handle({ kind: 'search', query: 'name~/ARROW$/ & gc=Sm & age<=6.0' });
    expect(found.codePoints).toContain(0x2190);
    expect(found.total).toBe(found.codePoints.length);
    expect(found.truncated).toBe(false);
    expect(found.exact).toBeNull();
  });

  it('finds a character by its loose name (FR-005, UAX44-LM2)', async () => {
    expect((await handle({ kind: 'search', query: 'arabic letter-meem' })).exact).toBe(0x645);
    expect((await handle({ kind: 'search', query: 'Arabic_Letter_Meem' })).exact).toBe(0x645);
    expect((await handle({ kind: 'search', query: 'arabic letter' })).exact).toBeNull();
  });

  it('rejects a bad query with E_ARG_INVALID', async () => {
    await expect(handle({ kind: 'search', query: 'gc=' })).rejects.toMatchObject({
      code: 'E_ARG_INVALID',
    });
  });

  it('lists blocks with their assigned counts', async () => {
    const blocks = await handle({ kind: 'blocks' });
    expect(blocks[0]).toEqual({ start: 0, end: 0x7f, name: 'Basic Latin', assigned: 128 });
    const arabic = blocks.find((b) => b.name === 'Arabic');
    expect(arabic).toMatchObject({ start: 0x600, end: 0x6ff, assigned: 256 });
  });

  it('lists scripts and their characters by Script or Script_Extensions', async () => {
    const scripts = await handle({ kind: 'scripts' });
    expect(scripts.find((s) => s.code === 'Arab')).toMatchObject({ name: 'Arabic' });
    const sc = await handle({ kind: 'script', code: 'arabic', extensions: false });
    const scx = await handle({ kind: 'script', code: 'Arab', extensions: true });
    expect(sc.code).toBe('Arab');
    expect(sc.codePoints).not.toContain(0x060c);
    expect(scx.codePoints).toContain(0x060c);
  });

  it('describes grid cells, keeping surrogates apart', async () => {
    const cells = await handle({ kind: 'cells', codePoints: [0x41, 0xd83d, 0xde00, 0x300] });
    expect(cells.map((c) => [c.cp, c.gc])).toEqual([
      [0x41, 'Lu'],
      [0xd83d, 'Cs'],
      [0xde00, 'Cs'],
      [0x300, 'Mn'],
    ]);
    expect(cells[0]?.name).toBe('LATIN CAPITAL LETTER A');
  });

  it('gives every field, alias and escape for a character (FR-005)', async () => {
    const detail = await handle({ kind: 'char', cp: 0x645 });
    expect(Object.fromEntries(detail.fields)).toMatchObject({
      cp: 'U+0645',
      name: 'ARABIC LETTER MEEM',
      gc: 'Lo',
      script: 'Arab',
    });
    expect(Object.fromEntries(detail.escapes)).toMatchObject({
      'backslash-u': '\\u0645',
      'html-hex': '&#x645;',
    });
    const aliases = await handle({ kind: 'char', cp: 0x0 });
    expect(aliases.aliases.length).toBeGreaterThan(0);
  });
});
