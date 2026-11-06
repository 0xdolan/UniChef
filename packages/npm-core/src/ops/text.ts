// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Text operations (PRD §3.8 Alpha; semantics in spec/README.md).
 *
 * Lines are separated by LF only. A final LF ends the last line rather than starting an
 * empty one, and line operations keep it. Strings compare by code point, never by the
 * host's collation or UTF-16 order. Whitespace is the Unicode White_Space property.
 */

import * as utf8 from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import * as run from '../regex/run.js';
import * as caseMap from '../unicode/case.js';
import { ready } from '../unicode/data.js';
import * as props from '../unicode/props.js';
import * as segment from '../unicode/segment.js';
import { checkGroup, compile, matchesOf, MAX_GROUP } from './flow-regex.js';
import {
  boolArg,
  defineOp,
  enumArg,
  intArg,
  JS_SAFE_INTEGER,
  regexArg,
  stringArg,
  type Args,
  type OpContext,
  type Operation,
} from './types.js';

const NUMBER = /^[ \t]*([+-]?[0-9]+(?:\.[0-9]+)?)/;

/** Split into lines; the second item is the final LF, if any. */
function lines(text: string): [string[], string] {
  if (text === '') {
    return [[], ''];
  }
  if (text.endsWith('\n')) {
    return [text.slice(0, -1).split('\n'), '\n'];
  }
  return [text.split('\n'), ''];
}

async function units(text: string, unit: string, ctx: OpContext): Promise<string[]> {
  if (unit === 'graphemes') {
    await ready('core');
    return segment.graphemes(text, ctx.check);
  }
  return Array.from(text);
}

const bad = (message: string): UniChefError => new UniChefError('E_ARG_INVALID', message);

/** Compare two strings by code point (Python's `str` ordering). */
export function compareCodePoints(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a.codePointAt(i) ?? 0;
    const y = b.codePointAt(j) ?? 0;
    if (x !== y) {
      return x < y ? -1 : 1;
    }
    i += x > 0xffff ? 2 : 1;
    j += y > 0xffff ? 2 : 1;
  }
  const restA = a.length - i;
  const restB = b.length - j;
  return restA === restB ? 0 : restA < restB ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Regex operations

export const findReplace = defineOp({
  id: 'find-replace',
  name: 'Find / replace',
  category: 'Text',
  description:
    'Replace matches of `pattern` with `replacement`. As a regex, the replacement uses ' +
    'JavaScript syntax: `$$`, `$&`, `$1`-`$99` and `$<name>`; empty matches are replaced ' +
    'too. With `literal`, both are plain text and the pattern must not be empty.',
  inputType: 'string',
  outputType: 'string',
  args: [
    regexArg('pattern'),
    stringArg('flags'),
    stringArg('replacement'),
    boolArg('literal'),
    boolArg('global', true),
  ],
  async run(text, args, ctx) {
    const pattern = args.text('pattern');
    const replacement = args.text('replacement');
    if (args.flag('literal')) {
      if (pattern === '') {
        throw bad('A literal pattern must not be empty.');
      }
      if (args.flag('global')) {
        return text.split(pattern).join(replacement);
      }
      const at = text.indexOf(pattern);
      return at < 0 ? text : text.slice(0, at) + replacement + text.slice(at + pattern.length);
    }
    const compiled = await compile(pattern, args.text('flags'));
    const matches = matchesOf(
      compiled,
      text,
      ctx.limits.regexTimeoutMs,
      args.flag('global'),
      ctx.check,
    );
    const out: string[] = [];
    let done = 0;
    for (const match of matches) {
      out.push(text.slice(done, match.start), run.expand(replacement, match, text, compiled));
      done = match.end;
    }
    out.push(text.slice(done));
    return out.join('');
  },
});

export const regexExtract = defineOp({
  id: 'regex-extract',
  name: 'Regex extract',
  category: 'Text',
  description:
    'List every match of `pattern` (or its capture group `group`), joined by ' +
    '`separator`. Empty matches count; a group that did not participate gives "".',
  inputType: 'string',
  outputType: 'string',
  args: [
    regexArg('pattern'),
    stringArg('flags'),
    intArg('group', 0, 0, MAX_GROUP),
    stringArg('separator', '\n'),
  ],
  async run(text, args, ctx) {
    const compiled = await compile(args.text('pattern'), args.text('flags'));
    const group = args.int('group');
    checkGroup(compiled, group);
    const out: string[] = [];
    for (const match of run.finditer(compiled, text, ctx.limits.regexTimeoutMs, ctx.check)) {
      out.push(match.group(text, group) ?? '');
    }
    return out.join(args.text('separator'));
  },
});

// ---------------------------------------------------------------------------
// Splitting and joining

export const split = defineOp({
  id: 'split',
  name: 'Split',
  category: 'Text',
  description: 'Split on the literal `delimiter` and join the parts with `join`.',
  inputType: 'string',
  outputType: 'string',
  args: [stringArg('delimiter', ','), stringArg('join', '\n')],
  run(text, args) {
    const delimiter = args.text('delimiter');
    if (delimiter === '') {
      throw bad('The delimiter must not be empty.');
    }
    return text.split(delimiter).join(args.text('join'));
  },
});

export const join = defineOp({
  id: 'join',
  name: 'Join lines',
  category: 'Text',
  description: 'Join the lines with `delimiter`. A final LF is dropped.',
  inputType: 'string',
  outputType: 'string',
  args: [stringArg('delimiter', ',')],
  run(text, args) {
    return lines(text)[0].join(args.text('delimiter'));
  },
});

export const reverse = defineOp({
  id: 'reverse',
  name: 'Reverse',
  category: 'Text',
  description:
    'Reverse the order of graphemes (default), code points or bytes. The first two ' +
    'decode UTF-8 first, replacing ill-formed sequences with U+FFFD.',
  inputType: 'bytes',
  outputType: 'bytes',
  args: [enumArg('unit', ['graphemes', 'code-points', 'bytes'])],
  async run(data, args, ctx) {
    const unit = args.text('unit');
    if (unit === 'bytes') {
      return data.slice().reverse();
    }
    const parts = await units(utf8.decode(data, ctx.check), unit, ctx);
    return utf8.encode(parts.reverse().join(''));
  },
});

// ---------------------------------------------------------------------------
// Line operations

type SortKey = (line: string) => string | number | readonly [number, number];

function numberKey(line: string): readonly [number, number] {
  const found = NUMBER.exec(line);
  return found?.[1] === undefined ? [1, 0] : [0, Number(found[1])];
}

const SORT_KEYS: Readonly<Record<string, SortKey>> = {
  'code-point': (line) => line,
  'case-insensitive': (line) => caseMap.fold(line),
  numeric: numberKey,
  length: (line) => Array.from(line).length,
};

function compareKeys(
  a: string | number | readonly [number, number],
  b: string | number | readonly [number, number],
): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return compareCodePoints(a, b);
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const [a0, a1] = a as readonly [number, number];
  const [b0, b1] = b as readonly [number, number];
  return a0 !== b0 ? a0 - b0 : a1 < b1 ? -1 : a1 > b1 ? 1 : 0;
}

export const sortLines = defineOp({
  id: 'sort-lines',
  name: 'Sort lines',
  category: 'Text',
  description:
    'Stable sort of the lines. `code-point` compares code points; `case-insensitive` ' +
    'compares full case folds; `numeric` compares a leading decimal number, with lines ' +
    'that have none after the rest; `length` counts code points. `descending` reverses ' +
    'the order of the keys, keeping equal lines in input order.',
  inputType: 'string',
  outputType: 'string',
  args: [enumArg('key', Object.keys(SORT_KEYS)), enumArg('order', ['ascending', 'descending'])],
  async run(text, args) {
    await ready('core');
    const [all, end] = lines(text);
    const key = SORT_KEYS[args.text('key')] ?? SORT_KEYS['code-point'];
    const sign = args.text('order') === 'descending' ? -1 : 1;
    const keyed = all.map((line) => ({ line, key: key?.(line) ?? line }));
    keyed.sort((a, b) => sign * compareKeys(a.key, b.key));
    return keyed.map((k) => k.line).join('\n') + end;
  },
});

export const uniqueLines = defineOp({
  id: 'unique-lines',
  name: 'Unique lines',
  category: 'Text',
  description:
    'Keep the first of each set of equal lines, in input order. `ignore_case` compares ' +
    'full case folds; `count` prefixes each line with its number of copies and a tab.',
  inputType: 'string',
  outputType: 'string',
  args: [boolArg('ignore_case'), boolArg('count')],
  async run(text, args) {
    await ready('core');
    const [all, end] = lines(text);
    const seen = new Map<string, { line: string; n: number }>();
    for (const line of all) {
      const key = args.flag('ignore_case') ? caseMap.fold(line) : line;
      const entry = seen.get(key);
      if (entry === undefined) {
        seen.set(key, { line, n: 1 });
      } else {
        entry.n += 1;
      }
    }
    const kept = [...seen.values()];
    if (args.flag('count')) {
      return kept.map(({ line, n }) => `${String(n)}\t${line}`).join('\n') + end;
    }
    return kept.map(({ line }) => line).join('\n') + end;
  },
});

async function take(text: string, args: Args, ctx: OpContext, last: boolean): Promise<string> {
  const count = args.int('count');
  const unit = args.text('unit');
  if (unit === 'lines') {
    const [all, end] = lines(text);
    if (count >= all.length) {
      return text;
    }
    const kept = last ? all.slice(all.length - count) : all.slice(0, count);
    return kept.length > 0 ? kept.join('\n') + end : '';
  }
  const parts = await units(text, unit, ctx);
  if (count === 0) {
    return '';
  }
  return (last ? parts.slice(Math.max(parts.length - count, 0)) : parts.slice(0, count)).join('');
}

const TAKE_ARGS = [
  intArg('count', 10, 0, JS_SAFE_INTEGER),
  enumArg('unit', ['lines', 'graphemes', 'code-points']),
];

export const head = defineOp({
  id: 'head',
  name: 'Head',
  category: 'Text',
  description: 'The first `count` lines (keeping a final LF), graphemes or code points.',
  inputType: 'string',
  outputType: 'string',
  args: TAKE_ARGS,
  run: (text, args, ctx) => take(text, args, ctx, false),
});

export const tail = defineOp({
  id: 'tail',
  name: 'Tail',
  category: 'Text',
  description: 'The last `count` lines (keeping a final LF), graphemes or code points.',
  inputType: 'string',
  outputType: 'string',
  args: TAKE_ARGS,
  run: (text, args, ctx) => take(text, args, ctx, true),
});

function strip(text: string, side: string): string {
  let start = 0;
  let end = text.length;
  // White_Space has no astral members, so UTF-16 units suffice; surrogates never match.
  if (side === 'both' || side === 'start') {
    while (start < end && props.has('White_Space', text.charCodeAt(start))) {
      start += 1;
    }
  }
  if (side === 'both' || side === 'end') {
    while (end > start && props.has('White_Space', text.charCodeAt(end - 1))) {
      end -= 1;
    }
  }
  return text.slice(start, end);
}

export const trim = defineOp({
  id: 'trim',
  name: 'Trim',
  category: 'Text',
  description:
    'Remove White_Space characters from the start, end or both ends of the text, or ' +
    'of every line with `lines` (a final LF is kept).',
  inputType: 'string',
  outputType: 'string',
  args: [enumArg('side', ['both', 'start', 'end']), boolArg('lines')],
  async run(text, args) {
    await ready('core');
    const side = args.text('side');
    if (!args.flag('lines')) {
      return strip(text, side);
    }
    const [all, end] = lines(text);
    return all.map((line) => strip(line, side)).join('\n') + end;
  },
});

export const TEXT_OPS: readonly Operation[] = [
  findReplace,
  regexExtract,
  split,
  join,
  reverse,
  sortLines,
  uniqueLines,
  head,
  tail,
  trim,
];
