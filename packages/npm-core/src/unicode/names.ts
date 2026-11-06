// SPDX-License-Identifier: GPL-3.0-or-later
/** Character names, aliases and labels (PRD §4.3, Unicode Standard §4.8). */

import { contains, floorIndex, load, lowerBound, once, type Ranges } from './data.js';
import * as props from './props.js';

// Hangul syllable composition constants (Unicode Standard §3.12).
export const S_BASE = 0xac00;
export const L_COUNT = 19;
export const V_COUNT = 21;
export const T_COUNT = 28;
export const N_COUNT = V_COUNT * T_COUNT;
export const S_COUNT = L_COUNT * N_COUNT;

const HANGUL_O_E = 'HANGULJUNGSEONGO-E';
const HANGUL_O_E_CP = 0x1180;

export interface Alias {
  readonly alias: string;
  readonly type: string;
}

interface NameRange {
  readonly start: number;
  readonly end: number;
  readonly rule: string;
  readonly prefix: string;
}

interface Tables {
  readonly cps: number[];
  readonly names: string[];
  readonly ranges: NameRange[];
  readonly jamo: Readonly<Record<'L' | 'V' | 'T', readonly string[]>>;
}

const tables = once((): Tables => {
  const raw = load('names');
  return {
    cps: raw.names.map(([cp]) => cp),
    names: raw.names.map(([, name]) => name),
    ranges: raw.ranges.map(([start, end, rule, prefix]) => ({ start, end, rule, prefix })),
    jamo: raw.jamo,
  };
});

function rangeFor(cp: number): NameRange | undefined {
  return tables().ranges.find((r) => r.start <= cp && cp <= r.end);
}

const hex4 = (cp: number): string => cp.toString(16).toUpperCase().padStart(4, '0');

function hangulName(prefix: string, cp: number): string {
  const { jamo } = tables();
  const index = cp - S_BASE;
  const lead = Math.floor(index / N_COUNT);
  const rest = index % N_COUNT;
  const vowel = Math.floor(rest / T_COUNT);
  const trail = rest % T_COUNT;
  return `${prefix}${jamo.L[lead] ?? ''}${jamo.V[vowel] ?? ''}${jamo.T[trail] ?? ''}`;
}

/** The Name property, or `""` for code points without one. */
export function name(cp: number): string {
  const algorithmic = rangeFor(cp);
  if (algorithmic !== undefined) {
    return algorithmic.rule === 'NR1'
      ? hangulName(algorithmic.prefix, cp)
      : `${algorithmic.prefix}${hex4(cp)}`;
  }
  const { cps, names } = tables();
  const i = floorIndex(cps, cp);
  return i >= 0 && cps[i] === cp ? (names[i] ?? '') : '';
}

const aliasTable = once((): Map<number, Alias[]> => {
  const out = new Map<number, Alias[]>();
  for (const [cp, alias, type] of load('names').aliases) {
    const list = out.get(cp) ?? [];
    list.push({ alias, type });
    out.set(cp, list);
  }
  return out;
});

export function aliases(cp: number): readonly Alias[] {
  return aliasTable().get(cp) ?? [];
}

/** Every named code point (explicit and algorithmic), ascending, with its name. */
const allNames = once((): [number[], string[]] => {
  const { cps, names, ranges } = tables();
  const pairs: [number, string][] = cps.map((cp, i) => [cp, names[i] ?? '']);
  for (const r of ranges) {
    for (let cp = r.start; cp <= r.end; cp++) {
      pairs.push([cp, name(cp)]);
    }
  }
  pairs.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return [pairs.map(([cp]) => cp), pairs.map(([, n]) => n)];
});

/** Every `[cp, name]` with a non-empty Name inside `within`, ascending. */
export function* iterNames(within: Ranges): Generator<[number, string]> {
  const [cps, names] = allNames();
  for (const [start, end] of within) {
    const hi = floorIndex(cps, end) + 1;
    for (let i = lowerBound(cps, start); i < hi; i++) {
      yield [cps[i] ?? 0, names[i] ?? ''];
    }
  }
}

/** Every `[cp, alias]` inside `within`. */
export function* iterAliases(within: Ranges): Generator<[number, Alias]> {
  for (const [cp, found] of aliasTable()) {
    if (contains(within, cp)) {
      for (const alias of found) {
        yield [cp, alias];
      }
    }
  }
}

/** The name, or a display label such as `<control-0007>` (never a real name). */
export function label(cp: number): string {
  const found = name(cp);
  if (found !== '') {
    return found;
  }
  const category = props.gc(cp);
  let kind: string;
  if (category === 'Cc') {
    kind = 'control';
  } else if (category === 'Co') {
    kind = 'private-use';
  } else if (category === 'Cs') {
    kind = 'surrogate';
  } else if (props.has('Noncharacter_Code_Point', cp)) {
    kind = 'noncharacter';
  } else {
    kind = 'reserved';
  }
  return `<${kind}-${hex4(cp)}>`;
}

/** The name for display: a correction alias wins, then the name, then a control alias. */
export function preferred(cp: number): string {
  const found = aliases(cp);
  const correction = found.find((a) => a.type === 'correction');
  if (correction !== undefined) {
    return correction.alias;
  }
  const current = name(cp);
  if (current !== '') {
    return current;
  }
  const control = found.find((a) => a.type === 'control');
  return control !== undefined ? control.alias : label(cp);
}

// Reverse lookup (UAX44-LM2)

const SPACE_LIKE = new Set([' ', '\t', '\n', '\r', '\f', '\v', '_']);

/** UAX44-LM2: ignore case, whitespace, underscores and medial hyphens (except O-E). */
export function looseName(text: string): string {
  const upper = text.replace(/[a-z]/g, (c) => c.toUpperCase());
  const chars = Array.from(upper);
  const kept: string[] = [];
  chars.forEach((ch, i) => {
    if (SPACE_LIKE.has(ch)) {
      return;
    }
    const medial = i > 0 && i < chars.length - 1 && chars[i - 1] !== ' ' && chars[i + 1] !== ' ';
    if (ch === '-' && medial) {
      return;
    }
    kept.push(ch);
  });
  const spaced = chars.filter((ch) => !SPACE_LIKE.has(ch)).join('');
  return spaced === HANGUL_O_E ? HANGUL_O_E : kept.join('');
}

const reverse = once((): Map<string, number> => {
  const { cps, names, ranges } = tables();
  const index = new Map<string, number>();
  cps.forEach((cp, i) => index.set(looseName(names[i] ?? ''), cp));
  for (const [cp, found] of aliasTable()) {
    for (const alias of found) {
      const key = looseName(alias.alias);
      if (!index.has(key)) {
        index.set(key, cp);
      }
    }
  }
  for (const r of ranges) {
    if (r.rule === 'NR1') {
      for (let cp = r.start; cp <= r.end; cp++) {
        index.set(looseName(hangulName(r.prefix, cp)), cp);
      }
    }
  }
  index.set(HANGUL_O_E, HANGUL_O_E_CP);
  return index;
});

/** The code point whose name or alias loosely matches `text`, or null. */
export function lookup(text: string): number | null {
  const key = looseName(text);
  const found = reverse().get(key);
  if (found !== undefined) {
    return found;
  }
  for (const r of tables().ranges) {
    if (r.rule !== 'NR2') {
      continue;
    }
    const prefix = looseName(`${r.prefix}0`).slice(0, -1);
    const digits = key.slice(prefix.length);
    if (key.startsWith(prefix) && /^[0-9A-F]{4,6}$/.test(digits)) {
      const cp = parseInt(digits, 16);
      if (r.start <= cp && cp <= r.end && hex4(cp) === digits) {
        return cp;
      }
    }
  }
  return null;
}
