// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Serialise a parsed portable regex for the JavaScript engine (PRD §4.9, §16.3).
 *
 * The output uses `\u{…}` escapes and runs with the `v` flag only (plus `d` and `g` for
 * match indices and positioned searches, which change no semantics). Every class and
 * anchor is spelled out, so the host's Unicode tables are never consulted.
 */

import { complement, MAX_CODE_POINT, type Ranges } from '../unicode/data.js';
import * as profile from './profile.js';
import type { AnchorKind, Node } from './profile.js';

export const JS_FLAGS = 'v';
export const CACHE_SIZE = 256;
const ASCII_END = 0x80;
const GROUP_OPEN: Readonly<Record<string, string>> = {
  capture: '(',
  group: '(?:',
  ahead: '(?=',
  'not-ahead': '(?!',
  behind: '(?<=',
  'not-behind': '(?<!',
};
const NOTHING = '(?!)';

/** A pattern in the JavaScript dialect, plus its capture-group layout. */
export interface Translation {
  readonly source: string;
  readonly flags: string;
  readonly js: string;
  readonly groups: number;
  readonly names: readonly string[];
  readonly groupIndex: ReadonlyMap<string, number>;
}

function escape(cp: number): string {
  if (cp < ASCII_END && /^[A-Za-z0-9]$/.test(String.fromCodePoint(cp))) {
    return String.fromCodePoint(cp);
  }
  return `\\u{${cp.toString(16).toUpperCase()}}`;
}

function charClass(ranges: Ranges): string {
  const first = ranges[0];
  if (first === undefined) {
    return NOTHING;
  }
  if (ranges.length === 1 && first[0] === first[1]) {
    return escape(first[0]);
  }
  if (ranges.length === 1 && first[0] === 0 && first[1] === MAX_CODE_POINT) {
    return `[${escape(0)}-${escape(MAX_CODE_POINT)}]`;
  }
  const inverse = complement(ranges);
  const negate = inverse.length < ranges.length;
  const body = (negate ? inverse : ranges)
    .map(([a, b]) => (a === b ? escape(a) : `${escape(a)}-${escape(b)}`))
    .join('');
  return negate ? `[^${body}]` : `[${body}]`;
}

let wordClass: string | undefined;

function anchor(kind: AnchorKind): string {
  if (kind === 'start') {
    return '^';
  }
  if (kind === 'end') {
    return '$';
  }
  if (kind === 'line-start' || kind === 'line-end') {
    const other = charClass(complement(profile.LINE_TERMINATORS));
    return kind === 'line-start' ? `(?<!${other})` : `(?!${other})`;
  }
  wordClass ??= charClass(profile.word());
  const w = wordClass;
  if (kind === 'word') {
    return `(?:(?<=${w})(?!${w})|(?<!${w})(?=${w}))`;
  }
  return `(?:(?<=${w})(?=${w})|(?<!${w})(?!${w}))`;
}

function atomic(node: Node): string {
  const text = serialise(node);
  // JavaScript cannot repeat a lookahead, so the empty class `(?!)` is wrapped too.
  const bare =
    (node.type === 'chars' && text !== NOTHING) || node.type === 'group' || node.type === 'backref';
  return bare ? text : `(?:${text})`;
}

function count(low: number, high: number | null): string {
  if (low === 0 && high === null) {
    return '*';
  }
  if (low === 1 && high === null) {
    return '+';
  }
  if (low === 0 && high === 1) {
    return '?';
  }
  if (high === null) {
    return `{${String(low)},}`;
  }
  return low === high ? `{${String(low)}}` : `{${String(low)},${String(high)}}`;
}

/** Serialise one node (and its children). */
export function serialise(node: Node): string {
  switch (node.type) {
    case 'chars':
      return charClass(node.ranges);
    case 'seq':
      return node.items
        .map((item) => (item.type === 'alt' ? `(?:${serialise(item)})` : serialise(item)))
        .join('');
    case 'alt':
      return node.branches.map(serialise).join('|');
    case 'group': {
      const head = node.name !== null ? `(?<${node.name}>` : (GROUP_OPEN[node.kind] ?? '(');
      return `${head}${serialise(node.body)})`;
    }
    case 'quant':
      return `${atomic(node.body)}${count(node.min, node.max)}${node.lazy ? '?' : ''}`;
    case 'backref':
      return typeof node.ref === 'string' ? `(?:\\k<${node.ref}>)` : `(?:\\${String(node.ref)})`;
    case 'anchor':
      return anchor(node.kind);
  }
}

/** A small least-recently-used cache (Python's `functools.lru_cache`). */
export function lru<T>(size: number, fn: (key: string) => T): (key: string) => T {
  const cache = new Map<string, T>();
  return (key) => {
    const hit = cache.get(key);
    if (hit !== undefined) {
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const value = fn(key);
    cache.set(key, value);
    if (cache.size > size) {
      const oldest = cache.keys().next();
      if (oldest.done !== true) {
        cache.delete(oldest.value);
      }
    }
    return value;
  };
}

const cached = lru(CACHE_SIZE, (key: string): Translation => {
  const [pattern, flags] = JSON.parse(key) as [string, string];
  const parsed = profile.parse(pattern, flags);
  return {
    source: pattern,
    flags: parsed.flags,
    js: serialise(parsed.root),
    groups: parsed.groups,
    names: parsed.names,
    groupIndex: parsed.groupIndex,
  };
});

/** Parse, check and serialise `pattern` (LRU-cached). Needs `ready('core')`. */
export function translate(pattern: string, flags = ''): Translation {
  return cached(JSON.stringify([pattern, flags]));
}
