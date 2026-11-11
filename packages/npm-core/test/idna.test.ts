// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { UniChefError } from '../src/errors.js';
import { runOperation } from '../src/index.js';
import { ready } from '../src/unicode/data.js';
import * as idna from '../src/unicode/idna.js';

const UCD = fileURLToPath(new URL('../../../data/ucd/18.0.0/', import.meta.url));
const ESCAPE = /\\u([0-9A-Fa-f]{4})|\\x\{([0-9A-Fa-f]+)\}/gu;

beforeAll(async () => {
  await ready('core', 'security');
});

function unescape(field: string): string {
  const text = field.replace(ESCAPE, (_, u?: string, x?: string) =>
    String.fromCodePoint(parseInt(u ?? x ?? '0', 16)),
  );
  return text === '""' ? '' : text;
}

function run(call: () => string): string | null {
  try {
    return call();
  } catch (e) {
    expect(e).toBeInstanceOf(UniChefError);
    expect((e as UniChefError).code).toBe('E_DECODE');
    return null;
  }
}

describe('UTS #46', () => {
  // Every line of IdnaTestV2.txt, toUnicode and nontransitional toASCII, all flags on.
  // UTS #46 asks only that an error is reported, not which one.
  it('passes IdnaTestV2.txt', () => {
    const text = readFileSync(`${UCD}idna/IdnaTestV2.txt`, 'utf8');
    const failures: string[] = [];
    let checked = 0;
    text.split('\n').forEach((line, i) => {
      const body = line.split('#')[0] ?? '';
      if (body.trim() === '') {
        return;
      }
      const f = body.split(';').map((c) => c.trim());
      const source = unescape(f[0] ?? '');
      const uni = f[1] ? unescape(f[1]) : source;
      const uniErr = (f[2] ?? '').replace(/[[\]]/gu, '') !== '';
      const asc = f[3] ? unescape(f[3]) : uni;
      const ascErr = f[4] ? f[4].replace(/[[\]]/gu, '') !== '' : uniErr;
      const gotUni = run(() => idna.toUnicode(source, idna.DEFAULT_FLAGS));
      if ((gotUni === null) !== uniErr || (!uniErr && gotUni !== uni)) {
        failures.push(`line ${i + 1} toUnicode(${JSON.stringify(source)}) = ${gotUni}`);
      }
      const gotAsc = run(() => idna.toAscii(source, idna.DEFAULT_FLAGS, true));
      if ((gotAsc === null) !== ascErr || (!ascErr && gotAsc !== asc)) {
        failures.push(`line ${i + 1} toASCII(${JSON.stringify(source)}) = ${gotAsc}`);
      }
      checked++;
    });
    expect(failures.slice(0, 20)).toEqual([]);
    expect(checked).toBeGreaterThan(6000);
  });
});

describe('Punycode edge cases', () => {
  it('reports encoder overflow as E_LIMIT', async () => {
    const text = 'a'.repeat(2048) + '\u{10ffff}'; // (0x10FFFF - 0x80) * 2049 > 2**31 - 1
    await expect(
      runOperation('to-punycode', {}, { type: 'string', value: text }),
    ).rejects.toMatchObject({
      code: 'E_LIMIT',
    });
  });

  it('reports a label that ToASCII cannot encode', () => {
    const off = {
      checkHyphens: false,
      checkBidi: false,
      checkJoiners: false,
      useStd3AsciiRules: false,
    };
    expect(() => idna.toAscii('b'.repeat(20000) + '\u{1f600}', off, false)).toThrow(
      /cannot be encoded as Punycode/u,
    );
  });

  it('rejects large numbers', () => {
    for (const text of ['9'.repeat(12), 'a-' + '9'.repeat(12), 'a-zzzzzzzzzz9']) {
      expect(() => idna.punycodeDecode(text)).toThrow(idna.PunycodeError);
    }
  });

  it('round-trips long input and checks for cancellation', () => {
    const text = String.fromCodePoint(...Array.from({ length: 5000 }, (_, i) => 0x400 + i));
    const calls: number[] = [];
    const encoded = idna.punycodeEncode(text, () => calls.push(1));
    expect(idna.punycodeDecode(encoded, () => calls.push(2))).toBe(text);
    expect(calls).toContain(1);
    expect(calls).toContain(2);
  });
});
