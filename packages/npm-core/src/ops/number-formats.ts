// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Number and key formats: IEEE 754 floats, Bech32, BCD, text as an integer and PEM
 * (PRD §3.8, 1.1).
 *
 * Behaviour follows CyberChef v11.5.0 (Apache-2.0), with the deviations listed in
 * spec/README.md: input is validated strictly rather than read as far as it makes sense.
 */

import { UniChefError } from '../errors.js';
import {
  boolArg,
  defineOp,
  enumArg,
  intArg,
  pyRepr,
  stringArg,
  type Args,
  type Operation,
} from './types.js';

const CHECK_EVERY = 4096;
const ASCII_SPACE = /[ \t\n\v\f\r]+/g;
const ASCII_TRIM = /^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/g;
const INTEGER = /^[+-]?[0-9]+$/;
const HEX = /^[0-9A-Fa-f]*$/;
const LATIN1_MAX = 0xff;

const decodeError = (message: string): UniChefError => new UniChefError('E_DECODE', message);

function toHex(bytes: Iterable<number>): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function latin1(bytes: Iterable<number>): string {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

// ---------------------------------------------------------------------------
// IEEE 754 floats

const DELIMITERS: Record<string, string> = {
  space: ' ',
  comma: ',',
  semicolon: ';',
  colon: ':',
  newline: '\n',
  crlf: '\r\n',
};
const FLOAT_ARGS = [
  enumArg('endianness', ['big', 'little']),
  enumArg('size', ['float', 'double']),
  enumArg('delimiter', Object.keys(DELIMITERS)),
];
const FLOAT = /^(?:[+-]?(?:(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|Infinity)|NaN)$/;
const NAN_BYTES = { 4: [0x7f, 0xc0, 0, 0], 8: [0x7f, 0xf8, 0, 0, 0, 0, 0, 0] } as const;

const floatSize = (args: Args): 4 | 8 => (args.text('size') === 'float' ? 4 : 8);

export const toFloat = defineOp({
  id: 'to-float',
  name: 'To Float',
  category: 'Encoding',
  description:
    'Read the bytes as IEEE 754 numbers, 4 bytes each for `float` or 8 for `double`, and ' +
    'write them in decimal joined by `delimiter`. Each number is written with the fewest ' +
    'digits that give the same value back.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'ABCD', args: {}, output: '12.141422271728516' }],
  args: FLOAT_ARGS,
  run(data, args, ctx) {
    const size = floatSize(args);
    const little = args.text('endianness') === 'little';
    if (data.length % size !== 0) {
      throw decodeError(`The input length is not a multiple of ${String(size)} bytes.`);
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const out: string[] = [];
    for (let i = 0; i < data.length; i += size) {
      if ((i / size) % CHECK_EVERY === 0) ctx.check();
      const value = size === 4 ? view.getFloat32(i, little) : view.getFloat64(i, little);
      // Number::toString, but keep the sign of a negative zero.
      out.push(Object.is(value, -0) ? '-0' : String(value));
    }
    return out.join(DELIMITERS[args.text('delimiter')] ?? ' ');
  },
});

export const fromFloat = defineOp({
  id: 'from-float',
  name: 'From Float',
  category: 'Encoding',
  description:
    'Read decimal numbers separated by `delimiter` and write each as an IEEE 754 `float` ' +
    '(4 bytes) or `double` (8 bytes), rounded to the nearest value. `Infinity`, `-Infinity` ' +
    'and `NaN` are accepted.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: '12.141422271728516', args: {}, output: 'ABCD' }],
  args: FLOAT_ARGS,
  run(text, args, ctx) {
    if (text === '') return new Uint8Array(0);
    const size = floatSize(args);
    const little = args.text('endianness') === 'little';
    const pieces = text.split(DELIMITERS[args.text('delimiter')] ?? ' ');
    const out = new Uint8Array(pieces.length * size);
    const view = new DataView(out.buffer);
    pieces.forEach((piece, i) => {
      if (i % CHECK_EVERY === 0) ctx.check();
      const token = piece.replace(ASCII_TRIM, '');
      if (!FLOAT.test(token)) throw decodeError(`${pyRepr(token)} is not a number.`);
      const value = Number(token);
      if (Number.isNaN(value)) {
        const nan = NAN_BYTES[size];
        out.set(little ? [...nan].reverse() : nan, i * size);
      } else if (size === 4) {
        view.setFloat32(i * size, value, little);
      } else {
        view.setFloat64(i * size, value, little);
      }
    });
    return out;
  },
});

// ---------------------------------------------------------------------------
// Bech32 (BIP-173) and Bech32m (BIP-350)

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const CHECKSUM: Record<string, number> = { bech32: 1, bech32m: 0x2bc830a3 };
const ENCODING_NAME: Record<string, string> = { bech32: 'Bech32', bech32m: 'Bech32m' };
const SEGWIT_HRPS = ['bc', 'tb', 'ltc', 'tltc', 'bcrt'];
const BECH32_MAX = 90;
const CHECKSUM_LEN = 6;
const NOT_HRP = /[^\x21-\x7e]/;
const NOT_ASCII = /[\u0080-\uffff]/;
const WITNESS_MAX_VERSION = 16;

function polymod(values: readonly number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    GENERATOR.forEach((g, i) => {
      if ((top >> i) & 1) chk ^= g;
    });
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const codes = Array.from(hrp, (c) => c.charCodeAt(0));
  return [...codes.map((c) => c >> 5), 0, ...codes.map((c) => c & 31)];
}

function toWords(data: Iterable<number>): number[] {
  let value = 0;
  let bits = 0;
  const out: number[] = [];
  for (const b of data) {
    value = ((value << 8) | b) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out.push((value >> bits) & 31);
    }
  }
  if (bits > 0) out.push((value << (5 - bits)) & 31);
  return out;
}

function fromWords(words: readonly number[]): number[] {
  let value = 0;
  let bits = 0;
  const out: number[] = [];
  for (const w of words) {
    value = ((value << 5) | w) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 255);
    }
  }
  if (bits >= 5) throw decodeError('The data has a whole unused character at the end.');
  if (((value << (8 - bits)) & 255) !== 0) throw decodeError('The padding bits are not zero.');
  return out;
}

function validProgram(version: number, length: number): boolean {
  if (version === 0) return length === 20 || length === 32;
  return length >= 2 && length <= 40;
}

export const toBech32 = defineOp({
  id: 'to-bech32',
  name: 'To Bech32',
  category: 'Encoding',
  description:
    'Encode bytes as Bech32 or Bech32m: the human-readable part `hrp`, a `1`, the data in ' +
    'a 32-character alphabet and a six-character checksum. `segwit` mode writes a Bitcoin ' +
    'SegWit address from a witness program and `witness_version`.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Hi', args: { hrp: 'test' }, output: 'test1fp5sjj6w55' }],
  args: [
    stringArg('hrp', 'bc'),
    enumArg('encoding', Object.keys(CHECKSUM)),
    enumArg('mode', ['generic', 'segwit']),
    intArg('witness_version', 0, 0, WITNESS_MAX_VERSION),
  ],
  run(data, args, ctx) {
    ctx.check();
    const given = args.text('hrp');
    if (given === '' || NOT_HRP.test(given)) {
      throw new UniChefError(
        'E_ARG_INVALID',
        'hrp must be one or more printable ASCII characters.',
      );
    }
    const hrp = given.toLowerCase();
    const tooLong = decodeError(`The result is longer than ${String(BECH32_MAX)} characters.`);
    if (data.length > BECH32_MAX) throw tooLong;
    let words: number[];
    if (args.text('mode') === 'segwit') {
      const version = args.int('witness_version');
      if (data.length < 2 || data.length > 40) {
        throw decodeError('A witness program is 2 to 40 bytes long.');
      }
      if (!validProgram(version, data.length)) {
        throw decodeError('A version 0 witness program is 20 or 32 bytes long.');
      }
      words = [version, ...toWords(data)];
    } else {
      words = toWords(data);
    }
    const constant = CHECKSUM[args.text('encoding')] ?? 1;
    const mod = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ constant;
    for (let i = 0; i < CHECKSUM_LEN; i++) words.push((mod >> (5 * (5 - i))) & 31);
    const result = hrp + '1' + words.map((w) => CHARSET.charAt(w)).join('');
    if (result.length > BECH32_MAX) throw tooLong;
    return result;
  },
});

function bech32Split(given: string): { hrp: string; data: number[] } {
  if (Array.from(given).length > BECH32_MAX) {
    throw decodeError(`A Bech32 string is at most ${String(BECH32_MAX)} characters long.`);
  }
  if (NOT_ASCII.test(given)) throw decodeError('A Bech32 string is ASCII only.');
  if (given !== given.toLowerCase() && given !== given.toUpperCase()) {
    throw decodeError('A Bech32 string is all lower case or all upper case.');
  }
  const text = given.toLowerCase();
  const sep = text.lastIndexOf('1');
  if (sep < 1) throw decodeError("There is no human-readable part before a '1'.");
  if (sep + 1 + CHECKSUM_LEN > text.length) {
    throw decodeError('The data part is shorter than the six-character checksum.');
  }
  const hrp = text.slice(0, sep);
  if (NOT_HRP.test(hrp)) {
    throw decodeError('The human-readable part has a character that is not printable ASCII.');
  }
  const data = Array.from(text.slice(sep + 1), (c) => CHARSET.indexOf(c));
  if (data.some((d) => d < 0)) {
    throw decodeError('The data part has a character outside the Bech32 alphabet.');
  }
  return { hrp, data };
}

export const fromBech32 = defineOp({
  id: 'from-bech32',
  name: 'From Bech32',
  category: 'Encoding',
  description:
    'Check the checksum of a Bech32 or Bech32m string and write its data as hex. A SegWit ' +
    'address gives the witness version byte and then the program. Other formats: `raw` (one ' +
    'character per byte), `script-pubkey`, `hrp-hex` and `json`.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'test1fp5sjj6w55', args: {}, output: '4869' }],
  args: [
    enumArg('encoding', ['auto', ...Object.keys(CHECKSUM)]),
    enumArg('format', ['hex', 'raw', 'script-pubkey', 'hrp-hex', 'json']),
  ],
  run(input, args, ctx) {
    ctx.check();
    const text = input.replace(ASCII_TRIM, '');
    if (text === '') return '';
    const { hrp, data } = bech32Split(text);
    const wanted = args.text('encoding');
    const mod = polymod([...hrpExpand(hrp), ...data]);
    const encoding = Object.keys(CHECKSUM).find(
      (name) => CHECKSUM[name] === mod && (wanted === 'auto' || wanted === name),
    );
    if (encoding === undefined) throw decodeError('The checksum is wrong.');
    const words = data.slice(0, -CHECKSUM_LEN);
    let version: number | null = null;
    let payload: number[] | null = null;
    const first = words[0];
    if (SEGWIT_HRPS.includes(hrp) && first !== undefined && first <= WITNESS_MAX_VERSION) {
      let program: number[] | null;
      try {
        program = fromWords(words.slice(1));
      } catch (e) {
        if (!(e instanceof UniChefError)) throw e;
        program = null;
      }
      if (program !== null && validProgram(first, program.length)) {
        version = first;
        payload = [version, ...program];
      }
    }
    payload ??= fromWords(words);
    const format = args.text('format');
    if (format === 'raw') return latin1(payload);
    if (format === 'script-pubkey' && version !== null) {
      const opcode = version === 0 ? 0 : 0x50 + version;
      return toHex([opcode, payload.length - 1, ...payload.slice(1)]);
    }
    if (format === 'hrp-hex') return `${hrp}: ${toHex(payload)}`;
    if (format === 'json') {
      const doc = { hrp, encoding: ENCODING_NAME[encoding], data: toHex(payload) };
      return JSON.stringify(doc, null, 2);
    }
    return toHex(payload);
  },
});

// ---------------------------------------------------------------------------
// Binary-coded decimal

const BCD: Record<string, readonly number[]> = {
  '8421': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  '7421': [0, 1, 2, 3, 4, 5, 6, 8, 9, 10],
  '4221': [0, 1, 4, 5, 8, 9, 12, 13, 14, 15],
  '2421': [0, 1, 2, 3, 4, 11, 12, 13, 14, 15],
  '84-2-1': [0, 7, 6, 5, 4, 11, 10, 9, 8, 15],
  'excess-3': [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  'ibm-8421': [10, 1, 2, 3, 4, 5, 6, 7, 8, 9],
};
// Insertion order: integer-like keys would sort first in Object.keys.
const BCD_SCHEMES = ['8421', '7421', '4221', '2421', '84-2-1', 'excess-3', 'ibm-8421'];
const BCD_ARGS = [
  enumArg('scheme', BCD_SCHEMES),
  boolArg('packed', true),
  boolArg('signed'),
  enumArg('format', ['nibbles', 'bytes', 'raw']),
];
const PLUS = 12;
const MINUS = 13;
const MINUS_ALT = 11;
const binary = (n: number, width: number): string => n.toString(2).padStart(width, '0');

export const toBcd = defineOp({
  id: 'to-bcd',
  name: 'To BCD',
  category: 'Encoding',
  description:
    'Write a decimal integer as binary-coded decimal: four bits per digit in the chosen ' +
    '`scheme`. `packed` puts two digits in a byte, `signed` adds a sign nibble (1100 plus, ' +
    '1101 minus) at the end, and `format` shows nibbles, bytes or one character per byte.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '1234', args: {}, output: '0001 0010 0011 0100' }],
  args: BCD_ARGS,
  run(text, args, ctx) {
    ctx.check();
    const token = text.replace(ASCII_TRIM, '');
    if (token === '') return '';
    if (!INTEGER.test(token)) throw decodeError('The input is not a decimal integer.');
    const digits = token.replace(/^[+-]?0*/, '') || '0';
    const negative = token.startsWith('-') && digits !== '0';
    const table = BCD[args.text('scheme')] ?? [];
    const packed = args.flag('packed');
    let nibbles = Array.from(digits, (d) => table[d.charCodeAt(0) - 0x30] ?? 0);
    if (args.flag('signed')) {
      if (packed && digits.length % 2 === 0) nibbles.unshift(table[0] ?? 0);
      nibbles.push(negative ? MINUS : PLUS);
    }
    let data: number[];
    if (packed) {
      data = [];
      for (let i = 0; i < nibbles.length; i += 2) {
        data.push(((nibbles[i] ?? 0) << 4) | (nibbles[i + 1] ?? 0));
      }
    } else {
      data = nibbles;
      nibbles = nibbles.flatMap((n) => [0, n]);
    }
    const format = args.text('format');
    if (format === 'nibbles') return nibbles.map((n) => binary(n, 4)).join(' ');
    if (format === 'bytes') return data.map((b) => binary(b, 8)).join(' ');
    return latin1(data);
  },
});

export const fromBcd = defineOp({
  id: 'from-bcd',
  name: 'From BCD',
  category: 'Encoding',
  description:
    'Read binary-coded decimal back into a decimal integer. The input is binary digits ' +
    '(`nibbles` or `bytes`, spaces ignored) or one character per byte (`raw`). With `signed`, ' +
    'the last nibble is the sign: 1101 or 1011 is minus.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '0001 0010 0011 0100', args: {}, output: '1234' }],
  args: BCD_ARGS,
  run(text, args, ctx) {
    ctx.check();
    let nibbles: number[] = [];
    if (args.text('format') === 'raw') {
      for (const ch of text) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp > LATIN1_MAX) throw decodeError('Raw input can only hold characters up to U+00FF.');
        nibbles.push(cp >> 4, cp & 15);
      }
    } else {
      const bits = text.replace(ASCII_SPACE, '');
      if (bits.length % 4 !== 0 || /[^01]/.test(bits)) {
        throw decodeError('The input is not groups of four binary digits.');
      }
      for (let i = 0; i < bits.length; i += 4) nibbles.push(parseInt(bits.slice(i, i + 4), 2));
    }
    if (nibbles.length === 0) return '';
    if (!args.flag('packed')) nibbles = nibbles.filter((_, i) => i % 2 === 1);
    let sign = '';
    if (args.flag('signed') && nibbles.length > 0) {
      const last = nibbles.pop();
      if (last === MINUS || last === MINUS_ALT) sign = '-';
    }
    if (nibbles.length === 0) throw decodeError('The input has no digits.');
    const table = BCD[args.text('scheme')] ?? [];
    let digits = '';
    for (const n of nibbles) {
      const digit = table.indexOf(n);
      if (digit < 0) throw decodeError(`${binary(n, 4)} is not a digit in this scheme.`);
      digits += String(digit);
    }
    digits = digits.replace(/^0+/, '');
    return digits === '' ? '0' : sign + digits;
  },
});

// ---------------------------------------------------------------------------
// Text as an integer

const HEX_INTEGER = /^0[xX][0-9A-Fa-f]+$/;
const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;
const QUOTES = '"\'';
const MAX_INTEGER_BYTES = 1024;
const MAX_DECIMAL_DIGITS = 2467; // 256 ** 1024 has 2467 digits

function textInteger(given: string): bigint {
  const tooLarge = decodeError(`The number is larger than ${String(MAX_INTEGER_BYTES)} bytes.`);
  if (given === '') return 0n;
  if (HEX_INTEGER.test(given)) {
    const digits = given.slice(2).replace(/^0+/, '');
    if (digits.length > MAX_INTEGER_BYTES * 2) throw tooLarge;
    return BigInt('0x' + (digits || '0'));
  }
  if (INTEGER.test(given)) {
    const digits = given.replace(/^[+-]?0*/, '');
    if (digits.length > MAX_DECIMAL_DIGITS) throw tooLarge;
    const value = BigInt(digits || '0');
    if (value >> BigInt(MAX_INTEGER_BYTES * 8) !== 0n) throw tooLarge;
    return given.startsWith('-') ? -value : value;
  }
  let token = given;
  const quoted =
    token.length > 1 && QUOTES.includes(token.charAt(0)) && QUOTES.includes(token.slice(-1));
  if (quoted && !LINE_TERMINATOR.test(token)) token = token.slice(1, -1);
  if (Array.from(token).length > MAX_INTEGER_BYTES) throw tooLarge;
  let value = 0n;
  for (const ch of token) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > LATIN1_MAX) throw decodeError('Text can only hold characters up to U+00FF.');
    value = (value << 8n) | BigInt(cp);
  }
  return value;
}

export const textIntegerOp = defineOp({
  id: 'text-integer',
  name: 'Text-Integer Conversion',
  category: 'Encoding',
  description:
    'Convert between text and the big-endian integer its bytes spell: `ABC` is 0x414243 is ' +
    '4276803. Input that is all digits is read as decimal, input starting with 0x as hex and ' +
    'anything else, quoted or not, as text. `output` picks the form to write.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'ABC', args: { output: 'decimal' }, output: '4276803' }],
  args: [enumArg('output', ['string', 'decimal', 'hex'])],
  run(text, args, ctx) {
    ctx.check();
    const value = textInteger(text.trim());
    const output = args.text('output');
    if (output === 'decimal') return value.toString();
    if (output === 'hex') {
      return value < 0n ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
    }
    if (value < 0n) throw decodeError('A negative number has no text form.');
    let hex = value.toString(16);
    if (hex.length % 2 === 1) hex = '0' + hex;
    let out = '';
    if (value !== 0n) {
      for (let i = 0; i < hex.length; i += 2) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// PEM

const PEM_BEGIN = /-----BEGIN ([A-Z][A-Z ]+[A-Z])-----/g;
const NOT_BASE64 = /[^A-Za-z0-9+/]+/g;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const PEM_LINE = 64;

function base64Decode(body: string): number[] {
  const out: number[] = [];
  let value = 0;
  let bits = 0;
  for (const ch of body) {
    value = ((value << 6) | BASE64.indexOf(ch)) & 0xfff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 255);
    }
  }
  return out;
}

function base64Encode(data: readonly number[]): string {
  let out = '';
  for (let i = 0; i < data.length; i += 3) {
    const n = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
    out += BASE64.charAt(n >> 18) + BASE64.charAt((n >> 12) & 63);
    out += i + 1 < data.length ? BASE64.charAt((n >> 6) & 63) : '=';
    out += i + 2 < data.length ? BASE64.charAt(n & 63) : '=';
  }
  return out;
}

export const pemToHex = defineOp({
  id: 'pem-to-hex',
  name: 'PEM to Hex',
  category: 'Encoding',
  description:
    'Find each PEM block (BEGIN and END lines with the same label), decode its Base64 body ' +
    'and write the bytes as hex, one line per block.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '-----BEGIN DATA-----\nSGk=\n-----END DATA-----', args: {}, output: '4869' }],
  args: [],
  run(text, _args, ctx) {
    const out: string[] = [];
    for (const m of text.matchAll(PEM_BEGIN)) {
      ctx.check();
      const footer = `-----END ${m[1] ?? ''}-----`;
      const start = m.index + m[0].length;
      const end = text.indexOf(footer, start);
      if (end < 0) throw decodeError(`${footer} was not found.`);
      const body = text.slice(start, end).replace(NOT_BASE64, '');
      if (body.length % 4 === 1) throw decodeError('A Base64 body has one character too many.');
      out.push(toHex(base64Decode(body)));
    }
    return out.join('\n');
  },
});

export const hexToPem = defineOp({
  id: 'hex-to-pem',
  name: 'Hex to PEM',
  category: 'Encoding',
  description:
    'Write hex bytes (usually DER) as a PEM block: a BEGIN line with the `header` label, ' +
    'the bytes as Base64 in lines of 64 characters, and an END line. Lines end in CR LF.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    {
      input: '4869',
      args: { header: 'DATA' },
      output: '-----BEGIN DATA-----\r\nSGk=\r\n-----END DATA-----\r\n',
    },
  ],
  args: [stringArg('header', 'CERTIFICATE')],
  run(text, args, ctx) {
    ctx.check();
    const digits = text.replace(ASCII_SPACE, '');
    if (digits.length % 2 !== 0 || !HEX.test(digits)) {
      throw decodeError('The input is not pairs of hex digits.');
    }
    const data: number[] = [];
    for (let i = 0; i < digits.length; i += 2) data.push(parseInt(digits.slice(i, i + 2), 16));
    const body = base64Encode(data);
    const lines: string[] = [];
    for (let i = 0; i < body.length; i += PEM_LINE) lines.push(body.slice(i, i + PEM_LINE));
    const header = args.text('header');
    return `-----BEGIN ${header}-----\r\n${lines.join('\r\n')}\r\n-----END ${header}-----\r\n`;
  },
});

export const NUMBER_FORMAT_OPS: readonly Operation[] = [
  toFloat,
  fromFloat,
  toBech32,
  fromBech32,
  toBcd,
  fromBcd,
  textIntegerOp,
  pemToHex,
  hexToPem,
];
