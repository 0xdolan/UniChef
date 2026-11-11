// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Full case mapping and case folding (Unicode Standard §3.13, PRD §4.5).
 *
 * Never uses `toUpperCase()` and friends: the host's tables follow its own Unicode version.
 */

import { fromCodePoints, intMap, load, once, toCodePoints } from './data.js';
import * as props from './props.js';

export type Mapping = 'lower' | 'title' | 'upper';
export type Locale = 'none' | 'tr' | 'az' | 'lt';
export const LOCALES: readonly Locale[] = ['none', 'tr', 'az', 'lt'];

const COLUMN: Record<Mapping, number> = { lower: 0, title: 1, upper: 2 };
const ABOVE = 230;
const COMBINING_DOT_ABOVE = 0x0307;
const CAPITAL_I = 0x0049;
const TITLE_WORD_CHARS = new Set(['L', 'M', 'N']);

type CaseMap = Map<number, readonly number[]>;

interface Special {
  readonly columns: readonly (readonly number[])[];
  readonly language: string | null;
  readonly context: readonly string[];
}

const maps = once((): Record<string, CaseMap> => {
  const raw = load('core').case as Record<string, Record<string, number[]>>;
  const out: Record<string, CaseMap> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'special') {
      out[key] = intMap(value);
    }
  }
  return out;
});

function caseMap(name: string): CaseMap {
  return maps()[name] ?? new Map<number, readonly number[]>();
}

const special = once((): Map<number, Special[]> => {
  const raw = (load('core').case as { special: [number, number[], number[], number[], string][] })
    .special;
  const out = new Map<number, Special[]>();
  for (const [cp, lower, title, upper, conditions] of raw) {
    const words = conditions.split(/\s+/).filter((w) => w !== '');
    const first = words[0];
    const language = first !== undefined && /^[a-z]+$/.test(first) ? first : null;
    const context = language === null ? words : words.slice(1);
    const list = out.get(cp) ?? [];
    list.push({ columns: [lower, title, upper], language, context });
    out.set(cp, list);
  }
  return out;
});

// Casing contexts (Unicode Standard Table 3-17)

function finalSigma(cps: readonly number[], i: number): boolean {
  let j = i - 1;
  while (j >= 0 && props.has('Case_Ignorable', cps[j] ?? 0)) {
    j--;
  }
  if (j < 0 || !props.has('Cased', cps[j] ?? 0)) {
    return false;
  }
  j = i + 1;
  while (j < cps.length && props.has('Case_Ignorable', cps[j] ?? 0)) {
    j++;
  }
  return j >= cps.length || !props.has('Cased', cps[j] ?? 0);
}

function scanBack(cps: readonly number[], i: number, hit: (cp: number) => boolean): boolean {
  for (let j = i - 1; j >= 0; j--) {
    const cp = cps[j] ?? 0;
    if (hit(cp)) {
      return true;
    }
    const cc = props.ccc(cp);
    if (cc === 0 || cc === ABOVE) {
      return false;
    }
  }
  return false;
}

function scanForward(
  cps: readonly number[],
  i: number,
  hit: (cp: number) => boolean,
  stop: ReadonlySet<number>,
): boolean {
  for (let j = i + 1; j < cps.length; j++) {
    const cp = cps[j] ?? 0;
    if (hit(cp)) {
      return true;
    }
    if (stop.has(props.ccc(cp))) {
      return false;
    }
  }
  return false;
}

const STOP_STARTER = new Set([0]);
const STOP_STARTER_OR_ABOVE = new Set([0, ABOVE]);

function holds(condition: string, cps: readonly number[], i: number): boolean {
  const negate = condition.startsWith('Not_');
  const name = negate ? condition.slice(4) : condition;
  let result: boolean;
  switch (name) {
    case 'Final_Sigma':
      result = finalSigma(cps, i);
      break;
    case 'After_Soft_Dotted':
      result = scanBack(cps, i, (cp) => props.has('Soft_Dotted', cp));
      break;
    case 'More_Above':
      result = scanForward(cps, i, (cp) => props.ccc(cp) === ABOVE, STOP_STARTER);
      break;
    case 'Before_Dot':
      result = scanForward(cps, i, (cp) => cp === COMBINING_DOT_ABOVE, STOP_STARTER_OR_ABOVE);
      break;
    case 'After_I':
      result = scanBack(cps, i, (cp) => cp === CAPITAL_I);
      break;
    default:
      throw new Error(`unknown casing condition ${condition}`);
  }
  return result !== negate;
}

function mapOne(
  cps: readonly number[],
  i: number,
  mapping: Mapping,
  locale: Locale,
): readonly number[] {
  const cp = cps[i] ?? 0;
  for (const entry of special().get(cp) ?? []) {
    if (entry.language !== null && entry.language !== locale) {
      continue;
    }
    if (entry.context.every((c) => holds(c, cps, i))) {
      return entry.columns[COLUMN[mapping]] ?? [cp];
    }
  }
  return caseMap(mapping).get(cp) ?? [cp];
}

/** True when no letter, mark or number precedes `i` (Case_Ignorable skipped). */
function wordStart(cps: readonly number[], i: number): boolean {
  let j = i - 1;
  while (j >= 0 && props.has('Case_Ignorable', cps[j] ?? 0)) {
    j--;
  }
  return j < 0 || !TITLE_WORD_CHARS.has(props.gc(cps[j] ?? 0).charAt(0));
}

/**
 * Upper-, lower- or title-case `text` with full mappings and casing contexts.
 *
 * `titlecase` maps a cased character to titlecase when no letter, mark or number precedes
 * it (case-ignorable characters such as apostrophes are skipped), and every other
 * character to lowercase.
 */
export function convert(
  text: string,
  mapping: Mapping | 'titlecase',
  locale: Locale = 'none',
): string {
  const cps = toCodePoints(text);
  const out: number[] = [];
  for (let i = 0; i < cps.length; i++) {
    let target: Mapping;
    if (mapping === 'titlecase') {
      const word = props.has('Cased', cps[i] ?? 0) && wordStart(cps, i);
      target = word ? 'title' : 'lower';
    } else {
      target = mapping;
    }
    for (const m of mapOne(cps, i, target, locale)) {
      out.push(m);
    }
  }
  return fromCodePoints(out);
}

export const upper = (text: string, locale: Locale = 'none'): string =>
  convert(text, 'upper', locale);
export const lower = (text: string, locale: Locale = 'none'): string =>
  convert(text, 'lower', locale);
export const title = (text: string, locale: Locale = 'none'): string =>
  convert(text, 'titlecase', locale);

export function foldCodePoint(
  cp: number,
  options: { simple?: boolean; turkic?: boolean } = {},
): readonly number[] {
  if (options.turkic === true) {
    const t = caseMap('foldTurkic').get(cp);
    if (t !== undefined) {
      return t;
    }
  }
  if (options.simple === true) {
    const s = caseMap('foldSimple').get(cp);
    if (s !== undefined) {
      return s;
    }
    const full = caseMap('fold').get(cp);
    return full?.length === 1 ? full : [cp];
  }
  return caseMap('fold').get(cp) ?? [cp];
}

/** Case folding: full (C+F) by default, simple (C+S) on request, T entries for tr/az. */
export function fold(text: string, options: { simple?: boolean; locale?: Locale } = {}): string {
  const turkic = options.locale === 'tr' || options.locale === 'az';
  const simple = options.simple ?? false;
  const out: number[] = [];
  for (const cp of toCodePoints(text)) {
    for (const m of foldCodePoint(cp, { simple, turkic })) {
      out.push(m);
    }
  }
  return fromCodePoints(out);
}

/**
 * Every code point that simple case folding touches, mapped to all code points sharing
 * its simple fold (itself included), ascending. Drives case-insensitive regex classes.
 */
export const simpleFoldOrbits = once((): Map<number, readonly number[]> => {
  const members = new Set<number>(caseMap('foldSimple').keys());
  for (const [cp, f] of caseMap('fold')) {
    if (f.length === 1) {
      members.add(cp);
    }
  }
  const groups = new Map<number, Set<number>>();
  for (const cp of members) {
    const target = foldCodePoint(cp, { simple: true })[0] ?? cp;
    let group = groups.get(target);
    if (group === undefined) {
      group = new Set([target]);
      groups.set(target, group);
    }
    group.add(cp);
  }
  const out = new Map<number, readonly number[]>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a - b);
    for (const cp of group) {
      out.set(cp, sorted);
    }
  }
  return out;
});
