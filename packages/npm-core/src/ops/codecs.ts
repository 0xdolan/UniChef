// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Base58, Base85 and quoted-printable (PRD §3.8 Beta; semantics in spec/README.md).
 *
 * A port of `unichef/core/ops/codecs.py`.
 */

import * as utf8 from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import { boolArg, defineOp, enumArg, pyRepr, type OpContext, type Operation } from './types.js';

const decodeError = (what: string): UniChefError => new UniChefError('E_DECODE', what);

/** The first character of `text` (by code point) that is not in `allowed`. */
function firstOutside(text: string, allowed: ReadonlySet<string>): string | undefined {
  for (const ch of text) {
    if (!allowed.has(ch)) return ch;
  }
  return undefined;
}

/** `text` without the characters that are not in `allowed`. */
function keepOnly(text: string, allowed: ReadonlySet<string>): string {
  let out = '';
  for (const ch of text) {
    if (allowed.has(ch)) out += ch;
  }
  return out;
}

/** Python's `str.isspace()` characters (unlike JS `\s`, without U+FEFF). */
const PY_SPACE =
  '[\\t-\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]';
const PY_STRIP = new RegExp(`^${PY_SPACE}+|${PY_SPACE}+$`, 'g');

/** Python's `str.strip()`. */
const pyStrip = (text: string): string => text.replace(PY_STRIP, '');

/** Append every item of `items`, without spreading (which overflows on long inputs). */
function pushAll(out: number[], items: Iterable<number>): void {
  for (const item of items) out.push(item);
}

/** `text` without the leading run of `ch`. */
function stripLeading(text: string, ch: string): string {
  let i = 0;
  while (i < text.length && text[i] === ch) i++;
  return text.slice(i);
}

// ---------------------------------------------------------------------------
// Base58

const B58: Record<string, string> = {
  bitcoin: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  flickr: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',
};
/** Digits per big-integer step: 58**8 < 2**53, so a step's digits fit a safe integer. */
const B58_STEP = 8;
const B58_BASE = 58n ** BigInt(B58_STEP);

function bytesToBigInt(data: Uint8Array): bigint {
  if (data.length === 0) return 0n;
  let hex = '';
  for (const b of data) hex += b.toString(16).padStart(2, '0');
  return BigInt(`0x${hex}`);
}

function bigIntToBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array(0);
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export const toBase58 = defineOp({
  id: 'to-base58',
  name: 'To Base58',
  category: 'Encoding',
  description: "Encode bytes as Base58. Each leading zero byte becomes the alphabet's first digit.",
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Hello', args: {}, output: '9Ajdvzr' }],
  args: [enumArg('alphabet', Object.keys(B58))],
  run(data, args, ctx) {
    const alphabet = B58[args.text('alphabet')] ?? '';
    let zeros = 0;
    while (zeros < data.length && data[zeros] === 0) zeros++;
    let number = bytesToBigInt(data.subarray(zeros));
    const chunks: string[] = [];
    while (number > 0n) {
      ctx.check();
      let chunk = Number(number % B58_BASE);
      number /= B58_BASE;
      let digits = '';
      for (let i = 0; i < B58_STEP; i++) {
        digits = (alphabet[chunk % 58] ?? '') + digits;
        chunk = Math.floor(chunk / 58);
      }
      chunks.push(digits);
    }
    const text = stripLeading(chunks.reverse().join(''), alphabet[0] ?? '');
    return (alphabet[0] ?? '').repeat(zeros) + text;
  },
});

export const fromBase58 = defineOp({
  id: 'from-base58',
  name: 'From Base58',
  category: 'Encoding',
  description: 'Decode Base58. Without `strict`, it skips characters outside the alphabet.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: '9Ajdvzr', args: {}, output: 'Hello' }],
  args: [enumArg('alphabet', Object.keys(B58)), boolArg('strict')],
  run(text, args, ctx) {
    const alphabet = B58[args.text('alphabet')] ?? '';
    const index = new Map(Array.from(alphabet, (ch, i) => [ch, i]));
    const digits = new Set(index.keys());
    let chars: string;
    if (args.flag('strict')) {
      const bad = firstOutside(text, digits);
      if (bad !== undefined)
        throw decodeError(`Strict mode: ${pyRepr(bad)} is not a Base58 digit.`);
      chars = text;
    } else {
      chars = keepOnly(text, digits);
    }
    const body = stripLeading(chars, alphabet[0] ?? '');
    let number = 0n;
    for (let start = 0; start < body.length; start += B58_STEP) {
      ctx.check();
      const part = body.slice(start, start + B58_STEP);
      let chunk = 0;
      for (const ch of part) chunk = chunk * 58 + (index.get(ch) ?? 0);
      number = number * 58n ** BigInt(part.length) + BigInt(chunk);
    }
    const tail = bigIntToBytes(number);
    const out = new Uint8Array(chars.length - body.length + tail.length);
    out.set(tail, chars.length - body.length);
    return out;
  },
});

// ---------------------------------------------------------------------------
// Base85

const B85: Record<string, string> = {
  ascii85: Array.from({ length: 85 }, (_, i) => String.fromCharCode(0x21 + i)).join(''),
  z85: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#',
};
const B85_GROUP = 4;
const B85_DIGITS = 5;
const B85_ZERO = 'z';
const U32_MAX = 0xffffffff;
const B85_CHECK_EVERY = 16 * 1024;

function encodeB85(data: Uint8Array, alphabet: string, zero: boolean, ctx: OpContext): string {
  const out: string[] = [];
  for (let start = 0; start < data.length; start += B85_GROUP) {
    if (start % B85_CHECK_EVERY === 0) ctx.check();
    const size = Math.min(B85_GROUP, data.length - start);
    let value = 0;
    for (let i = 0; i < B85_GROUP; i++)
      value = value * 256 + (i < size ? (data[start + i] ?? 0) : 0);
    if (zero && size === B85_GROUP && value === 0) {
      out.push(B85_ZERO);
      continue;
    }
    let digits = '';
    for (let i = 0; i < B85_DIGITS; i++) {
      digits = (alphabet[value % 85] ?? '') + digits;
      value = Math.floor(value / 85);
    }
    out.push(digits.slice(0, size + 1));
  }
  return out.join('');
}

export const toBase85 = defineOp({
  id: 'to-base85',
  name: 'To Base85',
  category: 'Encoding',
  description: 'Encode bytes as Ascii85 (`z` for a group of four zero bytes) or Z85.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Hello', args: {}, output: '87cURDZ' }],
  args: [enumArg('alphabet', Object.keys(B85)), boolArg('delimiters')],
  run(data, args, ctx) {
    const name = args.text('alphabet');
    if (args.flag('delimiters') && name !== 'ascii85') {
      throw new UniChefError('E_ARG_INVALID', 'Only Ascii85 has <~ ~> delimiters.');
    }
    const text = encodeB85(data, B85[name] ?? '', name === 'ascii85', ctx);
    return args.flag('delimiters') ? `<~${text}~>` : text;
  },
});

export const fromBase85 = defineOp({
  id: 'from-base85',
  name: 'From Base85',
  category: 'Encoding',
  description:
    'Decode Ascii85 (optionally inside `<~ ~>`) or Z85. Without `strict`, it skips' +
    'characters outside the alphabet.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: '87cURDZ', args: {}, output: 'Hello' }],
  args: [enumArg('alphabet', Object.keys(B85)), boolArg('strict')],
  run(text, args, ctx) {
    const name = args.text('alphabet');
    const alphabet = B85[name] ?? '';
    const zero = name === 'ascii85';
    const strict = args.flag('strict');
    // Python's str.strip(): every Unicode whitespace character.
    let body = strict ? text : pyStrip(text);
    if (zero && body.length >= 4 && body.startsWith('<~') && body.endsWith('~>')) {
      body = body.slice(2, -2);
    }
    const index = new Map(Array.from(alphabet, (ch, i) => [ch, i]));
    const usable = new Set(index.keys());
    if (zero) usable.add(B85_ZERO);
    if (strict) {
      const bad = firstOutside(body, usable);
      if (bad !== undefined)
        throw decodeError(`Strict mode: ${pyRepr(bad)} is not a Base85 digit.`);
    } else {
      body = keepOnly(body, usable);
    }
    const out: number[] = [];
    let pos = 0;
    let groups = 0;
    while (pos < body.length) {
      groups += 1;
      if (groups % B85_CHECK_EVERY === 0) ctx.check();
      if (zero && body[pos] === B85_ZERO) {
        out.push(0, 0, 0, 0);
        pos += 1;
        continue;
      }
      const group = body.slice(pos, pos + B85_DIGITS);
      if (zero && group.includes(B85_ZERO)) {
        throw decodeError(`'z' at offset ${pos + group.indexOf(B85_ZERO)} is inside a group.`);
      }
      if (group.length === 1) throw decodeError('The input ends with an incomplete Base85 group.');
      let value = 0;
      for (const ch of group.padEnd(B85_DIGITS, alphabet.at(-1))) {
        value = value * 85 + (index.get(ch) ?? 0);
      }
      if (value > U32_MAX) throw decodeError(`The Base85 group at offset ${pos} is out of range.`);
      const bytes = [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
      pushAll(out, bytes.slice(0, group.length - 1));
      pos += B85_DIGITS;
    }
    const result = Uint8Array.from(out);
    if (strict && encodeB85(result, alphabet, zero, ctx) !== body) {
      throw decodeError('Strict mode: the input is not canonical.');
    }
    return result;
  },
});

// ---------------------------------------------------------------------------
// Quoted-printable (RFC 2045 §6.7)

const QP_MODES = ['text', 'binary'];
const QP_LINE = 76;
const QP_CHECK_EVERY = 1024;
const SPACE = 0x20;
const TAB = 0x09;
const CR = 0x0d;
const LF = 0x0a;
const EQUALS = 0x3d;

const isQpSpace = (b: number): boolean => b === SPACE || b === TAB;
const hexByte = (b: number): string => `=${b.toString(16).toUpperCase().padStart(2, '0')}`;

function qpTokens(line: Uint8Array): string[] {
  const tokens = Array.from(line, (b) =>
    (b >= 33 && b <= 126 && b !== EQUALS) || isQpSpace(b) ? String.fromCharCode(b) : hexByte(b),
  );
  const last = line.at(-1);
  if (last !== undefined && isQpSpace(last)) tokens[tokens.length - 1] = hexByte(last);
  return tokens;
}

function qpWrap(tokens: readonly string[]): string[] {
  const lines: string[] = [];
  let current = '';
  tokens.forEach((token, i) => {
    // A soft break needs one column for its "=", except after the line's last token.
    const room = i === tokens.length - 1 ? QP_LINE : QP_LINE - 1;
    if (current.length + token.length > room) {
      lines.push(`${current}=`);
      current = '';
    }
    current += token;
  });
  lines.push(current);
  return lines;
}

/** Split on CRLF or a lone LF, like Python's `re.split(rb"\r\n|\n", data)`. */
function splitLines(data: Uint8Array): Uint8Array[] {
  const lines: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === LF) {
      const end = i > start && data[i - 1] === CR ? i - 1 : i;
      lines.push(data.subarray(start, end));
      start = i + 1;
    }
  }
  lines.push(data.subarray(start));
  return lines;
}

export const quotedPrintableEncode = defineOp({
  id: 'quoted-printable-encode',
  name: 'Quoted-Printable Encode',
  category: 'Encoding',
  description:
    'Encode bytes as quoted-printable, with lines of at most 76 characters. In `text`' +
    'mode, LF and CRLF are line breaks, written as CRLF; in `binary` mode they are escaped.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'café = 4€', args: {}, output: 'caf=C3=A9 =3D 4=E2=82=AC' }],
  args: [enumArg('mode', QP_MODES)],
  run(data, args, ctx) {
    ctx.check();
    const lines = args.text('mode') === 'text' ? splitLines(data) : [data];
    const out: string[] = [];
    lines.forEach((line, number) => {
      if (number % QP_CHECK_EVERY === 0) ctx.check();
      for (const wrapped of qpWrap(qpTokens(line))) out.push(wrapped);
    });
    return out.join('\r\n');
  },
});

const QP_ESCAPE = /=([0-9A-Fa-f]{2})/g;
const QP_STRICT_ESCAPE = /=[0-9A-F]{2}/g;
const QP_STRICT_TEXT = /^[\t\x20-\x7e]*$/;

function qpStrictCheck(line: string, number: number): void {
  if (!QP_STRICT_TEXT.test(line)) {
    throw decodeError(`Strict mode: line ${number} has a character outside printable ASCII.`);
  }
  if (line.replace(QP_STRICT_ESCAPE, '').includes('=')) {
    throw decodeError(`Strict mode: line ${number} has an invalid '=' escape.`);
  }
}

function qpLine(line: string, out: number[]): void {
  let pos = 0;
  for (const found of line.matchAll(QP_ESCAPE)) {
    pushAll(out, utf8.encode(line.slice(pos, found.index)));
    out.push(parseInt(found[1] ?? '', 16));
    pos = found.index + found[0].length;
  }
  pushAll(out, utf8.encode(line.slice(pos)));
}

export const quotedPrintableDecode = defineOp({
  id: 'quoted-printable-decode',
  name: 'Quoted-Printable Decode',
  category: 'Encoding',
  description:
    'Decode quoted-printable. Soft line breaks and trailing spaces are removed, and' +
    'other line breaks are kept as they are. Without `strict`, lower-case hex is accepted' +
    'and a stray `=` is kept.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: 'caf=C3=A9 =3D 4=E2=82=AC', args: {}, output: 'café = 4€' }],
  args: [boolArg('strict')],
  run(text, args, ctx) {
    const strict = args.flag('strict');
    const parts = text.split(/(\r\n|\n)/);
    const out: number[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      if (i % (2 * QP_CHECK_EVERY) === 0) ctx.check();
      let line = (parts[i] ?? '').replace(/[ \t]+$/, '');
      const brk = parts[i + 1] ?? '';
      const soft = line.endsWith('=');
      if (soft) line = line.slice(0, -1);
      if (strict) qpStrictCheck(line, i / 2 + 1);
      qpLine(line, out);
      if (!soft) for (const ch of brk) out.push(ch.charCodeAt(0));
    }
    return Uint8Array.from(out);
  },
});

export const CODEC_OPS: readonly Operation[] = [
  toBase58,
  fromBase58,
  toBase85,
  fromBase85,
  quotedPrintableEncode,
  quotedPrintableDecode,
];
