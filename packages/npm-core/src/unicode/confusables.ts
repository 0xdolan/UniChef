// SPDX-License-Identifier: GPL-3.0-or-later
/** UTS #39 confusable skeletons, identifier status and type, script resolution (PRD §4.7). */

import { fromCodePoints, intMap, load, once, RangeSet, RangeTable, toCodePoints } from './data.js';
import { decompose } from './normalize.js';
import * as props from './props.js';

export const COMMON = 'Zyyy';
export const INHERITED = 'Zinh';

const table = once(() => intMap(load('security').confusables));

/** The confusables.txt (MA) prototype for `cp`, or null if it has no mapping. */
export function prototype(cp: number): readonly number[] | null {
  return table().get(cp) ?? null;
}

/** UTS #39 §4: NFD, map each code point through confusables.txt, NFD again. */
export function skeleton(text: string): string {
  const first = decompose(toCodePoints(text), false);
  const mapped = first.flatMap((cp) => table().get(cp) ?? [cp]);
  return fromCodePoints(decompose(mapped, false));
}

export function isConfusable(a: string, b: string): boolean {
  return skeleton(a) === skeleton(b);
}

const idStatus = once(() => new RangeSet(load('security').idStatus.allowed));

/** `Allowed` or `Restricted` (IdentifierStatus.txt). */
export function identifierStatus(cp: number): string {
  return idStatus().has(cp) ? 'Allowed' : 'Restricted';
}

const idType = once((): [RangeTable, readonly (readonly string[])[], string] => {
  const raw = load('security').idType;
  const values = raw.sets.map((_, i) => i);
  return [new RangeTable({ default: -1, values, ranges: raw.ranges }), raw.sets, raw.default];
});

export function identifierTypes(cp: number): readonly string[] {
  const [ranges, sets, def] = idType();
  const index = ranges.get(cp) as number;
  return index === -1 ? [def] : (sets[index] ?? []);
}

/** UTS #39 §5.1 augmented script set; null means "all scripts" (Common, Inherited). */
export function augmentedScripts(cp: number): ReadonlySet<string> | null {
  const scripts = new Set(props.scx(cp));
  if (scripts.has(COMMON) || scripts.has(INHERITED)) {
    return null;
  }
  if (scripts.has('Hani')) {
    scripts.add('Hanb').add('Jpan').add('Kore');
  }
  if (scripts.has('Hira') || scripts.has('Kana')) {
    scripts.add('Jpan');
  }
  if (scripts.has('Hang')) {
    scripts.add('Kore');
  }
  if (scripts.has('Bopo')) {
    scripts.add('Hanb');
  }
  return scripts;
}

export function intersection(a: ReadonlySet<string>, b: ReadonlySet<string>): Set<string> {
  return new Set([...a].filter((x) => b.has(x)));
}

/** Intersection of the augmented script sets; null means "all scripts". */
export function resolvedScriptSet(text: string): ReadonlySet<string> | null {
  let resolved: ReadonlySet<string> | null = null;
  for (const cp of toCodePoints(text)) {
    const scripts = augmentedScripts(cp);
    if (scripts !== null) {
      resolved = resolved === null ? scripts : intersection(resolved, scripts);
    }
  }
  return resolved;
}
