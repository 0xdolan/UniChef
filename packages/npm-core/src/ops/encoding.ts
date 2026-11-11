// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Encoding operations (PRD §3.8 Alpha; semantics in spec/README.md).
 *
 * A port of `unichef/core/ops/encoding.py`. Python strings index by code point, so text
 * is split with `Array.from` wherever lengths or positions matter.
 */

import * as utf8 from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import {
  boolArg,
  defineOp,
  enumArg,
  pyRepr,
  stringArg,
  type Args,
  type OpContext,
  type Operation,
} from './types.js';

export const CHECK_EVERY = 64 * 1024;
const BYTE_BITS = 8;
const ASCII_END = 0x80;
const SUPPLEMENTARY = 0x10000;
const MAX_CODE_POINT = 0x10ffff;

const decodeError = (what: string): UniChefError => new UniChefError('E_DECODE', what);

/** Python's `-n % m` for non-negative `n`. */
const padCount = (n: number, m: number): number => (m - (n % m)) % m;

const isSurrogate = (cp: number): boolean => cp >= 0xd800 && cp <= 0xdfff;

// ---------------------------------------------------------------------------
// Radix-2^n codecs shared by Base64 and Base32

function encodeRadix(
  data: Uint8Array,
  alphabet: readonly string[],
  bits: number,
  ctx: OpContext,
): string {
  // When every symbol is one non-surrogate UTF-16 unit, the output is built as bytes and
  // decoded in one call, which is far faster on large inputs than joining one-character
  // strings (NFR-002). Without surrogates the decode is exact.
  const units = alphabet.every((ch) => ch.length === 1 && !isSurrogate(ch.charCodeAt(0)))
    ? alphabet.map((ch) => ch.charCodeAt(0))
    : null;
  const codes = new Uint16Array(symbolCount(data.length, bits));
  let n = 0;
  let acc = 0;
  let held = 0;
  const mask = (1 << bits) - 1;
  for (let i = 0; i < data.length; i += 1) {
    if (i % CHECK_EVERY === 0) {
      ctx.check();
    }
    acc = ((acc << 8) | (data[i] ?? 0)) & 0xffff;
    held += 8;
    while (held >= bits) {
      held -= bits;
      codes[n] = (acc >> held) & mask;
      n += 1;
    }
  }
  if (held) {
    codes[n] = (acc << (bits - held)) & mask;
  }
  if (units === null) {
    return Array.from(codes, (v) => alphabet[v] ?? '').join('');
  }
  if (units.every((unit) => unit < 0x80)) {
    const ascii = new Uint8Array(codes.length);
    for (let i = 0; i < codes.length; i += 1) {
      ascii[i] = units[codes[i] ?? 0] ?? 0;
    }
    return new TextDecoder().decode(ascii);
  }
  const bytes = new Uint8Array(codes.length * 2);
  for (let i = 0; i < codes.length; i += 1) {
    const unit = units[codes[i] ?? 0] ?? 0;
    bytes[2 * i] = unit & 0xff;
    bytes[2 * i + 1] = unit >> 8;
  }
  return new TextDecoder('utf-16le').decode(bytes);
}

/** How many `bits`-bit symbols encode `bytes` bytes, before padding. */
const symbolCount = (bytes: number, bits: number): number => Math.ceil((bytes * BYTE_BITS) / bits);

/** Decode alphabet values; trailing bits must be < `bits` (zero when strict). */
function decodeRadix(values: Uint8Array, bits: number, strict: boolean): Uint8Array {
  const out = new Uint8Array(Math.floor((values.length * bits) / BYTE_BITS));
  let n = 0;
  let acc = 0;
  let held = 0;
  for (const value of values) {
    acc = ((acc << bits) | value) & 0xffff;
    held += bits;
    if (held >= BYTE_BITS) {
      held -= BYTE_BITS;
      out[n] = (acc >> held) & 0xff;
      n += 1;
    }
  }
  if (held >= bits) {
    throw decodeError('The input ends with an incomplete group.');
  }
  if (strict && acc & ((1 << held) - 1)) {
    throw decodeError('The unused trailing bits are not zero.');
  }
  return out.subarray(0, n);
}

const valuesOf = (chars: readonly string[], index: ReadonlyMap<string, number>): Uint8Array =>
  Uint8Array.from(chars, (ch) => index.get(ch) ?? 0);

/**
 * UTF-16 unit → alphabet value (-1 outside it), or `null` unless every character and the pad
 * are single units outside the surrogates. Then one unit is one code point, so scanning units
 * gives the same result as scanning code points: a surrogate pair is never in the alphabet.
 */
function unitTable(alphabet: readonly string[], pad: string): Int8Array | null {
  if (pad.length !== 1 || isSurrogate(pad.charCodeAt(0))) {
    return null;
  }
  const table = new Int8Array(0x10000).fill(-1);
  for (const [i, ch] of alphabet.entries()) {
    const unit = ch.charCodeAt(0);
    if (ch.length !== 1 || isSurrogate(unit)) {
      return null;
    }
    table[unit] = i;
  }
  return table;
}

/** `strictBody` and the lenient filter over UTF-16 units, for a `unitTable` alphabet. */
function unitValues(
  text: string,
  table: Int8Array,
  pad: string,
  group: number,
  strict: boolean,
): Uint8Array {
  let end = text.length;
  if (strict) {
    while (end > 0 && text[end - 1] === pad) {
      end -= 1;
    }
  }
  const values = new Uint8Array(end);
  let n = 0;
  for (let i = 0; i < end; i += 1) {
    const value = table[text.charCodeAt(i)] ?? -1;
    if (value >= 0) {
      values[n] = value;
      n += 1;
    } else if (strict) {
      throw decodeError('Strict mode: the input is not canonical.');
    }
  }
  if (strict) {
    // Every unit was in the alphabet or a pad, so units and code points agree here.
    if (text.length % group) {
      throw decodeError('Strict mode: the input is not canonical.');
    }
    if (text.length - end !== padCount(end, group)) {
      throw decodeError('Strict mode: the padding is wrong.');
    }
  }
  return values.subarray(0, n);
}

function strictBody(
  text: readonly string[],
  pad: string,
  group: number,
  alphabet: ReadonlyMap<string, number>,
): string[] {
  let end = text.length;
  if (pad) {
    while (end > 0 && text[end - 1] === pad) {
      end -= 1;
    }
  }
  const body = text.slice(0, end);
  const pads = text.length - end;
  if (text.length % group || body.some((ch) => !alphabet.has(ch))) {
    throw decodeError('Strict mode: the input is not canonical.');
  }
  if (pads !== padCount(body.length, group)) {
    throw decodeError('Strict mode: the padding is wrong.');
  }
  return body;
}

const indexOf = (alphabet: readonly string[]): Map<string, number> =>
  new Map(alphabet.map((ch, i) => [ch, i]));

// ---------------------------------------------------------------------------
// Base64

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64URL = B64.slice(0, 62) + '-_';
const B64_ALPHABETS = ['standard', 'url', 'custom'];

function b64Alphabet(args: Args): [string[], string] {
  const choice = args.text('alphabet');
  if (choice === 'standard') {
    return [Array.from(B64), '='];
  }
  if (choice === 'url') {
    return [Array.from(B64URL), '='];
  }
  const custom = Array.from(args.text('custom'));
  if ((custom.length !== 64 && custom.length !== 65) || new Set(custom).size !== custom.length) {
    throw new UniChefError(
      'E_ARG_INVALID',
      'A custom Base64 alphabet needs 64 unique characters and an optional pad.',
    );
  }
  return [custom.slice(0, 64), custom[64] ?? '='];
}

export const toBase64 = defineOp({
  id: 'to-base64',
  name: 'To Base64',
  category: 'Encoding',
  description: 'Encode bytes as Base64 (RFC 4648 §4 or §5, or a custom alphabet).',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Hello, world!', args: {}, output: 'SGVsbG8sIHdvcmxkIQ==' }],
  args: [enumArg('alphabet', B64_ALPHABETS), stringArg('custom'), boolArg('padding', true)],
  run(data, args, ctx) {
    const [alphabet, pad] = b64Alphabet(args);
    const out = encodeRadix(data, alphabet, 6, ctx);
    return args.flag('padding') ? out + pad.repeat(padCount(symbolCount(data.length, 6), 4)) : out;
  },
});

export const fromBase64 = defineOp({
  id: 'from-base64',
  name: 'From Base64',
  category: 'Encoding',
  description: 'Decode Base64. Without `strict`, characters outside the alphabet are skipped.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: 'SGVsbG8sIHdvcmxkIQ==', args: {}, output: 'Hello, world!' }],
  args: [enumArg('alphabet', B64_ALPHABETS), stringArg('custom'), boolArg('strict')],
  run(text, args, ctx) {
    const [alphabet, pad] = b64Alphabet(args);
    ctx.check();
    const strict = args.flag('strict');
    const table = unitTable(alphabet, pad);
    if (table !== null) {
      return decodeRadix(unitValues(text, table, pad, 4, strict), 6, strict);
    }
    const index = indexOf(alphabet);
    const all = Array.from(text);
    const chars = strict ? strictBody(all, pad, 4, index) : all.filter((ch) => index.has(ch));
    return decodeRadix(valuesOf(chars, index), 6, strict);
  },
});

// ---------------------------------------------------------------------------
// Base32

const B32: Readonly<Record<string, string>> = {
  rfc4648: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  hex: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
};
const B32_TAILS = new Set([0, 2, 4, 5, 7]);

export const toBase32 = defineOp({
  id: 'to-base32',
  name: 'To Base32',
  category: 'Encoding',
  description: 'Encode bytes as Base32 (RFC 4648 §6) or base32hex (§7).',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Hello', args: {}, output: 'JBSWY3DP' }],
  args: [enumArg('alphabet', Object.keys(B32)), boolArg('padding', true)],
  run(data, args, ctx) {
    const out = encodeRadix(data, Array.from(B32[args.text('alphabet')] ?? ''), 5, ctx);
    return args.flag('padding') ? out + '='.repeat(padCount(symbolCount(data.length, 5), 8)) : out;
  },
});

export const fromBase32 = defineOp({
  id: 'from-base32',
  name: 'From Base32',
  category: 'Encoding',
  description:
    'Decode Base32. Without `strict`, it is case-insensitive and skips other characters.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: 'JBSWY3DP', args: {}, output: 'Hello' }],
  args: [enumArg('alphabet', Object.keys(B32)), boolArg('strict')],
  run(text, args, ctx) {
    const index = indexOf(Array.from(B32[args.text('alphabet')] ?? ''));
    ctx.check();
    const strict = args.flag('strict');
    let chars: string[];
    if (strict) {
      chars = strictBody(Array.from(text), '=', 8, index);
    } else {
      chars = [];
      for (const ch of text) {
        if (index.has(ch)) {
          chars.push(ch);
        } else if (/^[a-z]$/.test(ch) && index.has(ch.toUpperCase())) {
          chars.push(ch.toUpperCase());
        }
      }
    }
    if (!B32_TAILS.has(chars.length % 8)) {
      throw decodeError('The input ends with an incomplete Base32 group.');
    }
    return decodeRadix(valuesOf(chars, index), 5, strict);
  },
});

// ---------------------------------------------------------------------------
// Hex

const HEX_DELIMITERS: Readonly<Record<string, string>> = {
  none: '',
  space: ' ',
  comma: ',',
  colon: ':',
  newline: '\n',
};
const HEX_PREFIXES = ['0x', '\\x'];
const HEX_CHOICES = [...Object.keys(HEX_DELIMITERS), ...HEX_PREFIXES];
const AUTO_PREFIX = /0[xX]|\\x/g;
const AUTO_SEPARATOR = /[\t\n\v\f\r ,:;-]/g;
const HEX_PAIR = /^[0-9a-fA-F]{2}$/;
const HEX_DIGITS = /^(?:[0-9a-fA-F]{2})*$/;

function hexBytes(tokens: readonly string[]): Uint8Array {
  return Uint8Array.from(tokens, (t) => Number.parseInt(t, 16));
}

function pairs(text: string, width: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += width) {
    out.push(text.slice(i, i + width));
  }
  return out;
}

export const toHex = defineOp({
  id: 'to-hex',
  name: 'To Hex',
  category: 'Encoding',
  description: 'Write each byte as two hex digits, separated or prefixed by `delimiter`.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Héllo', args: {}, output: '48 c3 a9 6c 6c 6f' }],
  args: [enumArg('delimiter', HEX_CHOICES, 'space'), enumArg('case', ['lower', 'upper'])],
  run(data, args, ctx) {
    ctx.check();
    const delimiter = args.text('delimiter');
    const upper = args.text('case') === 'upper';
    const digits = Array.from(data, (b) => {
      const h = b.toString(16).padStart(2, '0');
      return upper ? h.toUpperCase() : h;
    });
    if (HEX_PREFIXES.includes(delimiter)) {
      return digits.map((p) => delimiter + p).join('');
    }
    return digits.join(HEX_DELIMITERS[delimiter] ?? '');
  },
});

export const fromHex = defineOp({
  id: 'from-hex',
  name: 'From Hex',
  category: 'Encoding',
  description: 'Read hex digit pairs. `auto` strips 0x and \\x prefixes, whitespace and ,:;-.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: '48 c3 a9 6c 6c 6f', args: {}, output: 'Héllo' }],
  args: [enumArg('delimiter', ['auto', ...HEX_CHOICES])],
  run(text, args, ctx) {
    ctx.check();
    const delimiter = args.text('delimiter');
    if (delimiter === 'auto') {
      const digits = text.replace(AUTO_PREFIX, '').replace(AUTO_SEPARATOR, '');
      if (!HEX_DIGITS.test(digits)) {
        throw decodeError('The input holds a non-hex character or an odd digit count.');
      }
      return hexBytes(pairs(digits, 2));
    }
    if (text === '') {
      return new Uint8Array();
    }
    let tokens: string[];
    if (HEX_PREFIXES.includes(delimiter)) {
      tokens = text.split(delimiter);
      if (tokens[0] !== '') {
        throw decodeError(`Every byte must start with ${delimiter}.`);
      }
      tokens = tokens.slice(1);
    } else if (delimiter === 'none') {
      if (Array.from(text).length % 2) {
        throw decodeError('The input has an odd number of hex digits.');
      }
      tokens = pairs(text, 2);
    } else {
      tokens = text.split(HEX_DELIMITERS[delimiter] ?? '');
    }
    if (!tokens.every((t) => HEX_PAIR.test(t))) {
      throw decodeError('Every byte must be exactly two hex digits.');
    }
    return hexBytes(tokens);
  },
});

// ---------------------------------------------------------------------------
// Binary, octal and decimal bytes

const RADIX_DELIMITERS: Readonly<Record<string, string>> = {
  space: ' ',
  comma: ',',
  colon: ':',
  newline: '\n',
  none: '',
};
const RADIX_AUTO_SEPARATORS = /[\t\n\v\f\r ,:;]+/;
const MAX_BYTE = 0xff;

interface Radix {
  readonly name: string;
  readonly token: RegExp;
  readonly width: number;
}

const RADIXES: Readonly<Record<2 | 8 | 10, Radix>> = {
  2: { name: 'binary', token: /^[01]{1,8}$/, width: 8 },
  8: { name: 'octal', token: /^[0-7]{1,3}$/, width: 3 },
  10: { name: 'decimal', token: /^[0-9]{1,3}$/, width: 0 },
};

function toRadix(data: Uint8Array, base: 2 | 8 | 10, delimiter: string, ctx: OpContext): string {
  ctx.check();
  const { width } = RADIXES[base];
  return Array.from(data, (b) => b.toString(base).padStart(width, '0')).join(
    RADIX_DELIMITERS[delimiter] ?? '',
  );
}

function fromRadix(text: string, base: 2 | 8 | 10, delimiter: string, ctx: OpContext): Uint8Array {
  ctx.check();
  const { name, token, width } = RADIXES[base];
  let tokens: string[];
  if (delimiter === 'auto') {
    tokens = text.split(RADIX_AUTO_SEPARATORS).filter((t) => t !== '');
  } else if (text === '') {
    return new Uint8Array();
  } else if (delimiter === 'none') {
    const chars = Array.from(text);
    if (chars.length % width) {
      throw decodeError(`The input length is not a multiple of ${String(width)} ${name} digits.`);
    }
    tokens = [];
    for (let i = 0; i < chars.length; i += width) {
      tokens.push(chars.slice(i, i + width).join(''));
    }
  } else {
    tokens = text.split(RADIX_DELIMITERS[delimiter] ?? '');
  }
  const out = new Uint8Array(tokens.length);
  for (const [i, t] of tokens.entries()) {
    const value = token.test(t) ? Number.parseInt(t, base) : NaN;
    if (!(value <= MAX_BYTE)) {
      throw decodeError(`${pyRepr(t)} is not a ${name} byte value (0-255).`);
    }
    out[i] = value;
  }
  return out;
}

const FIXED = Object.keys(RADIX_DELIMITERS);
const VARIABLE = FIXED.filter((d) => d !== 'none');

function radixOps(
  base: 2 | 8 | 10,
  title: string,
  delimiters: readonly string[],
  toDescription: string,
  fromDescription: string,
  /** "Hi" written in this radix, for the examples. */
  hi: string,
): Operation[] {
  const { name } = RADIXES[base];
  return [
    defineOp({
      id: `to-${name}`,
      name: `To ${title}`,
      category: 'Encoding',
      description: toDescription,
      inputType: 'bytes',
      outputType: 'string',
      examples: [{ input: 'Hi', args: {}, output: hi }],
      args: [enumArg('delimiter', delimiters)],
      run: (data, args, ctx) => toRadix(data, base, args.text('delimiter'), ctx),
    }),
    defineOp({
      id: `from-${name}`,
      name: `From ${title}`,
      category: 'Encoding',
      description: fromDescription,
      inputType: 'string',
      outputType: 'bytes',
      examples: [{ input: hi, args: {}, output: 'Hi' }],
      args: [enumArg('delimiter', ['auto', ...delimiters])],
      run: (text, args, ctx) => fromRadix(text, base, args.text('delimiter'), ctx),
    }),
  ];
}

// ---------------------------------------------------------------------------
// URL encoding

const UNRESERVED = new Set(
  Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~', (c) =>
    c.charCodeAt(0),
  ),
);
const RESERVED = new Set(":/?#[]@!$&'()*+,;=%");

const pct = (n: number): string => `%${n.toString(16).toUpperCase().padStart(2, '0')}`;

export const urlEncode = defineOp({
  id: 'url-encode',
  name: 'URL Encode',
  category: 'Encoding',
  description: 'Percent-encode with upper-case hex over the UTF-8 bytes of the input.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'café au lait', args: {}, output: 'caf%C3%A9%20au%20lait' }],
  args: [enumArg('mode', ['component', 'all', 'reserved-only'])],
  run(text, args, ctx) {
    ctx.check();
    const mode = args.text('mode');
    if (mode === 'reserved-only') {
      return Array.from(utf8.scrub(text), (ch) =>
        RESERVED.has(ch) ? pct(ch.charCodeAt(0)) : ch,
      ).join('');
    }
    const component = mode === 'component';
    return Array.from(utf8.encode(text), (b) =>
      component && UNRESERVED.has(b) ? String.fromCharCode(b) : pct(b),
    ).join('');
  },
});

const isHexByte = (b: number | undefined): boolean =>
  b !== undefined &&
  ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66));

export const urlDecode = defineOp({
  id: 'url-decode',
  name: 'URL Decode',
  category: 'Encoding',
  description: 'Decode %XX escapes; malformed escapes stay as they are. Never fails.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'caf%C3%A9%20au%20lait', args: {}, output: 'café au lait' }],
  args: [boolArg('plus-as-space')],
  run(text, args, ctx) {
    ctx.check();
    const raw = utf8.encode(text);
    const plus = args.flag('plus-as-space');
    const out = new Uint8Array(raw.length);
    let n = 0;
    for (let i = 0; i < raw.length; i += 1) {
      const b = raw[i] ?? 0;
      if (b === 0x25 && isHexByte(raw[i + 1]) && isHexByte(raw[i + 2])) {
        out[n] = Number.parseInt(String.fromCharCode(raw[i + 1] ?? 0, raw[i + 2] ?? 0), 16);
        i += 2;
      } else {
        out[n] = plus && b === 0x2b ? 0x20 : b;
      }
      n += 1;
    }
    return utf8.decode(out.subarray(0, n));
  },
});

// ---------------------------------------------------------------------------
// Character encodings

const TEXT_ENCODINGS = [
  'utf-8',
  'utf-16le',
  'utf-16be',
  'utf-32le',
  'utf-32be',
  'iso-8859-1',
  'windows-1252',
  'ascii',
];

/** WHATWG index-windows-1252 for 0x80-0x9F. The rest of the bytes map to themselves. */
const W1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
export const W1252_DECODE: readonly string[] = Array.from({ length: 256 }, (_, b) =>
  b >= 0x80 && b < 0xa0 ? (W1252_HIGH[b - 0x80] ?? '') : String.fromCharCode(b),
);
const W1252_ENCODE = new Map(W1252_DECODE.map((ch, b) => [ch, b]));
const LATIN1_ENCODE = new Map(Array.from({ length: 256 }, (_, b) => [String.fromCharCode(b), b]));
const ASCII_ENCODE = new Map(Array.from({ length: 128 }, (_, b) => [String.fromCharCode(b), b]));
const BYTE_TABLES: Readonly<Record<string, ReadonlyMap<string, number>>> = {
  'iso-8859-1': LATIN1_ENCODE,
  'windows-1252': W1252_ENCODE,
  ascii: ASCII_ENCODE,
};

const TEXT_ARGS = [enumArg('encoding', TEXT_ENCODINGS), enumArg('errors', ['replace', 'strict'])];

function encodeWide(text: string, bytes: 2 | 4, little: boolean): Uint8Array {
  const units: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (bytes === 4 || cp < SUPPLEMENTARY) {
      units.push(cp);
    } else {
      units.push(0xd800 | ((cp - SUPPLEMENTARY) >> 10), 0xdc00 | ((cp - SUPPLEMENTARY) & 0x3ff));
    }
  }
  const out = new Uint8Array(units.length * bytes);
  const view = new DataView(out.buffer);
  for (const [i, unit] of units.entries()) {
    if (bytes === 2) {
      view.setUint16(i * 2, unit, little);
    } else {
      view.setUint32(i * 4, unit, little);
    }
  }
  return out;
}

function decodeUtf16(data: Uint8Array, little: boolean, strict: boolean): string {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = data.length >> 1;
  const out: string[] = [];
  let bad = false;
  let i = 0;
  while (i < count) {
    const unit = view.getUint16(i * 2, little);
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < count) {
      const next = view.getUint16(i * 2 + 2, little);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out.push(String.fromCharCode(unit, next));
        i += 2;
        continue;
      }
    }
    if (isSurrogate(unit)) {
      out.push(utf8.REPLACEMENT);
      bad = true;
    } else {
      out.push(String.fromCharCode(unit));
    }
    i += 1;
  }
  if (data.length % 2) {
    out.push(utf8.REPLACEMENT);
    bad = true;
  }
  if (bad && strict) {
    throw decodeError('The input is not well-formed UTF-16.');
  }
  return out.join('');
}

function decodeUtf32(data: Uint8Array, little: boolean, strict: boolean): string {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out: string[] = [];
  let bad = false;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const cp = view.getUint32(i, little);
    if (cp > MAX_CODE_POINT || isSurrogate(cp)) {
      out.push(utf8.REPLACEMENT);
      bad = true;
    } else {
      out.push(String.fromCodePoint(cp));
    }
  }
  if (data.length % 4) {
    out.push(utf8.REPLACEMENT);
    bad = true;
  }
  if (bad && strict) {
    throw decodeError('The input is not well-formed UTF-32.');
  }
  return out.join('');
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export const encodeText = defineOp({
  id: 'encode-text',
  name: 'Encode Text',
  category: 'Encoding',
  description: 'Encode text in a character encoding. Lone surrogates become U+FFFD; no BOM.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [
    { input: 'café', args: { encoding: 'iso-8859-1' }, output: '63 61 66 e9' },
    { input: 'é👋', args: { encoding: 'utf-16le' }, output: 'e9 00 3d d8 4b dc' },
  ],
  args: TEXT_ARGS,
  run(input, args, ctx) {
    ctx.check();
    const encoding = args.text('encoding');
    const strict = args.text('errors') === 'strict';
    const text = utf8.scrub(input);
    if (encoding === 'utf-8') {
      return utf8.encode(text);
    }
    const little = encoding.endsWith('le');
    if (encoding.startsWith('utf-16')) {
      return encodeWide(text, 2, little);
    }
    if (encoding.startsWith('utf-32')) {
      return encodeWide(text, 4, little);
    }
    const table = BYTE_TABLES[encoding] ?? ASCII_ENCODE;
    const out: number[] = [];
    for (const ch of text) {
      let byte = table.get(ch);
      if (byte === undefined) {
        if (strict) {
          const cp = (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');
          throw decodeError(`U+${cp} cannot be encoded in ${encoding}.`);
        }
        byte = 0x3f;
      }
      out.push(byte);
    }
    return Uint8Array.from(out);
  },
});

export const decodeText = defineOp({
  id: 'decode-text',
  name: 'Decode Text',
  category: 'Encoding',
  description: 'Decode bytes from a character encoding. Ill-formed input becomes U+FFFD.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'café', args: {}, output: 'café' }],
  args: TEXT_ARGS,
  run(data, args, ctx) {
    const encoding = args.text('encoding');
    const strict = args.text('errors') === 'strict';
    if (encoding === 'utf-8') {
      const text = utf8.decode(data, ctx.check);
      if (strict && text.includes(utf8.REPLACEMENT) && !sameBytes(utf8.encode(text), data)) {
        throw decodeError('The input is not well-formed UTF-8.');
      }
      return text;
    }
    ctx.check();
    const little = encoding.endsWith('le');
    if (encoding.startsWith('utf-16')) {
      return decodeUtf16(data, little, strict);
    }
    if (encoding.startsWith('utf-32')) {
      return decodeUtf32(data, little, strict);
    }
    const out: string[] = [];
    if (encoding === 'iso-8859-1') {
      for (const b of data) {
        out.push(String.fromCharCode(b));
      }
    } else if (encoding === 'windows-1252') {
      for (const b of data) {
        out.push(W1252_DECODE[b] ?? '');
      }
    } else {
      if (strict && data.some((b) => b > 0x7f)) {
        throw decodeError('The input holds a byte above 7F.');
      }
      for (const b of data) {
        out.push(b < ASCII_END ? String.fromCharCode(b) : utf8.REPLACEMENT);
      }
    }
    return out.join('');
  },
});

export const ENCODING_OPS: readonly Operation[] = [
  toBase64,
  fromBase64,
  toBase32,
  fromBase32,
  toHex,
  fromHex,
  ...radixOps(
    2,
    'Binary',
    FIXED,
    'Write each byte as eight binary digits, separated by `delimiter`.',
    'Read bytes of 1-8 binary digits. `auto` splits on runs of whitespace and ,:; and ' +
      '`none` reads groups of exactly eight digits.',
    '01001000 01101001',
  ),
  ...radixOps(
    8,
    'Octal',
    FIXED,
    'Write each byte as three octal digits, separated by `delimiter`.',
    'Read bytes of 1-3 octal digits (at most 377). `auto` splits on runs of whitespace ' +
      'and ,:; and `none` reads groups of exactly three digits.',
    '110 151',
  ),
  ...radixOps(
    10,
    'Decimal',
    VARIABLE,
    'Write each byte as a decimal number without padding, separated by `delimiter`.',
    'Read bytes of 1-3 decimal digits (at most 255). `auto` splits on runs of ' +
      'whitespace and ,:;',
    '72 105',
  ),
  urlEncode,
  urlDecode,
  encodeText,
  decodeText,
];
