// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Unicode normalization forms NFC, NFD, NFKC and NFKD (UAX #15, PRD §4.4).
 *
 * Built only from `ucd-core`: decompositions, canonical combining classes and
 * Full_Composition_Exclusion. Hangul syllables are handled algorithmically.
 */

import { fromCodePoints, load, once, RangeSet, toCodePoints } from './data.js';
import { N_COUNT, S_BASE, S_COUNT, T_COUNT } from './names.js';
import * as props from './props.js';

export type Form = 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
export const FORMS: readonly Form[] = ['NFC', 'NFD', 'NFKC', 'NFKD'];

export const L_BASE = 0x1100;
export const V_BASE = 0x1161;
export const T_BASE = 0x11a7;
const L_END = L_BASE + 19;
const V_END = V_BASE + 21;
const T_END = T_BASE + T_COUNT;
const ASCII_END = 0x80;

type Decomp = Map<number, readonly number[]>;

const rawDecomp = () => load('core').decomp;

/** Single-level canonical and compatibility (canonical included) mappings. */
const decompositions = once((): [Decomp, Decomp] => {
  const canonical: Decomp = new Map();
  const compat: Decomp = new Map();
  for (const [key, [tag, cps]] of Object.entries(rawDecomp())) {
    const cp = Number(key);
    compat.set(cp, cps);
    if (tag === '') {
      canonical.set(cp, cps);
    }
  }
  return [canonical, compat];
});

function expand(single: Decomp): Decomp {
  const full = (cp: number): number[] => {
    const mapping = single.get(cp);
    return mapping === undefined ? [cp] : mapping.flatMap(full);
  };
  const out: Decomp = new Map();
  for (const cp of single.keys()) {
    out.set(cp, full(cp));
  }
  return out;
}

/** Full (recursive) canonical and compatibility decompositions, computed once. */
const fullTables = once((): [Decomp, Decomp] => {
  const [canonical, compat] = decompositions();
  return [expand(canonical), expand(compat)];
});

function full(cp: number, compat: boolean): readonly number[] {
  if (S_BASE <= cp && cp < S_BASE + S_COUNT) {
    const index = cp - S_BASE;
    const lead = Math.floor(index / N_COUNT);
    const rest = index % N_COUNT;
    const vowel = Math.floor(rest / T_COUNT);
    const trail = rest % T_COUNT;
    const parts = [L_BASE + lead, V_BASE + vowel];
    return trail !== 0 ? [...parts, T_BASE + trail] : parts;
  }
  return fullTables()[compat ? 1 : 0].get(cp) ?? [cp];
}

/**
 * The single-level Decomposition_Mapping with its tag (`""` for canonical, else e.g.
 * `"<compat>"`), Hangul syllables included; null when the code point has none.
 */
export function decomposition(cp: number): [string, readonly number[]] | null {
  if (S_BASE <= cp && cp < S_BASE + S_COUNT) {
    const index = cp - S_BASE;
    const trail = index % T_COUNT;
    if (trail !== 0) {
      return ['', [cp - trail, T_BASE + trail]];
    }
    const lead = Math.floor(index / N_COUNT);
    const rest = index % N_COUNT;
    return ['', [L_BASE + lead, V_BASE + Math.floor(rest / T_COUNT)]];
  }
  const found = rawDecomp()[String(cp)];
  return found === undefined ? null : [found[0], found[1]];
}

const exclusions = once(() => new RangeSet(load('core').compExcl));

/** Primary composites keyed by `first * 0x110000 + second`. */
const compositions = once((): Map<number, number> => {
  const excluded = exclusions();
  const out = new Map<number, number>();
  for (const [cp, pair] of decompositions()[0]) {
    if (pair.length === 2 && !excluded.has(cp)) {
      out.set((pair[0] ?? 0) * 0x110000 + (pair[1] ?? 0), cp);
    }
  }
  return out;
});

/** Canonical ordering: stable-sort each run of non-starters by ccc, in place. */
function reorder(cps: number[]): void {
  let i = 0;
  const n = cps.length;
  while (i < n) {
    if (props.ccc(cps[i] ?? 0) === 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && props.ccc(cps[j] ?? 0) !== 0) {
      j++;
    }
    if (j - i > 1) {
      // Array.prototype.sort is stable, as Python's sorted() is.
      const run = cps.slice(i, j).sort((a, b) => props.ccc(a) - props.ccc(b));
      run.forEach((cp, k) => (cps[i + k] = cp));
    }
    i = j;
  }
}

function composePair(first: number, second: number): number | undefined {
  if (L_BASE <= first && first < L_END && V_BASE <= second && second < V_END) {
    return S_BASE + ((first - L_BASE) * 21 + (second - V_BASE)) * T_COUNT;
  }
  if (
    S_BASE <= first &&
    first < S_BASE + S_COUNT &&
    (first - S_BASE) % T_COUNT === 0 &&
    T_BASE < second &&
    second < T_END
  ) {
    return first + (second - T_BASE);
  }
  return compositions().get(first * 0x110000 + second);
}

/** Canonical composition (UAX #15 §1.3, D117). */
function compose(cps: number[]): number[] {
  const out: number[] = [];
  let starter = -1; // index in `out` of the last starter, or -1
  let lastCcc = -1;
  for (const cp of cps) {
    const cc = props.ccc(cp);
    if (starter >= 0 && (lastCcc < cc || (lastCcc === 0 && out.length - 1 === starter))) {
      const composed = composePair(out[starter] ?? 0, cp);
      if (composed !== undefined) {
        out[starter] = composed;
        continue;
      }
    }
    if (cc === 0) {
      starter = out.length;
    }
    lastCcc = cc;
    out.push(cp);
  }
  return out;
}

export function decompose(cps: readonly number[], compat: boolean, check?: () => void): number[] {
  const out: number[] = [];
  cps.forEach((cp, i) => {
    if (check !== undefined && i % 65536 === 0) {
      check();
    }
    for (const p of full(cp, compat)) {
      out.push(p);
    }
  });
  reorder(out);
  return out;
}

export function normalizeCodePoints(
  form: Form,
  cps: readonly number[],
  check?: () => void,
): number[] {
  const decomposed = decompose(cps, form === 'NFKC' || form === 'NFKD', check);
  return form === 'NFC' || form === 'NFKC' ? compose(decomposed) : decomposed;
}

/** Normalize `text`; lone surrogates pass through unchanged. */
export function normalize(form: Form, text: string, check?: () => void): string {
  let ascii = true;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) >= ASCII_END) {
      ascii = false;
      break;
    }
  }
  if (ascii) {
    return text;
  }
  return fromCodePoints(normalizeCodePoints(form, toCodePoints(text), check));
}
