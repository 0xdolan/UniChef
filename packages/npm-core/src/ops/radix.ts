// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Number bases, character codes, Modhex and byte order (PRD §3.8 1.1; semantics in
 * spec/README.md).
 *
 * A port of `unichef/core/ops/radix.py`.
 */

import { UniChefError } from '../errors.js';
import { parseHexAuto } from './encoding.js';
import {
  boolArg,
  defineOp,
  enumArg,
  intArg,
  pyRepr,
  type OpContext,
  type Operation,
} from './types.js';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const MIN_RADIX = 2;
const MAX_RADIX = DIGITS.length;
const MAX_BITS = 13_000; // from-base results stay well inside a printable integer dish
const CHECK_EVERY = 4096;
const SPACE = /[\t\n\v\f\r ]+/g;
const EDGE_SPACE = /^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g;
const MAX_CODE_POINT = 0x10ffff;
const HEX = 16;
const ONE_BYTE = 0x100;
const TWO_BYTES = 0x10000;

const decodeError = (what: string): UniChefError => new UniChefError('E_DECODE', what);
const asciiLower = (text: string): string => text.replace(/[A-Z]/g, (c) => c.toLowerCase());
const stripSpace = (text: string): string => text.replace(SPACE, '');
const head = (text: string, n: number): string => Array.from(text).slice(0, n).join('');

/** `value` (zero or more) in `radix`, lower-case, without padding. */
function digits(value: bigint, radix: number, ctx: OpContext): string {
  if (value === 0n) return '0';
  const big = BigInt(radix);
  const out: string[] = [];
  let n = value;
  while (n > 0n) {
    if (out.length % CHECK_EVERY === 0) ctx.check();
    out.push(DIGITS.charAt(Number(n % big)));
    n /= big;
  }
  return out.reverse().join('');
}

/** `body` (case-insensitive) as a number in `radix`, or E_DECODE naming the bad digit. */
function parseDigits(body: string, radix: number, ctx: OpContext): bigint {
  const allowed = DIGITS.slice(0, radix);
  const big = BigInt(radix);
  let value = 0n;
  let i = 0;
  for (const ch of body) {
    if (i++ % CHECK_EVERY === 0) ctx.check();
    const digit = allowed.indexOf(asciiLower(ch));
    if (digit < 0 || ch.length !== 1) {
      throw decodeError(`${pyRepr(ch)} is not a base-${radix} digit.`);
    }
    value = value * big + BigInt(digit);
  }
  return value;
}

const bitLength = (n: bigint): number => (n === 0n ? 0 : n.toString(2).length);
const significant = (text: string): number => Array.from(text.replace(/^0+/, '')).length;

// ---------------------------------------------------------------------------
// Any radix

const FRACTION_DIGITS = 20; // fraction digits written, rounded half up (as CyberChef's BigNumber)
const MAX_DECIMAL_DIGITS = 4000;
const DECIMAL = /^([+-]?)([0-9]*)(?:\.([0-9]*))?$/;
const TEN_TO_FRACTION = 10n ** BigInt(FRACTION_DIGITS);

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return 2n * (numerator % denominator) >= denominator ? quotient + 1n : quotient;
}

const toBase = defineOp({
  id: 'to-base',
  name: 'To Base',
  category: 'Encoding',
  description:
    'Write a decimal number in a radix from 2 to 36 with lower-case digits. A fraction ' +
    'gets at most 20 digits, rounded half up.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    { input: '255', args: { radix: 16 }, output: 'ff' },
    { input: '10.5', args: { radix: 2 }, output: '1010.1' },
  ],
  args: [intArg('radix', 36, MIN_RADIX, MAX_RADIX)],
  run(text, args, ctx) {
    const radix = args.int('radix');
    const match = DECIMAL.exec(stripSpace(text));
    const whole = match?.[2] ?? '';
    const fraction = match?.[3] ?? '';
    if (match === null || (whole === '' && fraction === '')) {
      throw decodeError('The input is not a decimal number.');
    }
    if (whole.length + fraction.length > MAX_DECIMAL_DIGITS) {
      throw decodeError(`The number has more than ${MAX_DECIMAL_DIGITS} digits.`);
    }
    const scale = 10n ** BigInt(fraction.length);
    const value = BigInt(whole + fraction || '0');
    let integer = value / scale;
    const remainder = value % scale;
    let fractionDigits = '';
    if (remainder) {
      const steps = BigInt(radix) ** BigInt(FRACTION_DIGITS);
      let scaled = roundHalfUp(remainder * steps, scale);
      if (scaled === steps) {
        integer += 1n;
        scaled = 0n;
      }
      if (scaled) {
        const body = digits(scaled, radix, ctx).padStart(FRACTION_DIGITS, '0');
        fractionDigits = '.' + body.replace(/0+$/, '');
      }
    }
    const out = digits(integer, radix, ctx) + fractionDigits;
    return match[1] === '-' && out !== '0' ? '-' + out : out;
  },
});

const fromBase = defineOp({
  id: 'from-base',
  name: 'From Base',
  category: 'Encoding',
  description:
    'Read a number written in a radix from 2 to 36 and write it in decimal. Digits are ' +
    'case-insensitive, whitespace is ignored and a leading + or - is allowed. A fraction ' +
    'gets at most 20 decimal places, rounded half up.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    { input: 'ff', args: { radix: 16 }, output: '255' },
    { input: '10.1', args: { radix: 2 }, output: '2.5' },
  ],
  args: [intArg('radix', 36, MIN_RADIX, MAX_RADIX)],
  run(text, args, ctx) {
    const radix = args.int('radix');
    let body = stripSpace(text);
    const negative = body.startsWith('-');
    if (body.startsWith('-') || body.startsWith('+')) body = body.slice(1);
    const dot = body.indexOf('.');
    const whole = dot < 0 ? body : body.slice(0, dot);
    const fraction = dot < 0 ? '' : body.slice(dot + 1);
    if (whole === '' && fraction === '') throw decodeError('The input holds no digits.');
    const tooLarge = `The number is larger than ${MAX_BITS} bits.`;
    if (significant(whole + fraction) > MAX_BITS) throw decodeError(tooLarge);
    const numerator = parseDigits(whole + fraction, radix, ctx);
    const scale = BigInt(radix) ** BigInt(Array.from(fraction).length);
    if (bitLength(numerator / scale) > MAX_BITS) throw decodeError(tooLarge);
    const scaled = roundHalfUp(numerator * TEN_TO_FRACTION, scale);
    const rest = scaled % TEN_TO_FRACTION;
    let out = String(scaled / TEN_TO_FRACTION);
    if (rest) {
      out += '.' + String(rest).padStart(FRACTION_DIGITS, '0').replace(/0+$/, '');
    }
    return negative && out !== '0' ? '-' + out : out;
  },
});

// ---------------------------------------------------------------------------
// Character codes

const CHARCODE_DELIMITERS: Record<string, string> = {
  space: ' ',
  comma: ',',
  semicolon: ';',
  colon: ':',
  newline: '\n',
  crlf: '\r\n',
};
const MAX_CODE_DIGITS = 21; // U+10FFFF in binary

const toCharcode = defineOp({
  id: 'to-charcode',
  name: 'To Charcode',
  category: 'Encoding',
  description:
    'Write each code point in `base`. Base 16 pads to 2, 4 or 6 digits; other bases do ' +
    'not pad.',
  inputType: 'codepoints',
  outputType: 'string',
  examples: [{ input: 'Hé 👋', args: {}, output: '48 e9 20 01f44b' }],
  args: [
    enumArg('delimiter', Object.keys(CHARCODE_DELIMITERS)),
    intArg('base', 16, MIN_RADIX, MAX_RADIX),
  ],
  run(cps, args, ctx) {
    const delimiter = CHARCODE_DELIMITERS[args.text('delimiter')] ?? ' ';
    const base = args.int('base');
    const out: string[] = [];
    cps.forEach((cp, i) => {
      if (i % CHECK_EVERY === 0) ctx.check();
      if (base === HEX) {
        const width = cp < ONE_BYTE ? 2 : cp < TWO_BYTES ? 4 : 6;
        out.push(cp.toString(16).padStart(width, '0'));
      } else {
        out.push(digits(BigInt(cp), base, ctx));
      }
    });
    return out.join(delimiter);
  },
});

const fromCharcode = defineOp({
  id: 'from-charcode',
  name: 'From Charcode',
  category: 'Encoding',
  description:
    'Read code points written in `base` and separated by `delimiter`. Whitespace around ' +
    'each code is ignored and empty codes are skipped.',
  inputType: 'string',
  outputType: 'codepoints',
  examples: [{ input: '48 e9 20 1f44b', args: {}, output: 'U+0048 U+00E9 U+0020 U+1F44B' }],
  args: [
    enumArg('delimiter', Object.keys(CHARCODE_DELIMITERS)),
    intArg('base', 16, MIN_RADIX, MAX_RADIX),
  ],
  run(text, args, ctx) {
    const delimiter = CHARCODE_DELIMITERS[args.text('delimiter')] ?? ' ';
    const base = args.int('base');
    const out: number[] = [];
    text.split(delimiter).forEach((raw, i) => {
      if (i % CHECK_EVERY === 0) ctx.check();
      const token = raw.replace(EDGE_SPACE, '');
      if (token === '') return;
      const tooLarge = `${pyRepr(head(token, 16))} is above U+10FFFF.`;
      if (significant(token) > MAX_CODE_DIGITS) throw decodeError(tooLarge);
      const value = parseDigits(token, base, ctx);
      if (value > BigInt(MAX_CODE_POINT)) throw decodeError(tooLarge);
      out.push(Number(value));
    });
    return out;
  },
});

// ---------------------------------------------------------------------------
// Modhex (YubiKey): hex with the digits 0-f written as cbdefghijklnrtuv

const MODHEX = 'cbdefghijklnrtuv';
const MODHEX_DELIMITERS: Record<string, string> = {
  space: ' ',
  percent: '%',
  comma: ',',
  semicolon: ';',
  colon: ':',
  newline: '\n',
  crlf: '\r\n',
  none: '',
};
const NOT_MODHEX = /[^cbdefghijklnrtuv]/gu;

const toModhex = defineOp({
  id: 'to-modhex',
  name: 'To Modhex',
  category: 'Encoding',
  description:
    'Write each byte as two Modhex digits, separated by `delimiter`. With ' +
    '`bytes_per_line`, a line feed follows the delimiter after every that many bytes.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Hi!', args: {}, output: 'fj hk db' }],
  args: [enumArg('delimiter', Object.keys(MODHEX_DELIMITERS)), intArg('bytes_per_line', 0, 0)],
  run(data, args, ctx) {
    const delimiter = MODHEX_DELIMITERS[args.text('delimiter')] ?? ' ';
    const perLine = args.int('bytes_per_line');
    const out: string[] = [];
    const last = data.length - 1;
    data.forEach((byte, i) => {
      if (i % CHECK_EVERY === 0) ctx.check();
      out.push(MODHEX.charAt(byte >> 4) + MODHEX.charAt(byte & 0xf));
      if (i !== last) {
        out.push(delimiter);
        if (perLine && (i + 1) % perLine === 0) out.push('\n');
      }
    });
    return out.join('');
  },
});

const fromModhex = defineOp({
  id: 'from-modhex',
  name: 'From Modhex',
  category: 'Encoding',
  description:
    'Read Modhex digit pairs, in either case, ignoring whitespace. `auto` also drops ' +
    'every other character; any other choice removes only that delimiter.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: 'fj hk db', args: {}, output: 'Hi!' }],
  args: [enumArg('delimiter', ['auto', ...Object.keys(MODHEX_DELIMITERS)])],
  run(text, args, ctx) {
    ctx.check();
    const delimiter = args.text('delimiter');
    let chars = stripSpace(asciiLower(text));
    if (delimiter === 'auto') {
      chars = chars.replace(NOT_MODHEX, '');
    } else if (MODHEX_DELIMITERS[delimiter]) {
      chars = chars.split(MODHEX_DELIMITERS[delimiter]).join('');
    }
    const bad = chars.match(NOT_MODHEX);
    if (bad !== null) throw decodeError(`${pyRepr(bad[0])} is not a Modhex digit.`);
    if (chars.length % 2) throw decodeError('The input has an odd number of Modhex digits.');
    const out = new Uint8Array(chars.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = (MODHEX.indexOf(chars.charAt(2 * i)) << 4) | MODHEX.indexOf(chars.charAt(2 * i + 1));
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// Byte order

const swapEndianness = defineOp({
  id: 'swap-endianness',
  name: 'Swap Endianness',
  category: 'Encoding',
  description:
    'Reverse the byte order inside each word of `word_length` bytes. With `hex`, the ' +
    'input is hex text (as From Hex reads it with `auto`) and the output is space-separated ' +
    'lower-case hex. With `pad`, a short final word is filled with zero bytes first.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [{ input: '0a0b0c0d 01', args: {}, output: '0d 0c 0b 0a 00 00 00 01' }],
  args: [enumArg('format', ['hex', 'raw']), intArg('word_length', 4, 1), boolArg('pad', true)],
  run(data, args, ctx) {
    ctx.check();
    const hexText = args.text('format') === 'hex';
    const raw = hexText
      ? parseHexAuto(Array.from(data, (b) => String.fromCharCode(b)).join(''))
      : data;
    const size = args.int('word_length');
    const pad = args.flag('pad');
    const out: number[] = [];
    for (let start = 0; start < raw.length; start += size) {
      if (start % (CHECK_EVERY * 16) === 0) ctx.check();
      const word = Array.from(raw.subarray(start, start + size));
      while (pad && word.length < size) word.push(0);
      out.push(...word.reverse());
    }
    if (hexText) {
      const text = out.map((b) => b.toString(16).padStart(2, '0')).join(' ');
      return new TextEncoder().encode(text);
    }
    return Uint8Array.from(out);
  },
});

export const RADIX_OPS: readonly Operation[] = [
  toBase,
  fromBase,
  toCharcode,
  fromCharcode,
  toModhex,
  fromModhex,
  swapEndianness,
];
