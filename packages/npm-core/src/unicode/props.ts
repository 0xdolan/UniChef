// SPDX-License-Identifier: GPL-3.0-or-later
/** Character properties from `ucd-core` (PRD §4.2, §16.3 range and block lookup). */

import { UniChefError } from '../errors.js';
import { pyRepr } from '../ops/types.js';
import {
  complement,
  floorIndex,
  intersect,
  load,
  memo,
  once,
  RangeSet,
  RangeTable,
  union,
  type Ranges,
  type Value,
} from './data.js';

export const ENUMERATED = [
  'gc', 'sc', 'blk', 'age', 'bc', 'ccc', 'ea', 'lb', 'GCB', 'InCB',
  'NFC_QC', 'NFD_QC', 'NFKC_QC', 'NFKD_QC',
] as const; // prettier-ignore

/** General_Category groupings (Unicode Standard §4.5, PropertyValueAliases.txt comments). */
export const GC_GROUPS: Readonly<Record<string, ReadonlySet<string>>> = {
  L: new Set(['Lu', 'Ll', 'Lt', 'Lm', 'Lo']),
  LC: new Set(['Lu', 'Ll', 'Lt']),
  M: new Set(['Mn', 'Mc', 'Me']),
  N: new Set(['Nd', 'Nl', 'No']),
  P: new Set(['Pc', 'Pd', 'Ps', 'Pe', 'Pi', 'Pf', 'Po']),
  S: new Set(['Sm', 'Sc', 'Sk', 'So']),
  Z: new Set(['Zs', 'Zl', 'Zp']),
  C: new Set(['Cc', 'Cf', 'Cs', 'Co', 'Cn']),
};

/** UAX44-LM3: ignore ASCII case, whitespace, underscores, hyphens and an initial "is". */
export function loose(text: string): string {
  const key = text.replace(/[A-Z]/g, (c) => c.toLowerCase()).replace(/[ \t\n\r\f\v_-]/g, '');
  return key.startsWith('is') && key.length > 2 ? key.slice(2) : key;
}

/** A stored per-property table; a missing key is a bug in the caller (E_INTERNAL). */
function stored<T>(tables: Readonly<Record<string, T>>, prop: string): T {
  const found = tables[prop];
  if (found === undefined) {
    throw new UniChefError('E_INTERNAL', `No stored table for property ${prop}.`);
  }
  return found;
}

export const table = memo(
  (prop: string): RangeTable => new RangeTable(stored(load('core').props, prop)),
);

export const binary = memo(
  (prop: string): RangeSet => new RangeSet(stored(load('core').binary, prop)),
);

export function binaryNames(): string[] {
  return Object.keys(load('core').binary);
}

export function get(prop: string, cp: number): Value {
  return table(prop).get(cp);
}

export function gc(cp: number): string {
  return String(table('gc').get(cp));
}

export function sc(cp: number): string {
  return String(table('sc').get(cp));
}

export function ccc(cp: number): number {
  return Number(table('ccc').get(cp));
}

export function has(prop: string, cp: number): boolean {
  return binary(prop).has(cp);
}

const scxData = once((): [RangeTable, readonly (readonly string[])[]] => {
  const raw = load('core').scx;
  const values = raw.sets.map((_, i) => i);
  return [new RangeTable({ default: -1, values, ranges: raw.ranges }), raw.sets];
});

/** Script_Extensions; a code point outside every range has `[sc]`. */
export function scx(cp: number): readonly string[] {
  const [ranges, sets] = scxData();
  const index = ranges.get(cp) as number;
  return index === -1 ? [sc(cp)] : (sets[index] ?? []);
}

const blocks = once((): [number[], number[], string[]] => {
  const raw = load('core').blocks;
  return [raw.map((b) => b.start), raw.map((b) => b.end), raw.map((b) => b.name)];
});

/** Block name as written in Blocks.txt, or `No_Block`. */
export function block(cp: number): string {
  const [starts, ends, names] = blocks();
  const i = floorIndex(starts, cp);
  return i >= 0 && cp <= (ends[i] ?? 0) ? (names[i] ?? '') : 'No_Block';
}

// Property and value name resolution (UAX44-LM3)

const propIndex = once((): Map<string, string> => {
  const aliases = load('core').aliases.prop;
  const index = new Map<string, string>();
  for (const [alias, short] of Object.entries(aliases)) {
    index.set(loose(alias), short);
  }
  const stored = new Map<string, string>();
  for (const key of binaryNames()) {
    stored.set(index.get(loose(key)) ?? key, key);
  }
  const out = new Map<string, string>();
  for (const [alias, short] of index) {
    out.set(alias, stored.get(short) ?? short);
  }
  for (const key of binaryNames()) {
    out.set(loose(key), key);
  }
  return out;
});

const valueIndex = memo((prop: string): Map<string, string> => {
  const all = load('core').aliases.values;
  const out = new Map<string, string>();
  for (const [alias, stored] of Object.entries(all[prop] ?? {})) {
    out.set(loose(alias), stored);
  }
  return out;
});

/**
 * The stored property key for any alias, or `E_ARG_INVALID`. Enumerated properties
 * resolve to their short name (`gc`), binary ones to the key of their table
 * (`White_Space`, `ExtPict`).
 */
export function resolveProperty(name: string): string {
  const short = propIndex().get(loose(name));
  if (short === undefined) {
    throw new UniChefError('E_ARG_INVALID', `Unknown Unicode property ${pyRepr(name)}.`);
  }
  return short;
}

export function isBinary(prop: string): boolean {
  return prop in load('core').binary || prop === 'ExtPict';
}

/** The stored value for `value` of the enumerated property `prop`. */
export function resolveValue(prop: string, value: string): string {
  if (prop === 'ccc' && /^[0-9]+$/.test(value)) {
    return value;
  }
  const stored = valueIndex(prop).get(loose(value));
  if (stored === undefined) {
    throw new UniChefError('E_ARG_INVALID', `Unknown value ${pyRepr(value)} for property ${prop}.`);
  }
  return stored;
}

/** Code points where the (resolved) property has the (resolved) value. */
export function rangesFor(prop: string, value: string): Ranges {
  if (prop === 'gc') {
    return table('gc').rangesWhere(GC_GROUPS[value] ?? new Set([value]));
  }
  if (prop === 'ccc') {
    return table('ccc').rangesWhere(new Set([Number(value)]));
  }
  if (prop === 'scx') {
    return scxRanges(value);
  }
  return table(prop).rangesWhere(new Set([value]));
}

/** Code points whose Script_Extensions contain `script`. */
export const scxRanges = memo((script: string): Ranges => {
  const [ranges, sets] = scxData();
  const wanted = new Set<Value>();
  sets.forEach((s, i) => {
    if (s.includes(script)) {
      wanted.add(i);
    }
  });
  const explicit = ranges.rangesWhere(wanted);
  const covered = ranges.rangesWhere(new Set(sets.map((_, i) => i)));
  const plain = intersect(table('sc').rangesWhere(new Set([script])), complement(covered));
  return union(explicit, plain);
});

export function binaryRanges(prop: string): Ranges {
  return binary(prop).ranges();
}
