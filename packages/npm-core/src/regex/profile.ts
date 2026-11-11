// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The portable regex profile (PRD §4.9): parser, rejection of unsupported constructs, and
 * expansion of every character class to explicit code-point ranges from the pinned UCD.
 *
 * The parser is hand-written recursive descent over code points. It resolves flags while
 * parsing, so the tree it returns needs no further Unicode knowledge: `.`, `\d`, `\w`,
 * `\s`, `\p{…}` and `i`-flag case variants are already `Chars` range sets, and
 * `^ $ \b \B` are `Anchor` nodes with fixed meanings. Line terminators are LF, CR, U+2028
 * and U+2029.
 *
 * Malformed patterns raise `E_ARG_INVALID`; well-formed constructs outside the profile
 * raise `E_REGEX_UNSUPPORTED`. The unicode `core` data must be loaded (`ready('core')`).
 */

import { UniChefError } from '../errors.js';
import { pyRepr } from '../ops/types.js';
import { simpleFoldOrbits } from '../unicode/case.js';
import {
  complement,
  contains,
  MAX_CODE_POINT,
  merge,
  once,
  union,
  type Range,
  type Ranges,
} from '../unicode/data.js';
import * as props from '../unicode/props.js';

export type GroupKind = 'capture' | 'group' | 'ahead' | 'not-ahead' | 'behind' | 'not-behind';
export type AnchorKind = 'start' | 'end' | 'line-start' | 'line-end' | 'word' | 'not-word';

export type Node =
  | { readonly type: 'chars'; readonly ranges: Ranges }
  | { readonly type: 'seq'; readonly items: readonly Node[] }
  | { readonly type: 'alt'; readonly branches: readonly Node[] }
  | {
      readonly type: 'group';
      readonly kind: GroupKind;
      readonly body: Node;
      readonly name: string | null;
    }
  | {
      readonly type: 'quant';
      readonly body: Node;
      readonly min: number;
      readonly max: number | null;
      readonly lazy: boolean;
    }
  | { readonly type: 'backref'; readonly ref: number | string }
  | { readonly type: 'anchor'; readonly kind: AnchorKind };

export interface Pattern {
  readonly root: Node;
  readonly flags: string;
  readonly groups: number;
  readonly names: readonly string[];
  /** Group number of each named group (Python: `pattern.groupindex`). */
  readonly groupIndex: ReadonlyMap<string, number>;
}

export const FLAGS = 'imsx';
export const MAX_REPEAT = 65535;
export const LINE_TERMINATORS: Ranges = [
  [0x0a, 0x0a],
  [0x0d, 0x0d],
  [0x2028, 0x2029],
];
const HIGH_SURROGATES: Range = [0xd800, 0xdbff];
const LOW_SURROGATES: Range = [0xdc00, 0xdfff];
const SURROGATE_BITS = 10;
const SUPPLEMENTARY = 0x10000;
const SIMPLE_ESCAPES: Readonly<Record<string, number>> = {
  n: 0x0a,
  r: 0x0d,
  t: 0x09,
  f: 0x0c,
  v: 0x0b,
};
const SET_OPERATORS = new Set(['&&', '--', '||', '~~']);
const YES = new Set(['y', 'yes', 't', 'true']);
const NO = new Set(['n', 'no', 'f', 'false']);
const HEX_ESCAPE_DIGITS: Readonly<Record<string, number>> = { x: 2, u: 4 };
const MAX_HEX_DIGITS = 6;
const EXTENDED_SPACE = new Set([' ', '\t', '\n', '\r', '\f', '\v']);

// ---------------------------------------------------------------------------
// Python string predicates, for the characters the parser classifies

const isAsciiDigit = (ch: string): boolean => ch.length === 1 && ch >= '0' && ch <= '9';
const isAsciiAlnum = (ch: string): boolean => /^[A-Za-z0-9]$/.test(ch);
const isAsciiIdentifier = (s: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);

/** Python `str.isdigit()` for one code point: decimal digits (gc=Nd) and ASCII digits. */
function isDigit(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && (isAsciiDigit(ch) || props.gc(cp) === 'Nd');
}

/** Python `int(text, 16)`: optional whitespace and `+`, digits with single underscores. */
function parseHex(text: string): number | null {
  const found = /^\s*\+?([0-9A-Fa-f]+(?:_[0-9A-Fa-f]+)*)\s*$/.exec(text);
  return found?.[1] === undefined ? null : parseInt(found[1].replace(/_/g, ''), 16);
}

// ---------------------------------------------------------------------------
// Character semantics

/** `\d`: gc=Nd. */
export const digit = once((): Ranges => props.rangesFor('gc', 'Nd'));

/** `\w`: Alphabetic | gc=M | gc=Nd | gc=Pc | Join_Control (UTS #18 Annex C). */
export const word = once((): Ranges =>
  union(
    props.binaryRanges('Alphabetic'),
    props.rangesFor('gc', 'M'),
    props.rangesFor('gc', 'Nd'),
    props.rangesFor('gc', 'Pc'),
    props.binaryRanges('Join_Control'),
  ),
);

/** `\s`: White_Space. */
export const space = once((): Ranges => props.binaryRanges('White_Space'));

/** Add every code point with the same simple case fold as a member (flag `i`). */
export function closeCase(ranges: Ranges): Ranges {
  const extra: Range[] = [];
  for (const [cp, orbit] of simpleFoldOrbits()) {
    if (contains(ranges, cp)) {
      for (const other of orbit) {
        extra.push([other, other]);
      }
    }
  }
  return extra.length > 0 ? union(ranges, extra) : ranges;
}

function invalid(message: string): never {
  throw new UniChefError('E_ARG_INVALID', message);
}

function unsupported(message: string): never {
  throw new UniChefError('E_REGEX_UNSUPPORTED', message);
}

/** The set named by the body of `\p{…}`: gc, sc, scx, blk or a binary property. */
export function propertyRanges(body: string): Ranges {
  const eq = body.indexOf('=');
  if (eq < 0) {
    try {
      return props.rangesFor('gc', props.resolveValue('gc', body));
    } catch (exc) {
      if (!(exc instanceof UniChefError)) {
        throw exc;
      }
    }
    const prop = props.resolveProperty(body);
    if (!props.isBinary(prop)) {
      invalid(`\\p{${body}} needs a value, as in \\p{${body}=…}.`);
    }
    return props.binaryRanges(prop);
  }
  const key = body.slice(0, eq);
  const value = body.slice(eq + 1);
  const prop = props.resolveProperty(key);
  if (props.isBinary(prop)) {
    const answer = props.loose(value);
    if (!YES.has(answer) && !NO.has(answer)) {
      invalid(`Binary property ${key} takes Yes or No, not ${pyRepr(value)}.`);
    }
    const ranges = props.binaryRanges(prop);
    return YES.has(answer) ? ranges : complement(ranges);
  }
  if (!['gc', 'sc', 'scx', 'blk'].includes(prop)) {
    unsupported(`\\p{${key}=…} is outside the portable profile (gc, sc, scx, blk).`);
  }
  const resolved = props.resolveValue(prop === 'scx' ? 'sc' : prop, value);
  return props.rangesFor(prop, resolved);
}

// ---------------------------------------------------------------------------
// Parser

const GROUP_HEADS: readonly (readonly [string, GroupKind])[] = [
  [':', 'group'],
  ['=', 'ahead'],
  ['!', 'not-ahead'],
  ['<=', 'behind'],
  ['<!', 'not-behind'],
];

const UNSUPPORTED_GROUPS: Readonly<Record<string, string>> = {
  '>': 'Atomic groups',
  '(': 'Conditionals',
  P: 'Python-style (?P…) groups',
  '|': 'Branch-reset groups',
  '#': 'Inline comments',
};

class Parser {
  /** The pattern as code points, so offsets match Python's string indices. */
  private readonly src: readonly string[];
  private pos = 0;
  private groups = 0;
  private readonly names: string[] = [];
  private readonly groupIndex = new Map<string, number>();
  private readonly backrefs: (number | string)[] = [];

  constructor(
    pattern: string,
    private readonly flags: string,
  ) {
    this.src = Array.from(pattern);
  }

  // -- helpers

  private peek(offset = 0): string {
    return this.src[this.pos + offset] ?? '';
  }

  private take(): string {
    const ch = this.peek();
    if (ch === '') {
      invalid('The pattern ends unexpectedly.');
    }
    this.pos += 1;
    return ch;
  }

  private at(): string {
    return ` at offset ${String(this.pos)}`;
  }

  private slice(start: number, end?: number): string {
    return this.src.slice(start, end).join('');
  }

  private find(ch: string, from: number): number {
    return this.src.indexOf(ch, from);
  }

  private startsWith(prefix: string, at: number): boolean {
    return this.slice(at, at + Array.from(prefix).length) === prefix;
  }

  private skipExtended(): void {
    if (!this.flags.includes('x')) {
      return;
    }
    while (this.pos < this.src.length) {
      const ch = this.peek();
      if (EXTENDED_SPACE.has(ch)) {
        this.pos += 1;
      } else if (ch === '#') {
        const end = this.find('\n', this.pos);
        this.pos = end < 0 ? this.src.length : end + 1;
      } else {
        return;
      }
    }
  }

  private chars(ranges: Ranges): Node {
    return { type: 'chars', ranges: this.flags.includes('i') ? closeCase(ranges) : ranges };
  }

  // -- grammar

  parse(): Pattern {
    const root = this.alternation();
    if (this.pos < this.src.length) {
      invalid(`Unmatched ')'${this.at()}.`);
    }
    for (const ref of this.backrefs) {
      if (typeof ref === 'number' && ref > this.groups) {
        invalid(`Backreference \\${String(ref)} names a group that does not exist.`);
      }
      if (typeof ref === 'string' && !this.names.includes(ref)) {
        invalid(`Backreference \\k<${ref}> names a group that does not exist.`);
      }
    }
    if (this.backrefs.length > 0 && this.flags.includes('i')) {
      unsupported('Backreferences under the i flag are outside the portable profile.');
    }
    return {
      root,
      flags: this.flags,
      groups: this.groups,
      names: this.names,
      groupIndex: this.groupIndex,
    };
  }

  private alternation(): Node {
    const branches = [this.sequence()];
    while (this.peek() === '|') {
      this.pos += 1;
      branches.push(this.sequence());
    }
    return branches.length === 1 && branches[0] !== undefined
      ? branches[0]
      : { type: 'alt', branches };
  }

  private sequence(): Node {
    const items: Node[] = [];
    for (;;) {
      this.skipExtended();
      const ch = this.peek();
      if (ch === '' || ch === '|' || ch === ')') {
        break;
      }
      const atom = this.atom();
      this.skipExtended();
      items.push(this.quantified(atom));
    }
    return items.length === 1 && items[0] !== undefined ? items[0] : { type: 'seq', items };
  }

  private atom(): Node {
    const ch = this.take();
    switch (ch) {
      case '(':
        return this.group();
      case '[':
        return this.charClass();
      case '.':
        return {
          type: 'chars',
          ranges: this.flags.includes('s') ? [[0, MAX_CODE_POINT]] : complement(LINE_TERMINATORS),
        };
      case '^':
        return { type: 'anchor', kind: this.flags.includes('m') ? 'line-start' : 'start' };
      case '$':
        return { type: 'anchor', kind: this.flags.includes('m') ? 'line-end' : 'end' };
      case '\\':
        return this.escapeAtom();
      case '*':
      case '+':
      case '?':
        return invalid(`Nothing to repeat before ${pyRepr(ch)}${this.at()}.`);
      case '{':
      case '}':
      case ']':
        return invalid(`Escape the literal ${pyRepr(ch)}${this.at()} as \\${ch}.`);
      default: {
        const cp = ch.codePointAt(0) ?? 0;
        return this.chars([[cp, cp]]);
      }
    }
  }

  private quantified(atom: Node): Node {
    const ch = this.peek();
    let low: number;
    let high: number | null;
    if (ch === '*' || ch === '+' || ch === '?') {
      this.pos += 1;
      [low, high] = ch === '*' ? [0, null] : ch === '+' ? [1, null] : [0, 1];
    } else if (ch === '{') {
      [low, high] = this.braces();
    } else {
      return atom;
    }
    if (
      atom.type === 'anchor' ||
      (atom.type === 'group' && !['capture', 'group'].includes(atom.kind))
    ) {
      invalid(`Anchors and lookarounds cannot be repeated${this.at()}.`);
    }
    const lazy = this.peek() === '?';
    if (lazy) {
      this.pos += 1;
    } else if (this.peek() === '+') {
      unsupported('Possessive quantifiers are outside the portable profile.');
    }
    return { type: 'quant', body: atom, min: low, max: high, lazy };
  }

  private braces(): [number, number | null] {
    const end = this.find('}', this.pos);
    const body = end > 0 ? this.slice(this.pos + 1, end) : '';
    const comma = body.indexOf(',');
    const lowText = comma < 0 ? body : body.slice(0, comma);
    const highText = comma < 0 ? '' : body.slice(comma + 1);
    const digits = /^[0-9]+$/;
    if (!digits.test(lowText) || !(highText === '' || digits.test(highText))) {
      invalid(`Escape the literal '{'${this.at()} as \\{.`);
    }
    this.pos = end + 1;
    const low = Number(lowText);
    const high = comma < 0 ? low : highText === '' ? null : Number(highText);
    if (Math.max(low, high ?? 0) > MAX_REPEAT) {
      invalid(`Repeat counts are limited to ${String(MAX_REPEAT)}.`);
    }
    if (high !== null && high < low) {
      invalid(`The quantifier {${body}} has min > max.`);
    }
    return [low, high];
  }

  private group(): Node {
    let kind: GroupKind = 'capture';
    let name: string | null = null;
    if (this.peek() === '?') {
      this.pos += 1;
      [kind, name] = this.groupHead();
    }
    if (kind === 'capture') {
      this.groups += 1;
      if (name !== null) {
        this.groupIndex.set(name, this.groups);
      }
    }
    const body = this.alternation();
    if (this.peek() !== ')') {
      invalid("Missing ')' at the end of the pattern.");
    }
    this.pos += 1;
    return { type: 'group', kind, body, name };
  }

  private groupHead(): [GroupKind, string | null] {
    for (const [prefix, kind] of GROUP_HEADS) {
      if (this.startsWith(prefix, this.pos)) {
        this.pos += prefix.length;
        return [kind, null];
      }
    }
    if (this.peek() === '<') {
      this.pos += 1;
      const name = this.name('>');
      if (this.names.includes(name)) {
        invalid(`The group name ${pyRepr(name)} is used twice.`);
      }
      this.names.push(name);
      return ['capture', name];
    }
    const next = this.peek();
    let construct = UNSUPPORTED_GROUPS[next];
    if (construct === undefined && (isDigit(next) || ['R', '&', '+'].includes(next))) {
      construct = 'Recursion';
    }
    return unsupported(`${construct ?? 'Inline flags'} are outside the portable profile.`);
  }

  private name(close: string): string {
    const end = this.find(close, this.pos);
    const name = end >= 0 ? this.slice(this.pos, end) : '';
    if (!isAsciiIdentifier(name)) {
      invalid(`Invalid group name${this.at()}.`);
    }
    this.pos = end + 1;
    return name;
  }

  private isSetOperator(): boolean {
    return SET_OPERATORS.has(this.slice(this.pos, this.pos + 2));
  }

  private charClass(): Node {
    const negated = this.peek() === '^';
    if (negated) {
      this.pos += 1;
    }
    const parts: Range[] = [];
    for (;;) {
      const ch = this.peek();
      if (ch === '') {
        invalid("Missing ']' at the end of the pattern.");
      }
      if (ch === ']') {
        this.pos += 1;
        break;
      }
      if (this.isSetOperator()) {
        unsupported('Class set operations are outside the portable profile.');
      }
      if (ch === '[') {
        const what = this.peek(1) === ':' ? 'POSIX classes' : 'Nested classes';
        unsupported(`${what} are outside the portable profile.`);
      }
      const start = this.classAtom();
      if (this.isSetOperator()) {
        unsupported('Class set operations are outside the portable profile.');
      }
      if (this.peek() === '-' && this.peek(1) !== ']' && this.peek(1) !== '') {
        this.pos += 1;
        const end = this.classAtom();
        const a = start[0];
        const b = end[0];
        if (
          start.length !== 1 ||
          end.length !== 1 ||
          a === undefined ||
          b === undefined ||
          a[0] !== a[1] ||
          b[0] !== b[1]
        ) {
          invalid(`A class range needs single characters${this.at()}.`);
        }
        if (b[0] < a[0]) {
          invalid(`The class range ends before it starts${this.at()}.`);
        }
        parts.push([a[0], b[0]]);
      } else {
        parts.push(...start);
      }
    }
    let ranges = merge(parts);
    if (this.flags.includes('i')) {
      ranges = closeCase(ranges);
    }
    return { type: 'chars', ranges: negated ? complement(ranges) : ranges };
  }

  private classAtom(): Ranges {
    let ch = this.take();
    if (ch !== '\\') {
      const cp = ch.codePointAt(0) ?? 0;
      return [[cp, cp]];
    }
    ch = this.take();
    if (ch === 'b') {
      return [[0x08, 0x08]];
    }
    if (isDigit(ch) && ch !== '0') {
      invalid(`Backreferences cannot appear in a class${this.at()}.`);
    }
    return this.escapeSet(ch);
  }

  private escapeAtom(): Node {
    const ch = this.take();
    if (ch === 'b' || ch === 'B') {
      return { type: 'anchor', kind: ch === 'b' ? 'word' : 'not-word' };
    }
    if (isAsciiDigit(ch) && ch !== '0') {
      let digits = ch;
      while (isAsciiDigit(this.peek())) {
        digits += this.take();
      }
      const ref = Number(digits);
      this.backrefs.push(ref);
      return { type: 'backref', ref };
    }
    if (ch === 'k') {
      if (this.take() !== '<') {
        invalid(`\\k needs a group name in <…>${this.at()}.`);
      }
      const name = this.name('>');
      this.backrefs.push(name);
      return { type: 'backref', ref: name };
    }
    return this.chars(this.escapeSet(ch));
  }

  /** The set for an escape that denotes characters (shared by classes and atoms). */
  private escapeSet(ch: string): Ranges {
    let ranges: Ranges;
    switch (ch) {
      case 'd':
      case 'D':
        ranges = digit();
        break;
      case 'w':
      case 'W':
        ranges = word();
        break;
      case 's':
      case 'S':
        ranges = space();
        break;
      case 'p':
      case 'P':
        ranges = this.property();
        break;
      case '0':
        if (isDigit(this.peek())) {
          unsupported('Octal escapes are outside the portable profile.');
        }
        return [[0, 0]];
      case 'x':
      case 'u': {
        const cp = this.hex(ch);
        return [[cp, cp]];
      }
      default: {
        const simple = SIMPLE_ESCAPES[ch];
        if (simple !== undefined) {
          return [[simple, simple]];
        }
        if (isAsciiAlnum(ch)) {
          unsupported(`The escape \\${ch} is outside the portable profile.`);
        }
        const cp = ch.codePointAt(0) ?? 0;
        return [[cp, cp]];
      }
    }
    return ch === ch.toUpperCase() ? complement(ranges) : ranges;
  }

  private property(): Ranges {
    if (this.take() !== '{') {
      invalid(`\\p needs a property in {…}${this.at()}.`);
    }
    const end = this.find('}', this.pos);
    if (end < 0) {
      invalid("Missing '}' after \\p{.");
    }
    const body = this.slice(this.pos, end);
    this.pos = end + 1;
    return propertyRanges(body);
  }

  private hex(kind: string): number {
    let digits: string;
    if (this.peek() === '{') {
      const end = this.find('}', this.pos);
      digits = end > 0 ? this.slice(this.pos + 1, end) : '';
      const length = Array.from(digits).length;
      if (length < 1 || length > MAX_HEX_DIGITS) {
        invalid(`Invalid \\${kind}{…} escape${this.at()}.`);
      }
      this.pos = end + 1;
    } else {
      const width = HEX_ESCAPE_DIGITS[kind] ?? 0;
      digits = this.slice(this.pos, this.pos + width);
      if (Array.from(digits).length !== width) {
        invalid(`\\${kind} needs ${String(width)} hex digits${this.at()}.`);
      }
      this.pos += width;
    }
    const cp = parseHex(digits);
    if (cp === null) {
      return invalid(`Invalid hex digits ${pyRepr(digits)} in \\${kind}.`);
    }
    if (cp > MAX_CODE_POINT) {
      invalid(`\\${kind}{${digits}} is beyond U+10FFFF.`);
    }
    if (cp >= HIGH_SURROGATES[0] && cp <= HIGH_SURROGATES[1] && this.startsWith('\\u', this.pos)) {
      const lowText = this.slice(this.pos + 2, this.pos + 6);
      const low = parseHex(lowText);
      if (low !== null && low >= LOW_SURROGATES[0] && low <= LOW_SURROGATES[1]) {
        this.pos += 6;
        return (
          SUPPLEMENTARY +
          (((cp - HIGH_SURROGATES[0]) << SURROGATE_BITS) | (low - LOW_SURROGATES[0]))
        );
      }
    }
    return cp;
  }
}

/** Parse `pattern` under `flags` (any of `imsx`) into an expanded tree. */
export function parse(pattern: string, flags = ''): Pattern {
  const letters = Array.from(flags);
  if (letters.some((f) => !FLAGS.includes(f)) || new Set(letters).size !== letters.length) {
    invalid(
      `Regex flags must be distinct letters from ${pyRepr(FLAGS)}, not ${pyRepr(letters.slice(0, 16).join(''))}.`,
    );
  }
  return new Parser(pattern, [...letters].sort().join('')).parse();
}
