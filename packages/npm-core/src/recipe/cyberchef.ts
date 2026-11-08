// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Import a CyberChef recipe (JSON or "chef" format) as a UniChef recipe (PRD §5.3, FR-009).
 * A port of the Python core's `unichef.cli.cyberchef`; both pass spec/cyberchef-vectors.json.
 * The translation table is a copy of spec/cyberchef-map.json.
 */

import { UniChefError } from '../errors.js';
import type { PlainJson } from '../ops/types.js';
import MAP from './cyberchef-map.json' with { type: 'json' };

/** A JSON value as `JSON.parse` returns it: the shape of CyberChef arguments. */
export type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
type PlainObject = Record<string, Plain>;

/** One CyberChef step as parsed: `{op, args, disabled?, breakpoint?}`. */
export interface CyberChefStep {
  readonly op: string;
  readonly args?: PlainJson;
  readonly disabled?: PlainJson;
  readonly breakpoint?: PlainJson;
}

interface Translator {
  readonly to?: string;
  readonly map?: Readonly<Record<string, Plain>>;
  readonly ignore?: boolean;
  readonly expect?: Plain;
  readonly flag?: string;
  readonly when?: Plain;
  readonly extract?: string;
  readonly find?: boolean;
  readonly bytes?: string | boolean;
  readonly integer?: boolean;
  readonly divide?: number;
  readonly unescape?: boolean;
  readonly invert?: boolean;
  readonly default?: Plain;
}

interface Entry {
  readonly op?: string;
  readonly args?: readonly Translator[];
  readonly set?: PlainObject;
  readonly scope?: boolean;
  readonly merge?: boolean;
}

const OPERATIONS = (MAP as unknown as { operations: Record<string, Entry> }).operations;

/** The CyberChef operation names this importer can translate. */
export const cyberChefOperations = (): string[] => Object.keys(OPERATIONS);

const ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '\\': '\\',
  '0': '\0',
};
const BYTES_OPTIONS: Readonly<Record<string, string>> = {
  Hex: 'hex',
  UTF8: 'utf8',
  Base64: 'base64',
  Latin1: 'latin1',
};

const bad = (message: string) => new UniChefError('E_ARG_INVALID', message);
const isObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const has = (obj: object, key: string): boolean => Object.hasOwn(obj, key);
/** Python's repr for the values error messages quote. */
const repr = (value: unknown): string =>
  typeof value === 'string' ? `'${value}'` : JSON.stringify(value);

// -- chef format ---------------------------------------------------------------------------

const OP_NAME = /[A-Za-z0-9_\-/.+]+/y;
const WORD = /[A-Za-z0-9_$.+-]+/y;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const HEX4 = /^[0-9a-fA-F]{4}$/;
const HEX2 = /^[0-9a-fA-F]{2}$/;

/** A small parser for CyberChef's `Op_Name(arg,...)/disabled/breakpoint` format, whose
 * arguments are JavaScript literals. */
class Chef {
  pos = 0;

  constructor(readonly text: string) {}

  fail(what: string): UniChefError {
    return new UniChefError(
      'E_RECIPE_SCHEMA',
      `Chef recipe: ${what} at offset ${String(this.pos)}.`,
    );
  }

  peek(): string {
    while (this.pos < this.text.length && /\s/.test(this.text.charAt(this.pos))) this.pos += 1;
    return this.text.charAt(this.pos);
  }

  eat(char: string): void {
    if (this.peek() !== char) throw this.fail(`expected '${char}'`);
    this.pos += 1;
  }

  match(re: RegExp): string | null {
    re.lastIndex = this.pos;
    const found = re.exec(this.text);
    if (found === null) return null;
    this.pos = re.lastIndex;
    return found[0];
  }

  steps(): CyberChefStep[] {
    const out: CyberChefStep[] = [];
    while (this.peek() !== '') {
      // Greedy then checked, not a lazy lookahead: '(' is not a name character, so it is the
      // same match without the quadratic backtracking.
      const start = this.pos;
      const name = this.match(OP_NAME);
      if (name === null || this.text.charAt(this.pos) !== '(') {
        this.pos = start;
        throw this.fail('expected an operation name');
      }
      this.eat('(');
      const args: Plain[] = [];
      while (this.peek() !== ')') {
        args.push(this.value());
        if (this.peek() === ',') this.pos += 1;
      }
      this.eat(')');
      const step: { -readonly [K in keyof CyberChefStep]: CyberChefStep[K] } = {
        op: name.replaceAll('_', ' '),
        args,
      };
      for (const flag of ['disabled', 'breakpoint'] as const) {
        if (this.text.startsWith(`/${flag}`, this.pos)) {
          step[flag] = true;
          this.pos += flag.length + 1;
        }
      }
      out.push(step);
    }
    return out;
  }

  value(): Plain {
    const char = this.peek();
    if (char === "'" || char === '"') return this.string();
    if (char === '[') {
      this.pos += 1;
      const items: Plain[] = [];
      while (this.peek() !== ']') {
        items.push(this.value());
        if (this.peek() === ',') this.pos += 1;
      }
      this.eat(']');
      return items;
    }
    if (char === '{') {
      this.pos += 1;
      const obj: PlainObject = {};
      while (this.peek() !== '}') {
        const key = this.peek() === "'" || this.peek() === '"' ? this.string() : this.word();
        this.eat(':');
        obj[key] = this.value();
        if (this.peek() === ',') this.pos += 1;
      }
      this.eat('}');
      return obj;
    }
    const word = this.word();
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    if (!NUMBER.test(word)) throw this.fail(`unexpected ${repr(word)}`);
    return Number(word);
  }

  word(): string {
    const word = this.match(WORD);
    if (word === null) throw this.fail('expected a value');
    return word;
  }

  string(): string {
    const quote = this.text.charAt(this.pos);
    this.pos += 1;
    let out = '';
    while (this.pos < this.text.length) {
      const char = this.text.charAt(this.pos);
      this.pos += 1;
      if (char === quote) return out;
      if (char === '\\' && this.pos < this.text.length) {
        const next = this.text.charAt(this.pos);
        this.pos += 1;
        const hex4 = this.text.slice(this.pos, this.pos + 4);
        const hex2 = this.text.slice(this.pos, this.pos + 2);
        if (next === 'u' && HEX4.test(hex4)) {
          out += String.fromCharCode(parseInt(hex4, 16));
          this.pos += 4;
        } else if (next === 'x' && HEX2.test(hex2)) {
          out += String.fromCharCode(parseInt(hex2, 16));
          this.pos += 2;
        } else {
          out += ESCAPES[next] ?? next;
        }
      } else {
        out += char;
      }
    }
    throw this.fail('unterminated string');
  }
}

/** CyberChef steps as `[{op: name, args: [...], ...}]`, from either format. */
export function parseCyberChef(text: string): CyberChefStep[] {
  const stripped = text.trim();
  if (stripped.startsWith('[')) {
    let doc: unknown;
    try {
      doc = JSON.parse(stripped);
    } catch (e) {
      throw new UniChefError(
        'E_RECIPE_SCHEMA',
        `Invalid CyberChef JSON: ${e instanceof Error ? e.message : String(e)}.`,
      );
    }
    if (!Array.isArray(doc) || !doc.every((s) => isObject(s) && typeof s['op'] === 'string')) {
      throw new UniChefError('E_RECIPE_SCHEMA', 'Each CyberChef step needs an "op" name.');
    }
    return doc as CyberChefStep[];
  }
  if (stripped === '') throw new UniChefError('E_RECIPE_SCHEMA', 'The CyberChef recipe is empty.');
  return new Chef(stripped).steps();
}

// -- translation ---------------------------------------------------------------------------

const unescape = (text: string): string =>
  text.replace(/\\(.)/g, (whole, char: string) => ESCAPES[char] ?? whole);

const key = (value: Plain): string => (typeof value === 'string' ? value : JSON.stringify(value));

function fill(template: Plain, value: Plain): Plain {
  if (template === '$') return value;
  if (isObject(template)) {
    return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, fill(v, value)]));
  }
  return template;
}

class StepBuilder {
  readonly args: PlainObject;
  flags = '';
  readonly before: PlainObject[] = [];
  readonly after: PlainObject[] = [];

  constructor(
    readonly op: string,
    preset: PlainObject,
  ) {
    this.args = { ...preset };
  }
}

function toggle(name: string, value: Plain, encoding: string | null): PlainObject {
  if (encoding !== null && typeof value === 'string') return { encoding, value };
  if (isObject(value) && typeof value['string'] === 'string') {
    // Only a string can name a format; anything else falls through to the error.
    const option = typeof value['option'] === 'string' ? value['option'] : '';
    const enc = has(BYTES_OPTIONS, option) ? BYTES_OPTIONS[option] : undefined;
    if (enc === undefined) {
      throw bad(`${name}: unsupported key format ${repr(value['option'] ?? null)}.`);
    }
    return { encoding: enc, value: value['string'] };
  }
  throw bad(`${name}: expected a {option, string} value.`);
}

/** Find / Replace's `{option, string}`: Regex, Extended (escapes) or Simple string. */
function find(where: string, to: string, value: Plain, step: StepBuilder): void {
  if (!isObject(value) || typeof value['string'] !== 'string') {
    throw bad(`${where}: expected a {option, string} value.`);
  }
  // A non-string option is neither Extended nor Simple string, so it means Regex.
  const option = typeof value['option'] === 'string' ? value['option'] : 'Regex';
  const extended = option.startsWith('Extended');
  step.args['literal'] = extended || option === 'Simple string';
  step.args[to] = extended ? unescape(value['string']) : value['string'];
}

function mapped(where: string, tr: Translator, value: Plain, step: StepBuilder): void {
  const mapping = tr.map ?? {};
  const k = key(value);
  if (!has(mapping, k) && !has(mapping, '*')) {
    throw bad(`${where}: ${repr(value)} has no UniChef equivalent.`);
  }
  const target = (has(mapping, k) ? mapping[k] : mapping['*']) ?? null;
  const to = tr.to ?? '';
  if (!isObject(target)) {
    step.args[to] = fill(target, value);
    return;
  }
  if (has(target, 'value')) step.args[to] = fill(target['value'] ?? null, value);
  const set = target['set'];
  if (isObject(set)) for (const [k2, v] of Object.entries(set)) step.args[k2] = fill(v, value);
  step.before.push(...((target['before'] ?? []) as PlainObject[]));
  step.after.push(...((target['after'] ?? []) as PlainObject[]));
}

/** Arguments that set nothing directly: ignored, expected constants and regex flags.
 * Returns whether `tr` was one of them. */
function check(where: string, tr: Translator, value: Plain, step: StepBuilder): boolean {
  if (tr.ignore === true) return true;
  if (has(tr, 'expect')) {
    if (JSON.stringify(value) !== JSON.stringify(tr.expect)) {
      throw bad(`${where}: only ${repr(tr.expect)} can be imported, not ${repr(value)}.`);
    }
    return true;
  }
  if (tr.flag !== undefined) {
    if (JSON.stringify(value) === JSON.stringify(has(tr, 'when') ? tr.when : true)) {
      step.flags += tr.flag;
    }
    return true;
  }
  return false;
}

/** Python's `int()` on the values an integer argument may hold. */
function integer(where: string, value: Plain): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^\s*[+-]?\d+\s*$/.test(value)) return parseInt(value, 10);
  throw bad(`${where}: expected a number, not ${repr(value)}.`);
}

function apply(name: string, index: number, tr: Translator, raw: Plain, step: StepBuilder): void {
  const where = `${name} argument ${String(index + 1)}`;
  if (check(where, tr, raw, step)) return;
  let value = raw;
  const to = tr.to ?? '';
  if (tr.extract !== undefined && typeof value === 'string') {
    const found = new RegExp(tr.extract).exec(value);
    value = found?.[1] ?? value;
  }
  if (tr.find === true) {
    find(where, to, value, step);
    return;
  }
  if (tr.bytes !== undefined) {
    step.args[to] = toggle(where, value, typeof tr.bytes === 'string' ? tr.bytes : null);
    return;
  }
  if (tr.map !== undefined) {
    mapped(where, tr, value, step);
    return;
  }
  if (tr.integer === true) {
    const number = integer(where, value);
    const divide = tr.divide ?? 1;
    if (number % divide !== 0) {
      throw bad(`${where}: ${String(number)} is not a multiple of ${String(divide)}.`);
    }
    value = Math.floor(number / divide);
  } else if (tr.unescape === true && typeof value === 'string') {
    value = unescape(value);
  } else if (tr.invert === true && typeof value === 'boolean') {
    value = !value;
  }
  step.args[to] = value;
}

function translate(cc: CyberChefStep, entry: Entry): PlainObject[] {
  const name = cc.op;
  // Array.isArray widens a readonly array to any[]; the parser builds these mutable anyway.
  const values = (cc.args ?? []) as Plain;
  if (!Array.isArray(values)) {
    throw new UniChefError('E_RECIPE_SCHEMA', `${name}: "args" must be an array.`);
  }
  const translators = entry.args ?? [];
  if (values.length > translators.length) {
    throw bad(
      `${name}: expected at most ${String(translators.length)} argument(s), got ${String(values.length)}.`,
    );
  }
  const step = new StepBuilder(entry.op ?? '', entry.set ?? {});
  translators.forEach((tr, index) => {
    if (index < values.length) {
      apply(name, index, tr, values[index] as Plain, step);
    } else if (tr.default !== undefined) {
      // CyberChef's own default, where it differs from ours.
      apply(name, index, tr, tr.default, step);
    }
  });
  if (step.flags !== '') step.args['flags'] = [...new Set(step.flags)].sort().join('');
  const out: PlainObject = { op: step.op };
  if (Object.keys(step.args).length > 0) out['args'] = step.args;
  if (cc.disabled === true) out['disabled'] = true;
  if (cc.breakpoint === true) out['breakpoint'] = true;
  return [...step.before, out, ...step.after];
}

/** Translate CyberChef recipe text into a UniChef recipe document. Unmapped operations raise
 * E_OP_UNKNOWN naming every one of them, so nothing is dropped silently. */
export function importCyberChef(text: string): {
  version: 1;
  steps: Record<string, PlainJson>[];
} {
  const steps = parseCyberChef(text);
  const unknown = [...new Set(steps.map((s) => s.op).filter((op) => !has(OPERATIONS, op)))].sort();
  if (unknown.length > 0) {
    throw new UniChefError(
      'E_OP_UNKNOWN',
      `No UniChef equivalent for CyberChef operation(s): ${unknown.join(', ')}.`,
      [],
      { operations: unknown },
    );
  }
  const root: PlainObject[] = [];
  const scopes: PlainObject[][] = [root];
  for (const cc of steps) {
    const entry = OPERATIONS[cc.op];
    if (entry === undefined) continue; // unknown ops were rejected above
    if (entry.merge === true) {
      scopes.length = 1;
      continue;
    }
    const translated = translate(cc, entry);
    scopes.at(-1)?.push(...translated);
    if (entry.scope === true) {
      const main = translated.find((s) => s['op'] === entry.op);
      if (main !== undefined) {
        const args = isObject(main['args']) ? main['args'] : {};
        const inner: PlainObject[] = [];
        args['steps'] = inner;
        main['args'] = args;
        scopes.push(inner);
      }
    }
  }
  return { version: 1, steps: root };
}
