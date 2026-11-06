// SPDX-License-Identifier: GPL-3.0-or-later
/** Strict JSON parse and compact serialisation (PRD §3.2 rule 5), matching the Python core. */

import { UniChefError, type WarningCode } from '../errors.js';
import type { JsonObject, JsonValue } from './types.js';

export type WarnFn = (code: WarningCode, detail: string) => void;

/** JSON nesting deeper than this fails with E_LIMIT, as Python's recursion limit does. */
export const MAX_JSON_DEPTH = 900;
/** Python refuses to convert integer strings longer than this. */
const MAX_INT_DIGITS = 4300;

/** Format a number as ECMAScript `Number.prototype.toString` does. */
export function formatFloat(x: number): string {
  return String(x);
}

/** Quote a string as JSON. Lone surrogates and controls are escaped as `\uxxxx`. */
export function jsonString(s: string): string {
  return JSON.stringify(s);
}

/** Serialise compactly, in insertion order. Non-finite floats become `null`. */
export function jsonDumps(value: JsonValue): string {
  const parts: string[] = [];
  const emit = (v: JsonValue): void => {
    if (v === null) {
      parts.push('null');
    } else if (typeof v === 'boolean') {
      parts.push(v ? 'true' : 'false');
    } else if (typeof v === 'bigint') {
      parts.push(v.toString());
    } else if (typeof v === 'number') {
      parts.push(Number.isFinite(v) ? formatFloat(v) : 'null');
    } else if (typeof v === 'string') {
      parts.push(jsonString(v));
    } else if (Array.isArray(v)) {
      parts.push('[');
      v.forEach((item, i) => {
        if (i > 0) {
          parts.push(',');
        }
        emit(item);
      });
      parts.push(']');
    } else {
      parts.push('{');
      let first = true;
      for (const [key, item] of v) {
        if (!first) {
          parts.push(',');
        }
        first = false;
        parts.push(jsonString(key), ':');
        emit(item);
      }
      parts.push('}');
    }
  };
  emit(value);
  return parts.join('');
}

class Parser {
  private pos = 0;

  constructor(
    private readonly text: string,
    private readonly warn: WarnFn | undefined,
  ) {}

  parse(): JsonValue {
    this.skipWs();
    const value = this.value(0);
    this.skipWs();
    if (this.pos !== this.text.length) {
      throw invalid();
    }
    return value;
  }

  private skipWs(): void {
    const t = this.text;
    while (this.pos < t.length) {
      const c = t.charCodeAt(this.pos);
      if (c !== 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) {
        return;
      }
      this.pos += 1;
    }
  }

  private value(depth: number): JsonValue {
    const t = this.text;
    const c = t[this.pos];
    switch (c) {
      case '{':
        return this.object(depth + 1);
      case '[':
        return this.array(depth + 1);
      case '"':
        return this.string();
      case 't':
        return this.literal('true', true);
      case 'f':
        return this.literal('false', false);
      case 'n':
        return this.literal('null', null);
      default:
        return this.number();
    }
  }

  private literal<T extends JsonValue>(word: string, value: T): T {
    if (!this.text.startsWith(word, this.pos)) {
      throw invalid();
    }
    this.pos += word.length;
    return value;
  }

  private number(): number | bigint {
    NUMBER.lastIndex = this.pos;
    const m = NUMBER.exec(this.text);
    if (m === null) {
      throw invalid();
    }
    const [whole, intPart = '', frac, exp] = m;
    this.pos += whole.length;
    if (frac === undefined && exp === undefined) {
      if (intPart.replace('-', '').length > MAX_INT_DIGITS) {
        throw invalid();
      }
      const big = BigInt(intPart);
      if (big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(big) + 0; // `+ 0` turns -0 into 0, as Python's int does
      }
      return big;
    }
    return Number(whole);
  }

  private string(): string {
    const t = this.text;
    this.pos += 1; // opening quote
    let out = '';
    let start = this.pos;
    for (;;) {
      if (this.pos >= t.length) {
        throw invalid();
      }
      const c = t.charCodeAt(this.pos);
      if (c === 0x22) {
        out += t.slice(start, this.pos);
        this.pos += 1;
        return out;
      }
      if (c < 0x20) {
        throw invalid();
      }
      if (c !== 0x5c) {
        this.pos += 1;
        continue;
      }
      out += t.slice(start, this.pos);
      const e = t[this.pos + 1];
      const simple = e === undefined ? undefined : ESCAPES[e];
      if (simple !== undefined) {
        out += simple;
        this.pos += 2;
      } else if (e === 'u') {
        const hex = t.slice(this.pos + 2, this.pos + 6);
        if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
          throw invalid();
        }
        // Surrogate halves are appended as UTF-16 units: a valid pair joins up by
        // itself, and a lone half is kept, as Python keeps it.
        out += String.fromCharCode(Number.parseInt(hex, 16));
        this.pos += 6;
      } else {
        throw invalid();
      }
      start = this.pos;
    }
  }

  private array(depth: number): JsonValue[] {
    if (depth > MAX_JSON_DEPTH) {
      throw tooDeep();
    }
    this.pos += 1;
    const out: JsonValue[] = [];
    this.skipWs();
    if (this.text[this.pos] === ']') {
      this.pos += 1;
      return out;
    }
    for (;;) {
      this.skipWs();
      out.push(this.value(depth));
      this.skipWs();
      const c = this.text[this.pos];
      this.pos += 1;
      if (c === ']') {
        return out;
      }
      if (c !== ',') {
        throw invalid();
      }
    }
  }

  private object(depth: number): JsonObject {
    if (depth > MAX_JSON_DEPTH) {
      throw tooDeep();
    }
    this.pos += 1;
    const out: JsonObject = new Map();
    this.skipWs();
    if (this.text[this.pos] === '}') {
      this.pos += 1;
      return out;
    }
    for (;;) {
      this.skipWs();
      if (this.text[this.pos] !== '"') {
        throw invalid();
      }
      const key = this.string();
      this.skipWs();
      if (this.text[this.pos] !== ':') {
        throw invalid();
      }
      this.pos += 1;
      this.skipWs();
      const value = this.value(depth);
      if (out.has(key)) {
        this.warn?.('W_DUPLICATE_KEY', `Duplicate JSON key ${truncate(jsonString(key), 66)}.`);
        out.delete(key); // the last occurrence also takes the last position
      }
      out.set(key, value);
      this.skipWs();
      const c = this.text[this.pos];
      this.pos += 1;
      if (c === '}') {
        return out;
      }
      if (c !== ',') {
        throw invalid();
      }
    }
  }
}

const NUMBER = /(-?(?:0|[1-9][0-9]*))(\.[0-9]+)?([eE][-+]?[0-9]+)?/y;
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

function invalid(): UniChefError {
  return new UniChefError('E_INPUT_TYPE', 'The string is not valid JSON.');
}

function tooDeep(): UniChefError {
  return new UniChefError('E_LIMIT', 'The JSON value is nested too deeply.');
}

/** The first `n` code points of `s`. */
export function truncate(s: string, n: number): string {
  return Array.from(s).slice(0, n).join('');
}

/** Strict RFC 8259 parse. Duplicate keys: the last wins and a warning is raised. */
export function jsonLoads(text: string, warn?: WarnFn): JsonValue {
  return new Parser(text, warn).parse();
}

/** Convert a value from `JSON.parse` (plain objects) to a `JsonValue` (maps). */
export function fromPlain(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'bigint') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(fromPlain);
  }
  if (value instanceof Map) {
    return new Map([...(value as Map<string, unknown>)].map(([k, v]) => [k, fromPlain(v)]));
  }
  if (typeof value === 'object') {
    return new Map(Object.entries(value).map(([k, v]) => [k, fromPlain(v)]));
  }
  throw new TypeError(`not a JSON value: ${typeof value}`);
}

/** Convert a `JsonValue` to plain JS data. Integer-like keys may reorder; bigints stay. */
export function toPlain(value: JsonValue): unknown {
  if (Array.isArray(value)) {
    return value.map(toPlain);
  }
  if (value instanceof Map) {
    return Object.fromEntries([...value].map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}
