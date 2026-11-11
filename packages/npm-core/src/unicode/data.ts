// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The compiled UCD artefacts (PRD §4.1.3, §4.2; format in data/ucd/README.md).
 *
 * Every Unicode answer comes from these files, never from the host's tables. Loading is
 * async; call `await ready()` once (ops do) and every lookup after that is synchronous.
 */

import { loadData } from '../data/load.js';
import { UniChefError } from '../errors.js';

export const UCD_VERSION = '18.0.0';
export const MAX_CODE_POINT = 0x10ffff;

export type Artefact = 'core' | 'names' | 'security';
export type Value = string | number;
/** One inclusive code-point range. */
export type Range = readonly [number, number];
/** Sorted, disjoint, non-adjacent inclusive ranges. */
export type Ranges = Range[];

/** The JSON shape of an enumerated property table. */
export interface RawTable {
  readonly default: Value;
  readonly values: readonly Value[];
  readonly ranges: readonly number[];
}

/** A table of code-point sets: `ranges` index into `sets`. */
export interface RawSets {
  readonly sets: readonly (readonly string[])[];
  readonly ranges: readonly number[];
}

/** The artefact shapes, as documented in data/ucd/README.md. */
export interface Artefacts {
  core: {
    readonly version: string;
    readonly props: Readonly<Record<string, RawTable>>;
    readonly binary: Readonly<Record<string, readonly number[]>>;
    readonly scx: RawSets;
    readonly blocks: readonly { start: number; end: number; name: string }[];
    readonly aliases: {
      readonly prop: Readonly<Record<string, string>>;
      readonly values: Readonly<Record<string, Readonly<Record<string, string>>>>;
    };
    readonly case: Readonly<Record<string, unknown>>;
    readonly decomp: Readonly<Record<string, readonly [string, readonly number[]]>>;
    readonly compExcl: readonly number[];
  };
  names: {
    readonly version: string;
    readonly names: readonly (readonly [number, string])[];
    readonly ranges: readonly (readonly [number, number, string, string])[];
    readonly jamo: Readonly<Record<'L' | 'V' | 'T', readonly string[]>>;
    readonly aliases: readonly (readonly [number, string, string])[];
  };
  security: {
    readonly version: string;
    readonly confusables: Readonly<Record<string, readonly number[]>>;
    readonly idStatus: { readonly allowed: readonly number[] };
    readonly idType: RawSets & { readonly default: string };
    /** UTS #46 status: "V" valid, "I" ignored, "X" disallowed, or the mapping. */
    readonly idna: {
      readonly default: string;
      readonly values: readonly (string | readonly number[])[];
      readonly ranges: readonly number[];
    };
    readonly joiningType: RawTable;
  };
}

const loaded = new Map<Artefact, unknown>();

/** Load the given artefacts (all three by default). Safe to call repeatedly. */
export async function ready(...kinds: Artefact[]): Promise<void> {
  const wanted: Artefact[] = kinds.length > 0 ? kinds : ['core', 'names', 'security'];
  for (const kind of wanted) {
    if (loaded.has(kind)) {
      continue;
    }
    const file = `ucd-${kind}-${UCD_VERSION}.json.gz`;
    const raw = (await loadData(file)) as { version?: unknown };
    if (raw.version !== UCD_VERSION) {
      throw new UniChefError(
        'E_INTERNAL',
        `${file} is version ${String(raw.version)}, expected ${UCD_VERSION}.`,
      );
    }
    loaded.set(kind, raw);
  }
}

/** One loaded artefact. Throws `E_INTERNAL` if `ready()` has not loaded it. */
export function load<K extends Artefact>(kind: K): Artefacts[K] {
  const raw = loaded.get(kind);
  if (raw === undefined) {
    throw new UniChefError(
      'E_INTERNAL',
      `The ucd-${kind} data is not loaded; await ready() first. Please report this.`,
    );
  }
  return raw as Artefacts[K];
}

/** Memoise a zero-argument function (Python's `@cache`). */
export function once<T>(fn: () => T): () => T {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value;
  };
}

/** Memoise a one-argument function. */
export function memo<K, T>(fn: (key: K) => T): (key: K) => T {
  const cache = new Map<K, T>();
  return (key) => {
    let value = cache.get(key);
    if (value === undefined && !cache.has(key)) {
      value = fn(key);
      cache.set(key, value);
    }
    return value as T;
  };
}

/** Index of the last element `<= x` in a sorted array, or -1 (`bisect_right - 1`). */
export function floorIndex(sorted: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? 0) <= x) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo - 1;
}

/** First index whose element is `>= x` (`bisect_left`). */
export function lowerBound(sorted: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? 0) < x) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** An enumerated property: flat `[start, length, valueIndex, …]` runs plus a default. */
export class RangeTable {
  readonly default: Value;
  readonly values: readonly Value[];
  private readonly starts: Int32Array;
  private readonly lengths: Int32Array;
  private readonly index: Int32Array;

  constructor(raw: RawTable) {
    this.default = raw.default;
    this.values = raw.values;
    const n = raw.ranges.length / 3;
    this.starts = new Int32Array(n);
    this.lengths = new Int32Array(n);
    this.index = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      this.starts[i] = raw.ranges[3 * i] ?? 0;
      this.lengths[i] = raw.ranges[3 * i + 1] ?? 0;
      this.index[i] = raw.ranges[3 * i + 2] ?? 0;
    }
  }

  get(cp: number): Value {
    const i = floorIndex(this.starts, cp);
    if (i >= 0 && cp < (this.starts[i] ?? 0) + (this.lengths[i] ?? 0)) {
      return this.values[this.index[i] ?? -1] ?? this.default;
    }
    return this.default;
  }

  /** All code points whose value is in `wanted`, gaps (the default) included. */
  rangesWhere(wanted: ReadonlySet<Value>): Ranges {
    const out: Range[] = [];
    let cursor = 0;
    const defaultWanted = wanted.has(this.default);
    for (let i = 0; i < this.starts.length; i++) {
      const start = this.starts[i] ?? 0;
      const length = this.lengths[i] ?? 0;
      if (defaultWanted && cursor < start) {
        out.push([cursor, start - 1]);
      }
      if (wanted.has(this.values[this.index[i] ?? -1] ?? this.default)) {
        out.push([start, start + length - 1]);
      }
      cursor = start + length;
    }
    if (defaultWanted && cursor <= MAX_CODE_POINT) {
      out.push([cursor, MAX_CODE_POINT]);
    }
    return merge(out);
  }
}

/** A binary property: flat `[start, length, …]` runs. */
export class RangeSet {
  private readonly starts: Int32Array;
  private readonly ends: Int32Array;

  constructor(flat: readonly number[]) {
    const n = flat.length / 2;
    this.starts = new Int32Array(n);
    this.ends = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const start = flat[2 * i] ?? 0;
      this.starts[i] = start;
      this.ends[i] = start + (flat[2 * i + 1] ?? 0) - 1;
    }
  }

  has(cp: number): boolean {
    const i = floorIndex(this.starts, cp);
    return i >= 0 && cp <= (this.ends[i] ?? 0);
  }

  ranges(): Ranges {
    const out: Range[] = [];
    for (let i = 0; i < this.starts.length; i++) {
      out.push([this.starts[i] ?? 0, this.ends[i] ?? 0]);
    }
    return merge(out);
  }
}

/** Sort and coalesce overlapping or adjacent inclusive ranges. */
export function merge(ranges: Iterable<Range>): Ranges {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && start <= last[1] + 1) {
      if (end > last[1]) {
        last[1] = end;
      }
    } else {
      out.push([start, end]);
    }
  }
  return out;
}

export function union(...sets: Ranges[]): Ranges {
  return merge(sets.flat());
}

export function complement(ranges: Ranges): Ranges {
  const out: Range[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (cursor < start) {
      out.push([cursor, start - 1]);
    }
    cursor = end + 1;
  }
  if (cursor <= MAX_CODE_POINT) {
    out.push([cursor, MAX_CODE_POINT]);
  }
  return out;
}

export function intersect(a: Ranges, b: Ranges): Ranges {
  const out: Range[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ra = a[i];
    const rb = b[j];
    if (ra === undefined || rb === undefined) {
      break;
    }
    const start = Math.max(ra[0], rb[0]);
    const end = Math.min(ra[1], rb[1]);
    if (start <= end) {
      out.push([start, end]);
    }
    if (ra[1] < rb[1]) {
      i++;
    } else {
      j++;
    }
  }
  return out;
}

export function* codePoints(ranges: Ranges): Generator<number> {
  for (const [start, end] of ranges) {
    for (let cp = start; cp <= end; cp++) {
      yield cp;
    }
  }
}

export function contains(ranges: Ranges, cp: number): boolean {
  let lo = 0;
  let hi = ranges.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((ranges[mid]?.[0] ?? Infinity) <= cp) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const r = ranges[lo - 1];
  return r !== undefined && cp <= r[1];
}

/** Convert a `{"<cp>": [cps]}` JSON map to integer keys. */
export function intMap(
  raw: Readonly<Record<string, readonly number[]>>,
): Map<number, readonly number[]> {
  const out = new Map<number, readonly number[]>();
  for (const [key, value] of Object.entries(raw)) {
    out.set(Number(key), value);
  }
  return out;
}

/** The code points of `text`; a lone surrogate is one code point, as in Python. */
export function toCodePoints(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    out.push(ch.codePointAt(0) ?? 0);
  }
  return out;
}

/** The inverse of `toCodePoints`, in chunks to stay under the argument limit. */
export function fromCodePoints(cps: readonly number[]): string {
  let out = '';
  for (let i = 0; i < cps.length; i += 8192) {
    out += String.fromCodePoint(...cps.slice(i, i + 8192));
  }
  return out;
}
