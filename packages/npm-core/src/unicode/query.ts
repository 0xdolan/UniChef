// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The character query language (PRD §4.8).
 *
 *     query      = or ;
 *     or         = and , { "|" , and } ;
 *     and        = unary , { "&" , unary } ;
 *     unary      = [ "!" ] , atom ;
 *     atom       = "(" , query , ")" | name_re | comparison ;
 *     name_re    = "name" , "~" , "/" , pattern , "/" , [ "i" ] ;
 *     comparison = prop , op , value | binary_prop ;
 *
 * Evaluation narrows a candidate set from left to right, so `gc=Lu & name~/LATIN/` runs
 * the regex over uppercase letters only. Results are code points in ascending order.
 *
 * `name~/…/` runs the UniChef regex engine with a per-search bound of `timeoutMs`
 * (default 2000, as in Python). Tests may inject another `matcher`.
 */

import { UniChefError } from '../errors.js';
import { pyRepr } from '../ops/types.js';
import { compileRegex, predicate } from '../regex/run.js';
import {
  complement,
  intersect,
  MAX_CODE_POINT,
  merge,
  union,
  type Range,
  type Ranges,
} from './data.js';
import * as names from './names.js';
import * as props from './props.js';

export const DEFAULT_LIMIT = 10_000;
export const DEFAULT_TIMEOUT_MS = 2000;
export const ENUMERATED_PROPS = new Set(['gc', 'sc', 'scx', 'blk', 'age', 'bc', 'ea', 'ccc']);
export const ORDERED_PROPS = new Set(['age', 'ccc']);
const OPERATORS = ['<=', '>=', '!=', '=', '<', '>'] as const;
const SINGLE = new Set('()|&!~');
const WORD_EXTRA = new Set('_.-');
const YES = new Set(['y', 'yes', 't', 'true']);
const NO = new Set(['n', 'no', 'f', 'false']);
const EVERYTHING: Ranges = [[0, MAX_CODE_POINT]];

/** Compile a name regex (`flags` is `""` or `"i"`) into a whole-name test. */
export type NameMatcher = (pattern: string, flags: string) => (name: string) => boolean;

export interface QueryResult {
  readonly codePoints: readonly number[];
  readonly total: number;
  readonly truncated: boolean;
}

type TokenKind = 'word' | 'quoted' | 'op' | 'punct' | 'regex' | 'end';

interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly pos: number;
  readonly flags: string;
}

const token = (kind: TokenKind, text: string, pos: number, flags = ''): Token => ({
  kind,
  text,
  pos,
  flags,
});

function fail(message: string): never {
  throw new UniChefError('E_ARG_INVALID', message);
}

// Python's str predicates, as used by the tokenizer.
const isSpace = (ch: string): boolean =>
  (/^\s$/u.test(ch) && ch !== '﻿') || ('\x1c' <= ch && ch <= '\x1f');
const isAlpha = (ch: string): boolean => /^\p{L}$/u.test(ch);
const isAlnum = (ch: string): boolean => /^[\p{L}\p{N}]$/u.test(ch);

/** Read `/body/flags` starting at the slash at `i`; a backslash-slash is a literal slash. */
function readRegex(text: string[], i: number): [Token, number] {
  const body: string[] = [];
  let j = i + 1;
  while (j < text.length && text[j] !== '/') {
    if (text[j] === '\\' && text[j + 1] === '/') {
      j++;
    } else if (text[j] === '\\' && j + 1 < text.length) {
      body.push(text[j] ?? '');
      j++;
    }
    body.push(text[j] ?? '');
    j++;
  }
  if (j >= text.length) {
    fail(`Missing closing '/' for the regex at offset ${String(i)}.`);
  }
  let flags = '';
  while (j + 1 < text.length && isAlpha(text[j + 1] ?? '')) {
    flags += text[j + 1] ?? '';
    j++;
  }
  if (flags !== '' && flags !== 'i') {
    fail(
      `Name regexes take only the i flag, not ${pyRepr(Array.from(flags).slice(0, 8).join(''))}.`,
    );
  }
  return [token('regex', body.join(''), i, flags), j + 1];
}

/** Read a double-quoted string starting at `i`; a backslash escapes any character. */
function readQuoted(text: string[], i: number): [Token, number] {
  let j = i + 1;
  const chunk: string[] = [];
  while (j < text.length && text[j] !== '"') {
    if (text[j] === '\\' && j + 1 < text.length) {
      j++;
    }
    chunk.push(text[j] ?? '');
    j++;
  }
  if (j >= text.length) {
    fail(`Missing closing quote for the string at offset ${String(i)}.`);
  }
  return [token('quoted', chunk.join(''), i), j + 1];
}

function startsWithAt(chars: string[], s: string, i: number): boolean {
  return chars.slice(i, i + s.length).join('') === s;
}

function tokenize(source: string): Token[] {
  const text = Array.from(source); // offsets count code points, as in Python
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i] ?? '';
    if (isSpace(ch)) {
      i++;
      continue;
    }
    let found: Token;
    const op = OPERATORS.find((o) => startsWithAt(text, o, i));
    if (ch === '/') {
      [found, i] = readRegex(text, i);
    } else if (ch === '"') {
      [found, i] = readQuoted(text, i);
    } else if (op !== undefined) {
      found = token('op', op, i);
      i += op.length;
    } else if (SINGLE.has(ch)) {
      found = token('punct', ch, i);
      i++;
    } else if (isAlnum(ch) || WORD_EXTRA.has(ch)) {
      let j = i;
      while (j < text.length && (isAlnum(text[j] ?? '') || WORD_EXTRA.has(text[j] ?? ''))) {
        j++;
      }
      found = token('word', text.slice(i, j).join(''), i);
      i = j;
    } else {
      fail(`Unexpected ${pyRepr(ch)} at offset ${String(i)} in the query.`);
    }
    out.push(found);
  }
  out.push(token('end', '', text.length));
  return out;
}

const versionKey = (text: string): number[] => text.split('.').map((part) => parseInt(part, 10));

function compareKeys(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return a.length - b.length;
}

/** Recursive descent that evaluates as it parses, narrowing `within` as it goes. */
class Evaluator {
  private readonly tokens: Token[];
  private pos = 0;

  constructor(
    text: string,
    private readonly matcher: NameMatcher,
  ) {
    this.tokens = tokenize(text);
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? token('end', '', 0);
  }

  private next(): Token {
    const t = this.peek();
    this.pos++;
    return t;
  }

  private isPunct(text: string): boolean {
    const t = this.peek();
    return t.kind === 'punct' && t.text === text;
  }

  private expect(text: string): void {
    const t = this.next();
    if (t.text !== text || (t.kind !== 'punct' && t.kind !== 'op')) {
      fail(`Expected ${pyRepr(text)} at offset ${String(t.pos)} in the query.`);
    }
  }

  run(): Ranges {
    const result = this.or(EVERYTHING);
    const t = this.peek();
    if (t.kind !== 'end') {
      fail(`Unexpected ${pyRepr(t.text)} at offset ${String(t.pos)}.`);
    }
    return result;
  }

  private or(within: Ranges): Ranges {
    let result = this.and(within);
    while (this.isPunct('|')) {
      this.pos++;
      result = union(result, this.and(within));
    }
    return result;
  }

  private and(within: Ranges): Ranges {
    let result = this.unary(within);
    while (this.isPunct('&')) {
      this.pos++;
      result = this.unary(result);
    }
    return result;
  }

  private unary(within: Ranges): Ranges {
    if (this.isPunct('!')) {
      this.pos++;
      return intersect(within, complement(this.atom(within)));
    }
    return this.atom(within);
  }

  private atom(within: Ranges): Ranges {
    const t = this.next();
    if (t.kind === 'punct' && t.text === '(') {
      const result = this.or(within);
      this.expect(')');
      return result;
    }
    if (t.kind !== 'word') {
      fail(`Expected a property or '(' at offset ${String(t.pos)} in the query.`);
    }
    if (props.loose(t.text) === 'name' && this.peek().text === '~') {
      this.pos++;
      const pattern = this.next();
      if (pattern.kind !== 'regex') {
        fail(`Expected /regex/ after name~ at offset ${String(pattern.pos)}.`);
      }
      return this.name(pattern, within);
    }
    const op = this.peek();
    if (op.kind !== 'op') {
      return intersect(within, this.binary(t.text, 'yes'));
    }
    this.pos++;
    const value = this.next();
    if (value.kind !== 'word' && value.kind !== 'quoted') {
      fail(`Expected a value at offset ${String(value.pos)} in the query.`);
    }
    return intersect(within, this.compare(t.text, op.text, value.text));
  }

  private name(t: Token, within: Ranges): Ranges {
    const test = this.matcher(t.text, t.flags);
    const hits = new Set<number>();
    for (const [cp, text] of names.iterNames(within)) {
      if (test(text)) {
        hits.add(cp);
      }
    }
    for (const [cp, alias] of names.iterAliases(within)) {
      if (!hits.has(cp) && test(alias.alias)) {
        hits.add(cp);
      }
    }
    return merge([...hits].map((cp): Range => [cp, cp]));
  }

  private binary(name: string, value: string): Ranges {
    const prop = props.resolveProperty(name);
    if (!props.isBinary(prop)) {
      fail(`${name} is not a binary property; compare it with a value, as in ${name}=….`);
    }
    const answer = props.loose(value);
    if (!YES.has(answer) && !NO.has(answer)) {
      fail(
        `Binary property ${name} takes Yes or No, not ${pyRepr(Array.from(value).slice(0, 32).join(''))}.`,
      );
    }
    const ranges = props.binaryRanges(prop);
    return YES.has(answer) ? ranges : complement(ranges);
  }

  private compare(name: string, op: string, value: string): Ranges {
    const prop = props.resolveProperty(name);
    if (props.isBinary(prop)) {
      if (op !== '=' && op !== '!=') {
        fail(`Binary property ${name} takes only = and !=.`);
      }
      const ranges = this.binary(name, value);
      return op === '=' ? ranges : complement(ranges);
    }
    if (!ENUMERATED_PROPS.has(prop)) {
      fail(`The query language cannot search by ${name}.`);
    }
    if (op !== '=' && op !== '!=') {
      if (!ORDERED_PROPS.has(prop)) {
        fail(`Ordering comparisons work for age and ccc only, not ${name}.`);
      }
      return this.ordered(prop, op, value);
    }
    const resolved = props.resolveValue(prop === 'scx' ? 'sc' : prop, value);
    const ranges = props.rangesFor(prop, resolved);
    return op === '=' ? ranges : complement(ranges);
  }

  private ordered(prop: string, op: string, value: string): Ranges {
    const resolved = props.resolveValue(prop, value);
    if (prop === 'age' && resolved === 'NA') {
      fail('Unassigned (age NA) has no order.');
    }
    const target = versionKey(resolved);
    const table = props.table(prop);
    const candidates = new Set([table.default, ...table.values]);
    candidates.delete('NA');
    const tests: Record<string, (d: number) => boolean> = {
      '<': (d) => d < 0,
      '<=': (d) => d <= 0,
      '>': (d) => d > 0,
      '>=': (d) => d >= 0,
    };
    const test = tests[op] as (d: number) => boolean;
    const wanted = new Set(
      [...candidates].filter((v) => test(compareKeys(versionKey(String(v)), target))),
    );
    return table.rangesWhere(wanted);
  }
}

/** Run a character query; at most `limit` code points, ascending. */
export function query(
  text: string,
  options: { limit?: number; timeoutMs?: number; matcher?: NameMatcher } = {},
): QueryResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const matcher: NameMatcher =
    options.matcher ?? ((pattern, flags) => predicate(compileRegex(pattern, flags), timeoutMs));
  if (text.trim() === '') {
    fail('The query is empty.');
  }
  const ranges = new Evaluator(text, matcher).run();
  const total = ranges.reduce((sum, [start, end]) => sum + end - start + 1, 0);
  const out: number[] = [];
  for (const [start, end] of ranges) {
    const stop = Math.min(end, start + limit - out.length - 1);
    for (let cp = start; cp <= stop; cp++) {
      out.push(cp);
    }
    if (out.length >= limit) {
      break;
    }
  }
  return { codePoints: out, total, truncated: total > limit };
}
