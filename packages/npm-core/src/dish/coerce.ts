// SPDX-License-Identifier: GPL-3.0-or-later
/** Automatic coercion between dish types (PRD §3.2). */

import { UniChefError } from '../errors.js';
import { formatFloat, jsonDumps, jsonLoads, type WarnFn } from './json.js';
import { DISH_TYPES, makeDish, type Cell, type Dish, type DishType, type Table } from './types.js';
import { REPLACEMENT, decode, encode } from './utf8.js';

/** Parse base-10 ASCII with an optional `-`, no `+` and no leading zeros. */
export function parseInteger(text: string): bigint {
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(text) || text === '-0') {
    throw new UniChefError('E_INPUT_TYPE', 'The string is not a base-10 integer.');
  }
  return BigInt(text);
}

const TSV_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '\t': '\\t',
  '\n': '\\n',
  '\r': '\\r',
};

function tsvEscape(s: string): string {
  return s.replace(/[\\\t\n\r]/g, (c) => TSV_ESCAPES[c] ?? c);
}

export function formatCell(cell: Cell): string {
  if (cell === null) {
    return '';
  }
  if (typeof cell === 'boolean') {
    return cell ? 'true' : 'false';
  }
  if (typeof cell === 'number') {
    return formatFloat(cell);
  }
  return cell;
}

/** TSV with a header row. Backslash, tab, CR and LF inside cells are escaped. */
export function tableToTsv(table: Table): string {
  const lines = [table.columns.map(tsvEscape).join('\t')];
  for (const row of table.rows) {
    lines.push(row.map((c) => tsvEscape(formatCell(c))).join('\t'));
  }
  return lines.join('\n');
}

export function tableToJson(table: Table): Map<string, string[] | Cell[][]> {
  return new Map<string, string[] | Cell[][]>([
    ['columns', [...table.columns]],
    ['rows', table.rows.map((r) => [...r])],
  ]);
}

/** Each surrogate code point becomes U+FFFD (PRD §3.2 rule 3). */
export function codepointsToString(cps: readonly number[]): string {
  let out = '';
  for (const cp of cps) {
    out += cp >= 0xd800 && cp <= 0xdfff ? REPLACEMENT : String.fromCodePoint(cp);
  }
  return out;
}

/** Iterate by code point. A lone surrogate is its own code point. */
export function stringToCodepoints(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    out.push(ch.codePointAt(0) ?? 0);
  }
  return out;
}

type Converter = (value: never, warn: WarnFn | undefined) => Dish['value'];

/** Coercion edges, in the order the Python core declares them (BFS tie-breaks). */
const EDGES: readonly (readonly [DishType, DishType, Converter])[] = [
  ['string', 'bytes', (v: string) => encode(v)],
  ['bytes', 'string', (v: Uint8Array) => decode(v)],
  ['codepoints', 'string', (v: readonly number[]) => codepointsToString(v)],
  ['string', 'codepoints', (v: string) => stringToCodepoints(v)],
  ['integer', 'string', (v: bigint) => v.toString()],
  ['string', 'integer', (v: string) => parseInteger(v)],
  ['json', 'string', (v: Parameters<typeof jsonDumps>[0]) => jsonDumps(v)],
  ['string', 'json', (v: string, warn) => jsonLoads(v, warn)],
  ['float', 'string', (v: number) => formatFloat(v)],
  ['table', 'json', (v: Table) => tableToJson(v)],
  ['table', 'string', (v: Table) => tableToTsv(v)],
];

function route(source: DishType, target: DishType): DishType[] | null {
  const previous = new Map<DishType, DishType | null>([[source, null]]);
  const queue: DishType[] = [source];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      break;
    }
    if (node === target) {
      const chain: DishType[] = [];
      let step: DishType | null | undefined = node;
      while (step !== null && step !== undefined) {
        chain.push(step);
        step = previous.get(step);
      }
      return chain.reverse();
    }
    for (const [a, b] of EDGES) {
      if (a === node && !previous.has(b)) {
        previous.set(b, node);
        queue.push(b);
      }
    }
  }
  return null;
}

const ROUTES = new Map<string, DishType[] | null>();
for (const a of DISH_TYPES) {
  for (const b of DISH_TYPES) {
    ROUTES.set(`${a}>${b}`, route(a, b));
  }
}

/** True when a `source` dish can be coerced to `target`. */
export function canCoerce(source: DishType, target: DishType): boolean {
  return ROUTES.get(`${source}>${target}`) != null;
}

/** Convert `dish` to `target` by the §3.2 rules, or throw `E_INPUT_TYPE`. */
export function coerce(dish: Dish, target: DishType, warn?: WarnFn): Dish {
  const chain = ROUTES.get(`${dish.type}>${target}`);
  if (chain == null) {
    throw new UniChefError(
      'E_INPUT_TYPE',
      `A ${dish.type} value cannot be converted to ${target}.`,
    );
  }
  let value: Dish['value'] = dish.value;
  for (let i = 1; i < chain.length; i += 1) {
    const edge = EDGES.find(([a, b]) => a === chain[i - 1] && b === chain[i]);
    if (edge === undefined) {
      throw new UniChefError('E_INTERNAL', 'Missing coercion edge; please report this.');
    }
    value = edge[2](value as never, warn);
  }
  return makeDish(target, value as never);
}
