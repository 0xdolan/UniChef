// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Small codecs: Caret/M-decode, Rison, NetBIOS names, Citrix CTX1 and Unicode text
 * formatting (PRD §3.8, 1.1).
 *
 * Behaviour follows CyberChef v11.5.0 and rison.js 0.1.1 (Apache-2.0 and MIT), with the
 * deviations listed in spec/README.md: malformed input is an error instead of being read
 * as far as it makes sense.
 */

import { formatFloat, jsonDumps } from '../dish/json.js';
import type { JsonObject, JsonValue } from '../dish/types.js';
import { encode as utf8Encode, scrub } from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import {
  boolArg,
  defineOp,
  enumArg,
  intArg,
  pyRepr,
  type OpContext,
  type Operation,
} from './types.js';

const CHECK_EVERY = 4096;
const MAX_DEPTH = 256;
const NETBIOS_NAME = 16;
const NIBBLE = 15;
const MAX_INT_DIGITS = 4300;
const EDGE_SPACE = /^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/g;

const decodeError = (message: string): UniChefError => new UniChefError('E_DECODE', message);
const depthError = (): UniChefError =>
  new UniChefError('E_LIMIT', `The value is nested more than ${String(MAX_DEPTH)} deep.`);

// ---------------------------------------------------------------------------
// Caret/M-decode

/** `cat -v` notation: ^@..^_ and ^? for control bytes, M- for bytes with the high bit set. */
const CARET_M = /M-\^[@-_?]|M-[ -~]|\^[@-_?]/g;

function caretMByte(token: string): number {
  const high = token.startsWith('M-') ? 0x80 : 0;
  const tail = high ? token.slice(2) : token;
  if (tail.length === 2 && tail.startsWith('^')) {
    return high | (tail[1] === '?' ? 0x7f : tail.charCodeAt(1) - 0x40);
  }
  return high | tail.charCodeAt(0);
}

export const caretMDecode = defineOp({
  id: 'caret-m-decode',
  name: 'Caret/M-decode',
  category: 'Encoding',
  description:
    'Turn the caret and M- notation of `cat -v` back into bytes: `^@` to `^_` are 0x00 to ' +
    '0x1F, `^?` is 0x7F, and `M-` adds 0x80 to the character or caret code after it. Other ' +
    'text is kept as UTF-8.',
  inputType: 'string',
  outputType: 'bytes',
  examples: [{ input: 'M-bM-^@M-^] ^I!', args: {}, output: '” \t!' }],
  run(text, _args, ctx) {
    const out: number[] = [];
    let pos = 0;
    let i = 0;
    for (const m of text.matchAll(CARET_M)) {
      if (i++ % CHECK_EVERY === 0) ctx.check();
      out.push(...utf8Encode(text.slice(pos, m.index)), caretMByte(m[0]));
      pos = m.index + m[0].length;
    }
    out.push(...utf8Encode(text.slice(pos)));
    return Uint8Array.from(out);
  },
});

// ---------------------------------------------------------------------------
// Rison

const ID_CHARS = "[^\\- 0-9'!:(),*@$][^ '!:(),*@$]*";
const ID = new RegExp(`^${ID_CHARS}$`, 'u');
const ID_AT = new RegExp(ID_CHARS, 'uy');
const NUMBER_RUN = /[-0-9.eE]+/y;
const NUMBER = /^-?[0-9]+(\.[0-9]+)?([eE]-?[0-9]+)?$/;

function risonString(s: string): string {
  if (s === '') return "''";
  if (ID.test(s)) return s;
  return "'" + s.replace(/['!]/g, '!$&') + "'";
}

function rison(value: JsonValue, depth = 0): string {
  if (depth > MAX_DEPTH) throw depthError();
  if (value === null) return '!n';
  if (typeof value === 'boolean') return value ? '!t' : '!f';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return formatFloat(value).replace('+', '');
  if (typeof value === 'string') return risonString(value);
  if (Array.isArray(value)) return '!(' + value.map((v) => rison(v, depth + 1)).join(',') + ')';
  const keys = [...value.keys()].sort(); // UTF-16 order
  return (
    '(' +
    keys.map((k) => risonString(k) + ':' + rison(value.get(k) ?? null, depth + 1)).join(',') +
    ')'
  );
}

/**
 * rison.quote: encodeURIComponent, then give back , : @ $ / and space as +. A lone
 * surrogate becomes U+FFFD first, as in any string output.
 */
function uriQuote(s: string): string {
  return encodeURIComponent(scrub(s))
    .replace(/%2C/g, ',')
    .replace(/%3A/g, ':')
    .replace(/%40/g, '@')
    .replace(/%24/g, '$')
    .replace(/%2F/g, '/')
    .replace(/%20/g, '+');
}

export const toRison = defineOp({
  id: 'to-rison',
  name: 'To Rison',
  category: 'Data',
  description:
    'Write a JSON value as Rison, a compact form for URLs: objects as `(key:value)` with ' +
    'keys sorted, arrays as `!(...)`, `!t`, `!f` and `!n` for true, false and null, and ' +
    "strings quoted with `'` only when needed. `object` and `array` drop the outer brackets " +
    '(O-Rison and A-Rison), and `uri` also escapes the result for a URL.',
  inputType: 'json',
  outputType: 'string',
  args: [enumArg('mode', ['value', 'object', 'array', 'uri'])],
  examples: [{ input: '{"b":[1,true],"a":"x y"}', args: {}, output: "(a:'x y',b:!(1,!t))" }],
  run(value, args) {
    const mode = args.text('mode');
    const out = rison(value);
    if (mode === 'object') {
      if (!(value instanceof Map)) {
        throw new UniChefError('E_INPUT_TYPE', 'The `object` mode needs a JSON object.');
      }
      return out.slice(1, -1);
    }
    if (mode === 'array') {
      if (!Array.isArray(value)) {
        throw new UniChefError('E_INPUT_TYPE', 'The `array` mode needs a JSON array.');
      }
      return out.slice(2, -1);
    }
    return mode === 'uri' ? uriQuote(out) : out;
  },
});

const LITERALS = new Map<string, JsonValue>([
  ['t', true],
  ['f', false],
  ['n', null],
]);

class RisonParser {
  pos = 0;
  private steps = 0;

  constructor(
    readonly text: string,
    private readonly ctx: OpContext,
  ) {}

  fail(message: string): UniChefError {
    return decodeError(`${message} at position ${String(this.pos)}.`);
  }

  private next(): string {
    if (this.pos >= this.text.length) throw this.fail('Unexpected end of input');
    return this.text.charAt(this.pos++);
  }

  value(depth: number): JsonValue {
    this.steps += 1;
    if (this.steps % CHECK_EVERY === 0) this.ctx.check();
    if (depth > MAX_DEPTH) throw depthError();
    if (this.pos >= this.text.length) throw this.fail('Expected a value');
    const c = this.text.charAt(this.pos);
    if (c === '!') {
      this.pos += 1;
      const bang = this.next();
      if (bang === '(') return this.items(depth);
      const literal = LITERALS.get(bang);
      if (literal === undefined) {
        this.pos -= 1;
        throw this.fail(`Unknown literal !${bang}`);
      }
      return literal;
    }
    if (c === '(') {
      this.pos += 1;
      return this.object(depth);
    }
    if (c === "'") {
      this.pos += 1;
      return this.string();
    }
    if (c === '-' || (c >= '0' && c <= '9')) return this.number();
    ID_AT.lastIndex = this.pos;
    const m = ID_AT.exec(this.text);
    if (m === null) {
      throw this.fail(
        `Unexpected character ${pyRepr(String.fromCodePoint(this.text.codePointAt(this.pos) ?? 0))}`,
      );
    }
    this.pos += m[0].length;
    return m[0];
  }

  private items(depth: number): JsonValue[] {
    const out: JsonValue[] = [];
    while (this.peek() !== ')') {
      if (out.length) this.expect(',');
      out.push(this.value(depth + 1));
    }
    this.pos += 1;
    return out;
  }

  private object(depth: number): JsonObject {
    const out: JsonObject = new Map();
    while (this.peek() !== ')') {
      if (out.size) this.expect(',');
      const start = this.pos;
      const key = this.value(depth + 1);
      if (typeof key !== 'string') {
        this.pos = start;
        throw this.fail('An object key must be a string');
      }
      this.expect(':');
      const item = this.value(depth + 1);
      if (out.has(key)) {
        this.ctx.warn('W_DUPLICATE_KEY', `Duplicate Rison key ${jsonDumps(key).slice(0, 66)}.`);
        out.delete(key); // the last occurrence also takes the last position
      }
      out.set(key, item);
    }
    this.pos += 1;
    return out;
  }

  private peek(): string {
    if (this.pos >= this.text.length) throw this.fail('Missing )');
    return this.text.charAt(this.pos);
  }

  private expect(char: string): void {
    if (this.peek() !== char) throw this.fail(`Expected ${pyRepr(char)}`);
    this.pos += 1;
  }

  private string(): string {
    let out = '';
    for (;;) {
      if (this.pos >= this.text.length) throw this.fail("Missing closing '");
      let c = this.text.charAt(this.pos++);
      if (c === "'") return out;
      if (c === '!') {
        const escaped = this.text.charAt(this.pos);
        if (escaped !== '!' && escaped !== "'") {
          throw this.fail("A ! in a string must be followed by ! or '");
        }
        this.pos += 1;
        c = escaped;
      }
      out += c;
    }
  }

  private number(): JsonValue {
    NUMBER_RUN.lastIndex = this.pos;
    const token = NUMBER_RUN.exec(this.text)?.[0] ?? '';
    const parsed = NUMBER.exec(token);
    if (parsed === null) throw this.fail(`Invalid number ${pyRepr(token)}`);
    this.pos += token.length;
    if (parsed[1] === undefined && parsed[2] === undefined) {
      if (token.replace('-', '').length > MAX_INT_DIGITS) {
        throw this.fail('The number has too many digits');
      }
      const big = BigInt(token);
      if (big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(big) + 0; // `+ 0` turns -0 into 0, as Python's int does
      }
      return big;
    }
    const n = Number(token);
    if (!Number.isFinite(n)) throw this.fail(`The number ${token} is too large`);
    return n;
  }
}

export const fromRison = defineOp({
  id: 'from-rison',
  name: 'From Rison',
  category: 'Data',
  description:
    'Read Rison and write it as JSON. `object` and `array` read O-Rison and A-Rison, where ' +
    'the outer brackets are left out. Whitespace is not allowed between tokens.',
  inputType: 'string',
  outputType: 'json',
  args: [enumArg('mode', ['value', 'object', 'array'])],
  examples: [{ input: "(a:'x y',b:!(1,!t))", args: {}, output: '{"a":"x y","b":[1,true]}' }],
  run(text, args, ctx) {
    const mode = args.text('mode');
    const source = mode === 'object' ? `(${text})` : mode === 'array' ? `!(${text})` : text;
    const parser = new RisonParser(source, ctx);
    const value = parser.value(0);
    if (parser.pos !== source.length) throw parser.fail('Unexpected text after the value');
    return value;
  },
});

// ---------------------------------------------------------------------------
// NetBIOS names (RFC 1001 first-level encoding)

const OFFSET = intArg('offset', 65, 0, 240);

export const encodeNetbiosName = defineOp({
  id: 'encode-netbios-name',
  name: 'Encode NetBIOS Name',
  category: 'Encoding',
  description:
    'Pad the name with spaces to 16 bytes and write each byte as two, its high and low ' +
    'nibble each added to `offset` (65, `A`, by RFC 1001). The name may be at most 16 ' +
    'bytes.',
  inputType: 'bytes',
  outputType: 'bytes',
  args: [OFFSET],
  examples: [{ input: 'UNICHEF', args: {}, output: 'FFEOEJEDEIEFEGCACACACACACACACACA' }],
  run(data, args) {
    if (data.length > NETBIOS_NAME) {
      throw decodeError(
        `A NetBIOS name is at most 16 bytes; the input has ${String(data.length)}.`,
      );
    }
    const offset = args.int('offset');
    const out = new Uint8Array(2 * NETBIOS_NAME);
    for (let i = 0; i < NETBIOS_NAME; i++) {
      const b = data[i] ?? 0x20;
      out[2 * i] = (b >> 4) + offset;
      out[2 * i + 1] = (b & 0xf) + offset;
    }
    return out;
  },
});

export const decodeNetbiosName = defineOp({
  id: 'decode-netbios-name',
  name: 'Decode NetBIOS Name',
  category: 'Encoding',
  description:
    'Read pairs of bytes, each `offset` plus a nibble, as one byte each, and remove the ' +
    'trailing spaces. The input may be at most 32 bytes, in pairs.',
  inputType: 'bytes',
  outputType: 'bytes',
  args: [OFFSET],
  examples: [{ input: 'FFEOEJEDEIEFEGCACACACACACACACACA', args: {}, output: 'UNICHEF' }],
  run(data, args) {
    if (data.length > 2 * NETBIOS_NAME || data.length % 2) {
      throw decodeError('An encoded NetBIOS name is an even number of bytes, at most 32.');
    }
    const offset = args.int('offset');
    const nibbles = Array.from(data, (b) => b - offset);
    if (nibbles.some((n) => n < 0 || n > NIBBLE)) {
      throw decodeError(
        `Every byte must be between ${String(offset)} and ${String(offset + NIBBLE)}.`,
      );
    }
    const out: number[] = [];
    for (let i = 0; i < nibbles.length; i += 2) {
      out.push(((nibbles[i] ?? 0) << 4) | (nibbles[i + 1] ?? 0));
    }
    while (out.at(-1) === 0x20) out.pop();
    return Uint8Array.from(out);
  },
});

// ---------------------------------------------------------------------------
// Citrix CTX1

export const citrixCtx1Encode = defineOp({
  id: 'citrix-ctx1-encode',
  name: 'Citrix CTX1 Encode',
  category: 'Encoding',
  description:
    'Obscure a password the way Citrix CTX1 does: take its UTF-16LE bytes, XOR each with ' +
    '0xA5 and the previous result, and write each result as two letters from `A` to `P`. ' +
    'This is not encryption.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'pass', args: {}, output: 'NFHALEBBMHGCLEBB' }],
  run(text, _args, ctx) {
    const out: string[] = [];
    let previous = 0;
    for (let i = 0; i < text.length; i++) {
      if (i % CHECK_EVERY === 0) ctx.check();
      const unit = text.charCodeAt(i);
      for (const b of [unit & 0xff, unit >> 8]) {
        previous = b ^ 0xa5 ^ previous;
        out.push(String.fromCharCode(0x41 + (previous >> 4), 0x41 + (previous & 0xf)));
      }
    }
    return out.join('');
  },
});

const CTX1 = /^(?:[A-P]{4})*$/;

export const citrixCtx1Decode = defineOp({
  id: 'citrix-ctx1-decode',
  name: 'Citrix CTX1 Decode',
  category: 'Encoding',
  description:
    'Reverse Citrix CTX1: read pairs of letters from `A` to `P` as bytes, XOR each with ' +
    '0xA5 and the byte before it, and read the result as UTF-16LE. ASCII whitespace around ' +
    'the input is ignored.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'NFHALEBBMHGCLEBB', args: {}, output: 'pass' }],
  run(text, _args, ctx) {
    const letters = text.replace(EDGE_SPACE, '');
    if (!CTX1.test(letters)) {
      throw decodeError('CTX1 text is letters A to P, a multiple of 4 long.');
    }
    const bytes: number[] = [];
    let previous = 0;
    for (let i = 0; i < letters.length; i += 2) {
      if (i % CHECK_EVERY === 0) ctx.check();
      const c = ((letters.charCodeAt(i) - 0x41) << 4) | (letters.charCodeAt(i + 1) - 0x41);
      bytes.push(c ^ 0xa5 ^ previous);
      previous = c;
    }
    const units: number[] = [];
    for (let i = 0; i < bytes.length; i += 2)
      units.push((bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8));
    const out = String.fromCharCode(...units);
    if (scrub(out) !== out) throw decodeError('The decoded bytes are not valid UTF-16LE.');
    return out;
  },
});

// ---------------------------------------------------------------------------
// Unicode text format

export const unicodeTextFormat = defineOp({
  id: 'unicode-text-format',
  name: 'Unicode Text Format',
  category: 'Text',
  description:
    'Draw a line through or under text by adding a combining mark after every character ' +
    'except line breaks: U+0336 for `strikethrough`, then U+0332 for `underline`.',
  inputType: 'string',
  outputType: 'string',
  args: [boolArg('underline'), boolArg('strikethrough')],
  examples: [{ input: 'abc', args: { underline: true }, output: 'a̲b̲c̲' }],
  run(text, args) {
    const marks = (args.flag('strikethrough') ? '̶' : '') + (args.flag('underline') ? '̲' : '');
    if (marks === '') return text;
    let out = '';
    for (const c of text) out += c === '\n' || c === '\r' ? c : c + marks;
    return out;
  },
});

export const MISC_CODEC_OPS: readonly Operation[] = [
  caretMDecode,
  toRison,
  fromRison,
  encodeNetbiosName,
  decodeNetbiosName,
  citrixCtx1Encode,
  citrixCtx1Decode,
  unicodeTextFormat,
];
