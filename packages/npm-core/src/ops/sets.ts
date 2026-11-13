// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Set operations and edit distances: union, intersection, difference, symmetric
 * difference, Cartesian product, power set, Hamming and Levenshtein distance (PRD §3.8, 1.1).
 *
 * Behaviour follows CyberChef v11.5.0 (Apache-2.0), with the deviations listed in
 * spec/README.md: each sample is a set (repeated items count once), and results come in a
 * fixed, documented order.
 */

import { UniChefError } from '../errors.js';
import { defineOp, enumArg, intArg, stringArg, type Args, type Operation } from './types.js';

const CHECK_EVERY = 4096;
const MAX_PRODUCT = 100_000;
const MAX_POWER_SET_ITEMS = 16;
const MAX_EDIT_CELLS = 4_000_000;
const MAX_COST = 1_000_000;
const ASCII_SPACE = /[ \t\n\v\f\r]+/g;
const HEX = /^(?:[0-9A-Fa-f]{2})*$/;

const SET_ARGS = [stringArg('sample_delimiter', '\n\n'), stringArg('item_delimiter', ',')];

const badArg = (message: string): UniChefError => new UniChefError('E_ARG_INVALID', message);
const decodeError = (message: string): UniChefError => new UniChefError('E_DECODE', message);

function delimiter(args: Args, name: string): string {
  const value = args.text(name);
  if (value === '') throw badArg(`The ${name.replaceAll('_', ' ')} must not be empty.`);
  return value;
}

/** The items without repeats, in first-seen order. */
const unique = (items: readonly string[]): string[] => [...new Set(items)];

/**
 * Split the input into samples of unique items. `count` is the exact number of samples
 * needed, or undefined for two or more.
 */
function samples(text: string, args: Args, count?: number): [string[][], string] {
  const sampleDelimiter = delimiter(args, 'sample_delimiter');
  const itemDelimiter = delimiter(args, 'item_delimiter');
  const parts = text.split(sampleDelimiter);
  if (count !== undefined && parts.length !== count) {
    throw decodeError(
      `The input must have exactly ${String(count)} samples; found ${String(parts.length)}.`,
    );
  }
  if (count === undefined && parts.length < 2) {
    throw decodeError('The input must have at least 2 samples; found 1.');
  }
  return [parts.map((s) => unique(s.split(itemDelimiter))), itemDelimiter];
}

function twoSets(text: string, args: Args): [string[], string[], string] {
  const [[a = [], b = []], itemDelimiter] = samples(text, args, 2);
  return [a, b, itemDelimiter];
}

export const setUnion = defineOp({
  id: 'set-union',
  name: 'Set Union',
  category: 'Data',
  description:
    'Split the input on `sample_delimiter` into two samples and each sample on ' +
    '`item_delimiter` into items. Write every item that is in either sample, once, in the ' +
    'order first seen.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '1,2,3\n\n3,4', args: {}, output: '1,2,3,4' }],
  args: SET_ARGS,
  run(text, args) {
    if (text === '') return '';
    const [a, b, d] = twoSets(text, args);
    return unique([...a, ...b]).join(d);
  },
});

export const setIntersection = defineOp({
  id: 'set-intersection',
  name: 'Set Intersection',
  category: 'Data',
  description:
    'Split the input on `sample_delimiter` into two samples and each sample on ' +
    '`item_delimiter` into items. Write the items that are in both samples, once, in the ' +
    'order of the first sample.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '1,2,3\n\n3,2,4', args: {}, output: '2,3' }],
  args: SET_ARGS,
  run(text, args) {
    if (text === '') return '';
    const [a, b, d] = twoSets(text, args);
    const seen = new Set(b);
    return a.filter((item) => seen.has(item)).join(d);
  },
});

export const setDifference = defineOp({
  id: 'set-difference',
  name: 'Set Difference',
  category: 'Data',
  description:
    'Split the input on `sample_delimiter` into two samples and each sample on ' +
    '`item_delimiter` into items. Write the items of the first sample that are not in the ' +
    'second, once, in their order.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '1,2,3\n\n3,4', args: {}, output: '1,2' }],
  args: SET_ARGS,
  run(text, args) {
    if (text === '') return '';
    const [a, b, d] = twoSets(text, args);
    const seen = new Set(b);
    return a.filter((item) => !seen.has(item)).join(d);
  },
});

export const symmetricDifference = defineOp({
  id: 'symmetric-difference',
  name: 'Symmetric Difference',
  category: 'Data',
  description:
    'Split the input on `sample_delimiter` into two samples and each sample on ' +
    '`item_delimiter` into items. Write the items that are in exactly one sample, once: those ' +
    'of the first sample, then those of the second.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '1,2,3\n\n3,4', args: {}, output: '1,2,4' }],
  args: SET_ARGS,
  run(text, args) {
    if (text === '') return '';
    const [a, b, d] = twoSets(text, args);
    const inA = new Set(a);
    const inB = new Set(b);
    return [...a.filter((x) => !inB.has(x)), ...b.filter((x) => !inA.has(x))].join(d);
  },
});

export const cartesianProduct = defineOp({
  id: 'cartesian-product',
  name: 'Cartesian Product',
  category: 'Data',
  description:
    'Split the input on `sample_delimiter` into two or more samples and each sample on ' +
    '`item_delimiter` into items. Write every tuple that takes one item from each sample, as ' +
    '`(x,y)` with a comma inside, joined by `item_delimiter`. The last sample varies ' +
    'fastest. At most 100000 tuples.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '1,2\n\na,b', args: {}, output: '(1,a),(1,b),(2,a),(2,b)' }],
  args: SET_ARGS,
  run(text, args, ctx) {
    if (text === '') return '';
    const [sets, d] = samples(text, args);
    let total = 1;
    for (const set of sets) total *= set.length;
    if (total > MAX_PRODUCT) {
      throw new UniChefError(
        'E_LIMIT',
        `The product has ${String(total)} tuples; the limit is ${String(MAX_PRODUCT)}.`,
      );
    }
    // Odometer over the samples: the last index turns fastest.
    const index = sets.map(() => 0);
    const out: string[] = [];
    for (let n = 0; n < total; n++) {
      if (n % CHECK_EVERY === 0) ctx.check();
      out.push(`(${sets.map((set, i) => set[index[i] ?? 0] ?? '').join(',')})`);
      for (let i = sets.length - 1; i >= 0; i--) {
        const next = (index[i] ?? 0) + 1;
        if (next < (sets[i]?.length ?? 0)) {
          index[i] = next;
          break;
        }
        index[i] = 0;
      }
    }
    return out.join(d);
  },
});

/** Every `size`-item subset of `items`, in lexicographic index order. */
function* combinations(items: readonly string[], size: number): Generator<string[]> {
  const index = Array.from({ length: size }, (_, i) => i);
  if (size > items.length) return;
  for (;;) {
    yield index.map((i) => items[i] ?? '');
    let i = size - 1;
    while (i >= 0 && index[i] === i + items.length - size) i--;
    if (i < 0) return;
    index[i] = (index[i] ?? 0) + 1;
    for (let j = i + 1; j < size; j++) index[j] = (index[j - 1] ?? 0) + 1;
  }
}

export const powerSet = defineOp({
  id: 'power-set',
  name: 'Power Set',
  category: 'Data',
  description:
    'Split the input on `item_delimiter` into items, dropping empty ones and repeats. ' +
    'Write every subset on its own line, items joined by `item_delimiter` and each line ' +
    'ending in a line feed: the empty set first, then smaller subsets before larger ones, ' +
    'and subsets of one size in input order. At most 16 items.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'a,b', args: {}, output: '\na\nb\na,b\n' }],
  args: [stringArg('item_delimiter', ',')],
  run(text, args, ctx) {
    const d = delimiter(args, 'item_delimiter');
    const items = unique(text.split(d).filter((x) => x !== ''));
    if (items.length === 0) return '';
    if (items.length > MAX_POWER_SET_ITEMS) {
      throw new UniChefError(
        'E_LIMIT',
        `The input has ${String(items.length)} items; the limit is ${String(MAX_POWER_SET_ITEMS)}.`,
      );
    }
    const out: string[] = [];
    for (let size = 0; size <= items.length; size++) {
      ctx.check();
      for (const subset of combinations(items, size)) out.push(subset.join(d) + '\n');
    }
    return out.join('');
  },
});

function two(text: string, delim: string): [string, string] {
  const parts = text.split(delim);
  const [first, second] = parts;
  if (parts.length !== 2 || first === undefined || second === undefined) {
    throw decodeError(`The input must have exactly 2 samples; found ${String(parts.length)}.`);
  }
  return [first, second];
}

function hexBytes(sample: string): Uint8Array {
  const digits = sample.replace(ASCII_SPACE, '');
  if (!HEX.test(digits)) {
    throw decodeError('A sample is not hex: it needs an even number of hex digits.');
  }
  const out = new Uint8Array(digits.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(digits.slice(2 * i, 2 * i + 2), 16);
  return out;
}

function popcount(n: number): number {
  let count = 0;
  for (let v = n; v !== 0; v &= v - 1) count++;
  return count;
}

export const hammingDistance = defineOp({
  id: 'hamming-distance',
  name: 'Hamming Distance',
  category: 'Data',
  description:
    'Split the input on `delimiter` into two samples of equal length, read as UTF-8 text ' +
    'or as hex (whitespace ignored). Write the number of positions where they differ, ' +
    'counting bytes or bits.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'karolin\n\nkathrin', args: {}, output: '3' }],
  args: [
    stringArg('delimiter', '\n\n'),
    enumArg('unit', ['byte', 'bit']),
    enumArg('input_type', ['text', 'hex']),
  ],
  run(text, args, ctx) {
    if (text === '') return '';
    const [first, second] = two(text, delimiter(args, 'delimiter'));
    const hex = args.text('input_type') === 'hex';
    const encoder = new TextEncoder();
    const a = hex ? hexBytes(first) : encoder.encode(first);
    const b = hex ? hexBytes(second) : encoder.encode(second);
    if (a.length !== b.length) {
      throw decodeError(
        `The samples differ in length: ${String(a.length)} and ${String(b.length)} bytes.`,
      );
    }
    const bits = args.text('unit') === 'bit';
    let count = 0;
    for (let i = 0; i < a.length; i++) {
      if (i % CHECK_EVERY === 0) ctx.check();
      const x = (a[i] ?? 0) ^ (b[i] ?? 0);
      count += bits ? popcount(x) : x === 0 ? 0 : 1;
    }
    return String(count);
  },
});

export const levenshteinDistance = defineOp({
  id: 'levenshtein-distance',
  name: 'Levenshtein Distance',
  category: 'Data',
  description:
    'Split the input on `delimiter` into two samples. Write the least total cost of the ' +
    'insertions, deletions and substitutions of characters (code points) that turn the ' +
    'first sample into the second. The product of the two lengths may be at most ' +
    '4000000.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'kitten\nsitting', args: {}, output: '3' }],
  args: [
    stringArg('delimiter', '\n'),
    intArg('insertion', 1, 0, MAX_COST),
    intArg('deletion', 1, 0, MAX_COST),
    intArg('substitution', 1, 0, MAX_COST),
  ],
  run(text, args, ctx) {
    if (text === '') return '';
    const [firstText, secondText] = two(text, delimiter(args, 'delimiter'));
    const first = Array.from(firstText);
    const second = Array.from(secondText);
    const cells = first.length * second.length;
    if (cells > MAX_EDIT_CELLS) {
      throw new UniChefError(
        'E_LIMIT',
        `The samples need ${String(cells)} steps; the limit is ${String(MAX_EDIT_CELLS)}.`,
      );
    }
    const insert = args.int('insertion');
    const del = args.int('deletion');
    const substitute = args.int('substitution');
    let previous = Array.from({ length: second.length + 1 }, (_, j) => j * insert);
    for (const [i, x] of first.entries()) {
      ctx.check();
      const current = [(i + 1) * del];
      for (const [j, y] of second.entries()) {
        current.push(
          Math.min(
            (previous[j + 1] ?? 0) + del,
            (current[j] ?? 0) + insert,
            (previous[j] ?? 0) + (x === y ? 0 : substitute),
          ),
        );
      }
      previous = current;
    }
    return String(previous[second.length] ?? 0);
  },
});

export const SET_OPS: readonly Operation[] = [
  setUnion,
  setIntersection,
  setDifference,
  symmetricDifference,
  cartesianProduct,
  powerSet,
  hammingDistance,
  levenshteinDistance,
];
