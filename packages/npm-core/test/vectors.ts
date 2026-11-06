// SPDX-License-Identifier: GPL-3.0-or-later
/** Shared test helpers: the spec/vectors dish format (spec/README.md). */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { jsonLoads } from '../src/dish/json.js';
import type { Cell, Dish, JsonObject, JsonValue } from '../src/dish/types.js';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const VECTORS = join(REPO, 'spec', 'vectors');

export interface VectorFile {
  readonly path: string;
  readonly dir: string;
  readonly stem: string;
  readonly doc: JsonObject;
}

/** Every `spec/vectors/<dir>/<name>.json`, parsed with key order and big integers kept. */
export function vectorFiles(): VectorFile[] {
  const out: VectorFile[] = [];
  for (const dir of readdirSync(VECTORS).sort()) {
    let names: string[];
    try {
      names = readdirSync(join(VECTORS, dir)).filter((n) => n.endsWith('.json'));
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      const path = join(VECTORS, dir, name);
      const doc = jsonLoads(readFileSync(path, 'utf8'));
      if (!(doc instanceof Map)) {
        throw new Error(`${path}: not an object`);
      }
      out.push({ path, dir, stem: name.slice(0, -5), doc });
    }
  }
  return out;
}

export function get(obj: JsonValue | undefined, key: string): JsonValue | undefined {
  return obj instanceof Map ? obj.get(key) : undefined;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

/** Build a dish from the vector form. */
export function dishFromVector(raw: JsonValue | undefined): Dish {
  const type = get(raw, 'type');
  switch (type) {
    case 'bytes':
      return { type, value: hexToBytes(get(raw, 'hex') as string) };
    case 'string':
      return { type, value: get(raw, 'text') as string };
    case 'codepoints':
      return { type, value: (get(raw, 'values') as JsonValue[]).map(Number) };
    case 'integer':
      return { type, value: BigInt(get(raw, 'value') as number | bigint | string) };
    case 'float':
      return { type, value: Number(get(raw, 'value')) };
    case 'json':
      return { type, value: get(raw, 'value') ?? null };
    case 'table': {
      const v = get(raw, 'value');
      return {
        type,
        value: {
          columns: get(v, 'columns') as string[],
          rows: (get(v, 'rows') as Cell[][]).map((r) =>
            r.map((c) => (typeof c === 'bigint' ? Number(c) : c)),
          ),
        },
      };
    }
    default:
      throw new Error(`unknown dish type ${typeof type === 'string' ? type : typeof type}`);
  }
}

/** Python `==` on JSON data: numbers compare by value and object key order is ignored. */
export function pyEqual(a: unknown, b: unknown): boolean {
  const num = (x: unknown): boolean => typeof x === 'number' || typeof x === 'bigint';
  if (num(a) && num(b)) {
    if (typeof a === 'bigint' || typeof b === 'bigint') {
      try {
        return BigInt(a as number) === BigInt(b as number);
      } catch {
        return false; // a non-integral number never equals a bigint
      }
    }
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => pyEqual(x, b[i]));
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }
    for (const [k, v] of a) {
      if (!b.has(k) || !pyEqual(v, b.get(k))) {
        return false;
      }
    }
    return true;
  }
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
}

export function dishEqual(a: Dish, b: Dish): boolean {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === 'table' && b.type === 'table') {
    return pyEqual(a.value.columns, b.value.columns) && pyEqual(a.value.rows, b.value.rows);
  }
  return pyEqual(a.value, b.value);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A readable form of a dish for assertion messages. */
export function showDish(dish: Dish): string {
  if (dish.type === 'bytes') {
    return `bytes ${hex(dish.value)}`;
  }
  return `${dish.type} ${JSON.stringify(dish.value, (_k, v: unknown): unknown =>
    typeof v === 'bigint' ? `${v}n` : v instanceof Map ? Object.fromEntries(v) : v,
  )}`;
}
