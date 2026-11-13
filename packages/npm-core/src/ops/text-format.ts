// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Text formats: identifier cases, hexdumps, Snort hex content, string escapes, smart
 * characters and wrapping (PRD §3.8, 1.1).
 *
 * Behaviour follows CyberChef v11.5.0 (Apache-2.0) and jsesc 3.1.0 (MIT), with the deviations
 * listed in spec/README.md: words are split with the pinned UCD rather than lodash, and text
 * is handled per code point rather than per UTF-16 code unit.
 */

import { UniChefError } from '../errors.js';
import * as caseMap from '../unicode/case.js';
import * as props from '../unicode/props.js';
import {
  boolArg,
  defineOp,
  enumArg,
  intArg,
  type Args,
  type OpContext,
  type Operation,
} from './types.js';

const CHECK_EVERY = 4096;
const MAX_WIDTH = 65536;
const utf8 = new TextEncoder();

// ---------------------------------------------------------------------------
// Identifier cases

const APOSTROPHES = /['\u2019]/g;
// CyberChef's "context aware" mode: identifiers outside double-quoted strings.
const IDENTIFIER = /\\"|"(?:\\"|[^"])*"|([A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?)/g;

/** `u` upper or title case letter, `l` other letter, `d` number, `m` mark, `` other. */
function kind(cp: number): string {
  const gc = props.gc(cp);
  if (gc === 'Lu' || gc === 'Lt') return 'u';
  return ({ L: 'l', N: 'd', M: 'm' } as Record<string, string>)[gc.charAt(0)] ?? '';
}

/** Split `text` into words; see "Identifier cases" in spec/README.md. */
function words(text: string, ctx: OpContext): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let last = 0; // index in `cur` of the last letter or number
  let kinds: string[] = []; // kinds of the letters and numbers in `cur`
  let i = 0;
  for (const ch of text.replace(APOSTROPHES, '')) {
    if (i++ % CHECK_EVERY === 0) ctx.check();
    const k = kind(ch.codePointAt(0) ?? 0);
    if (k === 'm') {
      if (cur.length > 0) cur.push(ch);
      continue;
    }
    if (k === '') {
      if (cur.length > 0) {
        out.push(cur.join(''));
        cur = [];
        kinds = [];
      }
      continue;
    }
    if (cur.length > 0) {
      const prev = kinds[kinds.length - 1];
      if ((k === 'd') !== (prev === 'd') || (prev === 'l' && k === 'u')) {
        out.push(cur.join(''));
        cur = [];
        kinds = [];
      } else if (k === 'l' && prev === 'u' && kinds.length > 1 && kinds[kinds.length - 2] === 'u') {
        out.push(cur.slice(0, last).join(''));
        cur = cur.slice(last);
        kinds = kinds.slice(-1);
      }
    }
    last = cur.length;
    cur.push(ch);
    kinds.push(k);
  }
  if (cur.length > 0) out.push(cur.join(''));
  return out;
}

function applyCase(
  text: string,
  args: Args,
  ctx: OpContext,
  join: (ws: string[]) => string,
): string {
  const convert = (s: string): string => join(words(s, ctx));
  if (!args.flag('context_aware')) return convert(text);
  return text.replace(IDENTIFIER, (m: string, id: string | undefined) => (id ? convert(m) : m));
}

const CASE_ARGS = [boolArg('context_aware')];
const lowerJoin =
  (sep: string) =>
  (ws: string[]): string =>
    ws.map((w) => caseMap.lower(w)).join(sep);

export const toSnakeCase = defineOp({
  id: 'to-snake-case',
  name: 'To Snake case',
  category: 'Text',
  description:
    'Split the text into words and join them in lower case with underscores. Words are ' +
    'runs of letters, marks and numbers, split where lower case meets upper case, before the ' +
    'last capital of an acronym and between letters and numbers; apostrophes are dropped. ' +
    'With `context_aware`, only identifiers outside double-quoted strings change.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'parseHTTPResponse v2', args: {}, output: 'parse_http_response_v_2' }],
  args: CASE_ARGS,
  run: (text, args, ctx) => applyCase(text, args, ctx, lowerJoin('_')),
});

export const toKebabCase = defineOp({
  id: 'to-kebab-case',
  name: 'To Kebab case',
  category: 'Text',
  description: 'Like To Snake case, but the words are joined with hyphens.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'parseHTTPResponse v2', args: {}, output: 'parse-http-response-v-2' }],
  args: CASE_ARGS,
  run: (text, args, ctx) => applyCase(text, args, ctx, lowerJoin('-')),
});

const camel = (ws: string[]): string =>
  ws.length === 0
    ? ''
    : caseMap.lower(ws[0] ?? '') +
      ws
        .slice(1)
        .map((w) => caseMap.title(w))
        .join('');

export const toCamelCase = defineOp({
  id: 'to-camel-case',
  name: 'To Camel case',
  category: 'Text',
  description:
    'Like To Snake case, but the first word is lower case and every later word is title ' +
    'case, with nothing between them.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'parseHTTPResponse v2', args: {}, output: 'parseHttpResponseV2' }],
  args: CASE_ARGS,
  run: (text, args, ctx) => applyCase(text, args, ctx, camel),
});

// ---------------------------------------------------------------------------
// Hexdump

const hex2 = (b: number): string => b.toString(16).padStart(2, '0');

function dumpChar(b: number, asciiOnly: boolean): string {
  if (asciiOnly) return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
  return b < 0x20 || (b >= 0x7f && b <= 0x9f) || b === 0xad ? '.' : String.fromCharCode(b);
}

export const toHexdump = defineOp({
  id: 'to-hexdump',
  name: 'To Hexdump',
  category: 'Encoding',
  description:
    'Write `width` bytes per line: the offset, the bytes in hex and the bytes as Latin-1 ' +
    'text, with controls and the soft hyphen as dots (`ascii_only` keeps only printable ' +
    'ASCII). `final_length` adds a last line with the total length.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Hi!', args: {}, output: '00000000  48 69 21' + ' '.repeat(41) + '|Hi!|' }],
  args: [
    intArg('width', 16, 1, MAX_WIDTH),
    boolArg('upper'),
    boolArg('final_length'),
    boolArg('ascii_only'),
  ],
  run(data, args, ctx) {
    const width = args.int('width');
    const upper = args.flag('upper');
    const asciiOnly = args.flag('ascii_only');
    const lines: string[] = [];
    for (let i = 0; i < data.length; i += width) {
      if ((i / width) % 256 === 0) ctx.check();
      const chunk = data.subarray(i, i + width);
      let offset = i.toString(16).padStart(8, '0');
      let digits = Array.from(chunk, hex2)
        .join(' ')
        .padEnd(width * 3, ' ');
      if (upper) {
        offset = offset.toUpperCase();
        digits = digits.toUpperCase();
      }
      const text = Array.from(chunk, (b) => dumpChar(b, asciiOnly)).join('');
      lines.push(`${offset}  ${digits} |${text}|`);
    }
    if (args.flag('final_length') && data.length > 0) {
      const total = data.length.toString(16).padStart(8, '0');
      lines.push(upper ? total.toUpperCase() : total);
    }
    return lines.join('\n');
  },
});

const HEXDUMP_LINE = new RegExp(
  String.raw`(?:^|(?<=\n))[ \t\n\v\f\r]*(?:[0-9A-F]{4,16}h?:?)?[ \t]+(` +
    String.raw`(?:[0-9A-F]{2} ){1,8}(?:[ \t]|[0-9A-F]{2}-)(?:[0-9A-F]{2} ){1,8}` +
    String.raw`|(?:[0-9A-F]{4} )+(?:[0-9A-F]{2})?` +
    String.raw`|(?:[0-9A-F]{2} )*[0-9A-F]{2})`,
  'gi',
);

/** CyberChef's fromHex: split on non-hex runs, read pairs, a lone last digit alone. */
function hexTokens(text: string, out: number[]): void {
  for (const token of text.split(/[^0-9A-Fa-f]+/)) {
    for (let j = 0; j < token.length; j += 2) {
      out.push(parseInt(token.slice(j, j + 2), 16));
    }
  }
}

export const fromHexdump = defineOp({
  id: 'from-hexdump',
  name: 'From Hexdump',
  category: 'Encoding',
  description:
    'Read the bytes back from a hexdump in the xxd, hexdump -C, Wireshark or 010 Editor ' +
    'style: on each line, an optional offset and then the hex columns. Check the result.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: '00000000  48 69 21' + ' '.repeat(41) + '|Hi!|', args: {}, output: 'Hi!' }],
  args: [],
  run(text, _args, ctx) {
    const out: number[] = [];
    let n = 0;
    for (const m of text.matchAll(HEXDUMP_LINE)) {
      if (n++ % 256 === 0) ctx.check();
      hexTokens((m[1] ?? '').replace(/-/g, ' '), out);
    }
    return Uint8Array.from(out);
  },
});

// ---------------------------------------------------------------------------
// Snort hex content

const contentSpecial = (b: number, spaces: boolean): boolean =>
  !(
    (b === 0x20 && !spaces) ||
    (b >= 0x30 && b <= 0x39) ||
    (b >= 0x41 && b <= 0x5a) ||
    (b >= 0x61 && b <= 0x7a)
  );

export const toHexContent = defineOp({
  id: 'to-hex-content',
  name: 'To Hex Content',
  category: 'Encoding',
  description:
    'Write bytes as Snort content: ASCII letters, digits and spaces stay as they are and ' +
    'every other byte goes between pipes as hex. `special-and-space` also converts spaces, ' +
    '`all` converts everything, and `spaces` puts a space between hex bytes.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'foo=bar', args: {}, output: 'foo|3d|bar' }],
  args: [enumArg('convert', ['special', 'special-and-space', 'all']), boolArg('spaces')],
  run(data, args, ctx) {
    ctx.check();
    const sep = args.flag('spaces') ? ' ' : '';
    const convert = args.text('convert');
    if (convert === 'all') return '|' + Array.from(data, hex2).join(sep) + '|';
    const out: string[] = [];
    let run: string[] = [];
    for (const b of data) {
      if (contentSpecial(b, convert === 'special-and-space')) {
        run.push(hex2(b));
        continue;
      }
      if (run.length > 0) {
        out.push('|' + run.join(sep) + '|');
        run = [];
      }
      out.push(String.fromCharCode(b));
    }
    if (run.length > 0) out.push('|' + run.join(sep) + '|');
    return out.join('');
  },
});

const HEX_CONTENT = /\|([0-9A-Fa-f ]{2,})\|/g;

export const fromHexContent = defineOp({
  id: 'from-hex-content',
  name: 'From Hex Content',
  category: 'Encoding',
  description: 'Read Snort content: hex between pipes becomes those bytes and the rest is UTF-8.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: 'foo|3d|bar', args: {}, output: 'foo=bar' }],
  args: [],
  run(text, _args, ctx) {
    ctx.check();
    const out: number[] = [];
    let pos = 0;
    for (const m of text.matchAll(HEX_CONTENT)) {
      for (const b of utf8.encode(text.slice(pos, m.index))) out.push(b);
      hexTokens(m[1] ?? '', out);
      pos = m.index + m[0].length;
    }
    for (const b of utf8.encode(text.slice(pos))) out.push(b);
    return Uint8Array.from(out);
  },
});

// ---------------------------------------------------------------------------
// String escapes

const escapeSafe = (cp: number): boolean =>
  cp === 0x20 ||
  cp === 0x21 ||
  (cp >= 0x23 && cp <= 0x26) ||
  (cp >= 0x28 && cp <= 0x5b) ||
  (cp >= 0x5d && cp <= 0x5f) ||
  (cp >= 0x61 && cp <= 0x7e);
const SINGLE_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};
// jsesc escapes these even in minimal mode.
const JS_WHITESPACE = /[\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;
const QUOTES: Readonly<Record<string, string>> = { single: "'", double: '"', backtick: '`' };

export const escapeString = defineOp({
  id: 'escape-string',
  name: 'Escape String',
  category: 'Encoding',
  description:
    'Escape a string for a JavaScript literal the way jsesc does. `special` escapes all ' +
    'but printable ASCII, `everything` escapes every character and `minimal` only the quote, ' +
    'backslash, control escapes and line or paragraph separators. `json` uses \\u escapes ' +
    'and wraps the result in quotes; `es6` writes characters past U+FFFF as \\u{...}.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: "Don't stop\n", args: {}, output: "Don\\'t stop\\n" }],
  args: [
    enumArg('level', ['special', 'everything', 'minimal']),
    enumArg('quote', Object.keys(QUOTES)),
    boolArg('json'),
    boolArg('es6', true),
    boolArg('upper_hex'),
  ],
  run(text, args, ctx) {
    const level = args.text('level');
    const everything = level === 'everything';
    const minimal = level === 'minimal';
    const quote = QUOTES[args.text('quote')] ?? "'";
    const json = args.flag('json');
    const es6 = args.flag('es6');
    const upper = args.flag('upper_hex');
    const hex = (n: number): string => (upper ? n.toString(16).toUpperCase() : n.toString(16));
    const u4 = (n: number): string => '\\u' + hex(n).padStart(4, '0');

    const one = (ch: string, next: string): string => {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp > 0xffff) {
        if (minimal) return ch;
        if (es6) return '\\u{' + hex(cp) + '}';
        return u4(ch.charCodeAt(0)) + u4(ch.charCodeAt(1));
      }
      if (!everything && escapeSafe(cp)) return ch;
      if (cp === 0 && !json && !/[0-9]/.test(next)) return '\\0';
      if (ch === "'" || ch === '"' || ch === '`') {
        return ch === quote || everything ? '\\' + ch : ch;
      }
      const single = SINGLE_ESCAPES[ch];
      if (single !== undefined) return single;
      if (minimal && !JS_WHITESPACE.test(ch)) return ch;
      const digits = hex(cp);
      return json || digits.length > 2 ? u4(cp) : '\\x' + digits.padStart(2, '0');
    };

    const out: string[] = [];
    let i = 0;
    let n = 0;
    for (const ch of text) {
      if (n++ % CHECK_EVERY === 0) ctx.check();
      i += ch.length;
      out.push(one(ch, text.charAt(i)));
    }
    let result = out.join('');
    if (quote === '`') result = result.replace(/\$\{/g, '\\${');
    return json ? quote + result + quote : result;
  },
});

const UNESCAPE = new RegExp(
  String.raw`\\(u[dD][89abAB][0-9a-fA-F]{2}\\u[dD][c-fC-F][0-9a-fA-F]{2}` +
    String.raw`|[abfnrtv'"]|[0-3][0-7]{2}|[0-7]{1,2}|x[0-9a-fA-F]{2}` +
    String.raw`|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]{1,6}\}|\\)`,
  'g',
);
const UNESCAPE_SIMPLE: Readonly<Record<string, string>> = {
  '\\': '\\',
  a: '\x07',
  b: '\b',
  t: '\t',
  n: '\n',
  v: '\v',
  f: '\f',
  r: '\r',
  '"': '"',
  "'": "'",
};

function unescapeOne(m: string, a: string): string {
  const simple = UNESCAPE_SIMPLE[a];
  if (simple !== undefined) return simple;
  if (a.startsWith('x')) return String.fromCharCode(parseInt(a.slice(1), 16));
  if (!a.startsWith('u')) return String.fromCharCode(parseInt(a, 8));
  if (a.length === 11) {
    // A surrogate pair \uD8xx\uDCxx.
    return String.fromCharCode(parseInt(a.slice(1, 5), 16), parseInt(a.slice(7), 16));
  }
  const cp = a[1] === '{' ? parseInt(a.slice(2, -1), 16) : parseInt(a.slice(1), 16);
  if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
    throw new UniChefError('E_DECODE', `${m} is not a Unicode scalar value.`);
  }
  return String.fromCodePoint(cp);
}

export const unescapeString = defineOp({
  id: 'unescape-string',
  name: 'Unescape String',
  category: 'Encoding',
  description:
    'Replace backslash escapes: \\n \\r \\t \\b \\f \\v \\a, quotes and backslash, octal ' +
    '\\nnn, hex \\xnn, \\unnnn (surrogate pairs combine) and \\u{n...}. Other backslashes ' +
    'stay as they are.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: "Don\\'t stop\\n", args: {}, output: "Don't stop\n" }],
  args: [],
  run(text, _args, ctx) {
    ctx.check();
    return text.replace(UNESCAPE, unescapeOne);
  },
});

// ---------------------------------------------------------------------------
// Smart characters and wrapping

const SMART: ReadonlyMap<number, string> = new Map([
  [0x201c, '"'],
  [0x201d, '"'],
  [0x201e, '"'],
  [0x201f, '"'],
  [0x2033, '"'],
  [0x2018, "'"],
  [0x2019, "'"],
  [0x201a, "'"],
  [0x201b, "'"],
  [0x2032, "'"],
  [0x2010, '-'],
  [0x2011, '-'],
  [0x2012, '-'],
  [0x2013, '-'],
  [0x2014, '--'],
  [0x2015, '--'],
  [0x2026, '...'],
  [0x00a9, '(c)'],
  [0x00ae, '(r)'],
  [0x2122, '(tm)'],
  [0x2190, '<--'],
  [0x2192, '-->'],
  [0x2191, '^'],
  [0x2193, 'v'],
  [0x2194, '<->'],
  [0x21d0, '<=='],
  [0x21d2, '==>'],
  [0x21d4, '<=>'],
  [0x00ab, '<<'],
  [0x00bb, '>>'],
  [0x2039, '<'],
  [0x203a, '>'],
  [0x00d7, 'x'],
  [0x00f7, '/'],
  [0x00b1, '+/-'],
  [0x2022, '*'],
  [0x00b7, '.'],
  [0x00a0, ' '],
  [0x2002, ' '],
  [0x2003, ' '],
  [0x2009, ' '],
  [0x200a, ' '],
]);
const UNMAPPABLE: Readonly<Record<string, string | null>> = {
  include: null,
  remove: '',
  replace: '.',
};

export const escapeSmartCharacters = defineOp({
  id: 'escape-smart-characters',
  name: 'Escape Smart Characters',
  category: 'Text',
  description:
    'Replace typographic characters (curly quotes, dashes, ellipsis, ©, ®, ™, arrows and ' +
    'some spaces) with plain ASCII. Other non-ASCII characters are kept (`include`), removed ' +
    '(`remove`) or replaced with a dot (`replace`).',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '\u201cHi\u201d \u2014 ok\u2026', args: {}, output: '"Hi" -- ok...' }],
  args: [enumArg('unmappable', Object.keys(UNMAPPABLE))],
  run(text, args, ctx) {
    ctx.check();
    const other = UNMAPPABLE[args.text('unmappable')] ?? null;
    return Array.from(text, (ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < 0x80 ? ch : (SMART.get(cp) ?? other ?? ch);
    }).join('');
  },
});

export const wrap = defineOp({
  id: 'wrap',
  name: 'Wrap',
  category: 'Text',
  description:
    'Break each line into lines of at most `width` characters. Existing line breaks, ' +
    'blank lines and a CR before a line feed are kept.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'abcdefg', args: { width: 3 }, output: 'abc\ndef\ng' }],
  args: [intArg('width', 64, 1, MAX_WIDTH)],
  run(text, args, ctx) {
    const width = args.int('width');
    return text
      .split('\n')
      .map((line, n) => {
        if (n % CHECK_EVERY === 0) ctx.check();
        const cr = line.endsWith('\r') ? '\r' : '';
        const body = Array.from(cr ? line.slice(0, -1) : line);
        const chunks: string[] = [];
        for (let i = 0; i < body.length; i += width) {
          chunks.push(body.slice(i, i + width).join(''));
        }
        return (chunks.length > 0 ? chunks.join('\n') : '') + cr;
      })
      .join('\n');
  },
});

export const TEXT_FORMAT_OPS: readonly Operation[] = [
  toSnakeCase,
  toKebabCase,
  toCamelCase,
  toHexdump,
  fromHexdump,
  toHexContent,
  fromHexContent,
  escapeString,
  unescapeString,
  escapeSmartCharacters,
  wrap,
];
