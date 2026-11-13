// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import {
  asCodePoints,
  asUnicodeEscapes,
  base64Bytes,
  filterOps,
  formatResult,
  inspectArgv,
  opArgv,
  opsArgv,
  parseCharacters,
  parseEnvelope,
  parseOps,
  utf8Length,
  visibleChar,
} from '../unichef@0xdolan.github.io/lib.js';

const ok = (result, warnings = []) => ({ ok: true, result, warnings, error: null });
const table = (columns, rows) => ok({ type: 'table', value: { columns, rows } });

const OPS = parseOps(
  table(
    ['id', 'name', 'category', 'input', 'output', 'summary'],
    [
      ['from-base64', 'From Base64', 'Encoding', 'string', 'bytes', 'Decode Base64.'],
      ['to-base64', 'To Base64', 'Encoding', 'bytes', 'string', 'Encode bytes as Base64.'],
      ['md5', 'MD5', 'Hashing', 'bytes', 'string', 'MD5 digest.'],
      ['url-decode', 'URL Decode', 'Encoding', 'string', 'string', 'Decode percent-escapes.'],
    ],
  ),
);

describe('FR-016: GNOME extension CLI calls', () => {
  it('runs the CLI with JSON output and stdin input', () => {
    expect(opsArgv('/usr/bin/unichef')).toEqual([
      '/usr/bin/unichef',
      '--format',
      'json',
      '--quiet',
      'ops',
    ]);
    expect(opArgv('unichef', 'from-base64')).toEqual([
      'unichef',
      '--format',
      'json',
      '--quiet',
      '-i',
      '-',
      'op',
      'from-base64',
    ]);
    expect(inspectArgv('unichef').slice(-3)).toEqual(['-i', '-', 'inspect']);
  });

  it('refuses an operation id that could be read as an option', () => {
    expect(() => opArgv('unichef', '--output=/tmp/x')).toThrow(/Invalid operation id/);
    expect(() => opArgv('unichef', '')).toThrow(/Invalid operation id/);
  });

  it('turns output that is not an envelope into an error', () => {
    expect(parseEnvelope('not json', 'Traceback ...').error).toEqual({
      code: 'E_CLI',
      message: 'Traceback ...',
    });
    expect(parseEnvelope('', '').error.message).toBe('no output');
    expect(parseEnvelope('{"ok": true, "result": null}').ok).toBe(true);
  });
});

describe('FR-016: GNOME extension operation search', () => {
  it('reads the operations table', () => {
    expect(OPS[0]).toEqual({
      id: 'from-base64',
      name: 'From Base64',
      category: 'Encoding',
      summary: 'Decode Base64.',
    });
    expect(parseOps({ ok: false, error: {} })).toEqual([]);
  });

  it('ranks prefix matches before substring and summary matches', () => {
    expect(filterOps(OPS, 'base64').map((o) => o.id)).toEqual(['from-base64', 'to-base64']);
    expect(filterOps(OPS, 'to').map((o) => o.id)).toEqual(['to-base64']);
    expect(filterOps(OPS, 'percent').map((o) => o.id)).toEqual(['url-decode']);
    expect(filterOps(OPS, 'DECODE')[0].id).toBe('url-decode');
    expect(filterOps(OPS, 'zzz')).toEqual([]);
    expect(filterOps(OPS, '', 2)).toHaveLength(2);
  });
});

describe('FR-016: GNOME extension results', () => {
  it('shows strings, warnings and errors', () => {
    expect(formatResult(ok({ type: 'string', value: 'abc' }))).toEqual({
      ok: true,
      text: 'abc',
      note: '',
    });
    const md5 = formatResult(
      ok({ type: 'string', value: 'x' }, [{ code: 'W_INSECURE', message: 'MD5 is broken.' }]),
    );
    expect(md5.note).toBe('W_INSECURE: MD5 is broken.');
    const bad = formatResult({
      ok: false,
      result: null,
      warnings: [],
      error: { code: 'E_DECODE', message: 'Bad hex.' },
    });
    expect(bad).toEqual({ ok: false, text: 'E_DECODE: Bad hex.', note: '' });
  });

  it('shows UTF-8 bytes as text and other bytes as hex', () => {
    expect(formatResult(ok({ type: 'bytes', base64: 'Y2Fmw6kg8J+Riw==' })).text).toBe('café 👋');
    const raw = formatResult(ok({ type: 'bytes', base64: 'YWJj/w==' }));
    expect(raw.text).toBe('61 62 63 ff');
    expect(raw.note).toMatch(/4 bytes as hex/);
  });

  it('shows tables as tab-separated lines and JSON pretty-printed', () => {
    expect(formatResult(table(['a', 'b'], [[1, 2]])).text).toBe('a\tb\n1\t2');
    expect(formatResult(ok({ type: 'json', value: [{ a: '1' }] })).text).toBe(
      '[\n  {\n    "a": "1"\n  }\n]',
    );
  });

  it('decodes Base64 and rejects other characters', () => {
    expect(Array.from(base64Bytes('AAEC/w=='))).toEqual([0, 1, 2, 255]);
    expect(Array.from(base64Bytes(''))).toEqual([]);
    expect(() => base64Bytes('a*b=')).toThrow(/Invalid Base64/);
  });
});

describe('FR-016: GNOME extension character lookup', () => {
  const env = table(
    ['index', 'cp', 'char', 'name', 'gc'],
    [
      [0, 'U+00E9', 'é', 'LATIN SMALL LETTER E WITH ACUTE', 'Ll'],
      [1, 'U+202E', '‮', 'RIGHT-TO-LEFT OVERRIDE', 'Cf'],
      [2, 'U+0020', ' ', 'SPACE', 'Zs'],
    ],
  );

  it('lists code point, character, name and category', () => {
    const rows = parseCharacters(env);
    expect(rows[0]).toEqual({
      cp: 'U+00E9',
      char: 'é',
      name: 'LATIN SMALL LETTER E WITH ACUTE',
      gc: 'Ll',
    });
    expect(rows.map(visibleChar)).toEqual(['é', '⟨U+202E⟩', '⟨U+0020⟩']);
  });

  it('copies the input as code points and \\u escapes', () => {
    expect(asCodePoints('é👋')).toBe('U+00E9 U+1F44B');
    expect(asUnicodeEscapes('é👋')).toBe('\\u00E9\\uD83D\\uDC4B');
    expect(asCodePoints('')).toBe('');
  });

  it('measures input in UTF-8 bytes', () => {
    expect(utf8Length('é👋')).toBe(6);
  });
});
