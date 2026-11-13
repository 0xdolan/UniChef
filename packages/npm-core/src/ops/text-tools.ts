// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Text clean-up, casing and line operations (PRD §3.8, 1.1; semantics in spec/README.md).
 *
 * Behaviour follows CyberChef v11.5.0 (Apache-2.0) where it is Unicode-correct: casing uses
 * UniChef's UCD case mappings per code point, letters are General_Category L*, and lines
 * are separated by LF with a final LF kept, as in the other text operations.
 */

import { UniChefError } from '../errors.js';
import * as caseMap from '../unicode/case.js';
import { ready } from '../unicode/data.js';
import * as props from '../unicode/props.js';
import {
  boolArg,
  defineOp,
  enumArg,
  intArg,
  JS_SAFE_INTEGER,
  stringArg,
  type Operation,
} from './types.js';

const MAX_CASINGS = 16;
const CHECK_EVERY = 4096;
// JavaScript's \s: White_Space plus U+FEFF, without U+0085 (CyberChef's regexes use it).
const JS_SPACE =
  '\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff';
const ESC = String.fromCharCode(0x1b);
const ANSI = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, 'g');
const TAG = /<[^>]+>/g;
const INDENT = /\n[ \f\t]+/g;
const FIRST_BLANK = new RegExp(`^[${JS_SPACE}]*\\n`);
const BLANK_RUN = new RegExp(`(?:\\n[${JS_SPACE}]*){2,}`, 'g');
const LINE_NUMBER = new RegExp(`(?:^|(?<=\\n))[ \\t]{0,5}[0-9]+[${JS_SPACE}:|\\-,.)\\]]`, 'g');

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

export const swapCase = defineOp({
  id: 'swap-case',
  name: 'Swap case',
  category: 'Text',
  description:
    'Upper-case every character that changes when upper-cased, and lower-case the ' +
    'rest, one code point at a time with full case mappings (`ß` becomes `SS`).',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello, Wörld', args: {}, output: 'hELLO, wÖRLD' }],
  args: [],
  async run(text, _args, ctx) {
    await ready('core');
    const out: string[] = [];
    let i = 0;
    for (const ch of text) {
      if (i++ % CHECK_EVERY === 0) ctx.check();
      const up = caseMap.upper(ch);
      out.push(up === ch ? caseMap.lower(ch) : up);
    }
    return out.join('');
  },
});

export const alternatingCaps = defineOp({
  id: 'alternating-caps',
  name: 'Alternating caps',
  category: 'Text',
  description:
    'Lower-case the first letter, upper-case the next, and so on. Only letters ' +
    '(General_Category L*) take part; other characters are copied and do not break the ' +
    'alternation.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello world', args: {}, output: 'hElLo WoRlD' }],
  args: [],
  async run(text, _args, ctx) {
    await ready('core');
    const out: string[] = [];
    let lowerNext = true;
    let i = 0;
    for (const ch of text) {
      if (i++ % CHECK_EVERY === 0) ctx.check();
      if (props.gc(ch.codePointAt(0) ?? 0).startsWith('L')) {
        out.push(lowerNext ? caseMap.lower(ch) : caseMap.upper(ch));
        lowerNext = !lowerNext;
      } else {
        out.push(ch);
      }
    }
    return out.join('');
  },
});

export const getAllCasings = defineOp({
  id: 'get-all-casings',
  name: 'Get all casings',
  category: 'Text',
  description:
    'Every combination of upper and lower case, one per line. The input is ' +
    'lower-cased, then line k upper-cases the code points whose bit is set in k (the ' +
    'first code point is bit 0). At most 16 code points.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'ab', args: {}, output: 'ab\nAb\naB\nAB' }],
  args: [],
  async run(text, _args, ctx) {
    await ready('core');
    const chars = Array.from(caseMap.lower(text));
    if (chars.length > MAX_CASINGS) {
      throw new UniChefError(
        'E_LIMIT',
        `Get all casings takes at most ${String(MAX_CASINGS)} code points.`,
      );
    }
    const uppers = chars.map((ch) => caseMap.upper(ch));
    const out: string[] = [];
    for (let k = 0; k < 1 << chars.length; k++) {
      if (k % CHECK_EVERY === 0) ctx.check();
      out.push(chars.map((ch, j) => ((k >> j) & 1 ? (uppers[j] ?? ch) : ch)).join(''));
    }
    return out.join('\n');
  },
});

export const removeNullBytes = defineOp({
  id: 'remove-null-bytes',
  name: 'Remove null bytes',
  category: 'Text',
  description: 'Remove every 0x00 byte.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [{ input: 'a\u0000b\u0000', args: {}, output: 'ab' }],
  args: [],
  run: (data) => data.filter((b) => b !== 0),
});

export const removeAnsiEscapeCodes = defineOp({
  id: 'remove-ansi-escape-codes',
  name: 'Remove ANSI escape codes',
  category: 'Text',
  description:
    'Remove ANSI control sequences (ESC `[`, parameter bytes, intermediate bytes and a ' +
    'final byte), such as colour and cursor codes.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '\u001b[1;31mred\u001b[0m', args: {}, output: 'red' }],
  args: [],
  run: (text) => text.replace(ANSI, ''),
});

export const stripHtmlTags = defineOp({
  id: 'strip-html-tags',
  name: 'Strip HTML tags',
  category: 'Text',
  description:
    'Remove everything from `<` to the next `>`, repeating until none is left. Then ' +
    '`remove_indentation` drops spaces and tabs after each line feed, and ' +
    '`remove_line_breaks` drops a blank first line and folds runs of blank lines into ' +
    'one line feed. The result is text, not safe HTML.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '<p>Hello <b>world</b></p>', args: {}, output: 'Hello world' }],
  args: [boolArg('remove_indentation', true), boolArg('remove_line_breaks', true)],
  run(text, args, ctx) {
    let out = text;
    for (;;) {
      ctx.check();
      const stripped = out.replace(TAG, '');
      if (stripped.length === out.length) break;
      out = stripped;
    }
    if (args.flag('remove_indentation')) {
      out = out.replace(INDENT, '\n');
    }
    if (args.flag('remove_line_breaks')) {
      out = out.replace(FIRST_BLANK, '').replace(BLANK_RUN, '\n');
    }
    return out;
  },
});

export const addLineNumbers = defineOp({
  id: 'add-line-numbers',
  name: 'Add line numbers',
  category: 'Text',
  description:
    'Put the line number and a space before each line, counting from `offset` + 1. ' +
    'Numbers are right-aligned to the width of the line count. A final LF is kept.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'one\ntwo', args: {}, output: '1 one\n2 two' }],
  args: [intArg('offset', 0, -JS_SAFE_INTEGER, JS_SAFE_INTEGER)],
  run(text, args) {
    const [all, end] = lines(text);
    const offset = args.int('offset');
    const width = String(all.length).length;
    return (
      all.map((line, n) => `${String(n + 1 + offset).padStart(width)} ${line}`).join('\n') + end
    );
  },
});

export const removeLineNumbers = defineOp({
  id: 'remove-line-numbers',
  name: 'Remove line numbers',
  category: 'Text',
  description:
    'At the start of each line, remove up to five spaces or tabs, ASCII digits and one ' +
    'following separator: whitespace (including a line feed) or one of `:|-,.)]`.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '1 one\n2:two', args: {}, output: 'one\ntwo' }],
  args: [],
  run: (text) => text.replace(LINE_NUMBER, ''),
});

export const padLines = defineOp({
  id: 'pad-lines',
  name: 'Pad lines',
  category: 'Text',
  description:
    'Add `length` code points to the start or end of each line, made by repeating ' +
    '`character` and cutting it to length. A final LF is kept.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'a\nb', args: { length: 2, character: '.' }, output: '..a\n..b' }],
  args: [
    enumArg('position', ['start', 'end']),
    intArg('length', 5, 0, 1_000_000),
    stringArg('character', ' '),
  ],
  run(text, args) {
    const filler = Array.from(args.text('character'));
    if (filler.length === 0) {
      throw new UniChefError('E_ARG_INVALID', 'character must not be empty.');
    }
    const count = args.int('length');
    const pad = Array.from(filler.join('').repeat(Math.floor(count / filler.length) + 1))
      .slice(0, count)
      .join('');
    const [all, end] = lines(text);
    const start = args.text('position') === 'start';
    return all.map((line) => (start ? pad + line : line + pad)).join('\n') + end;
  },
});

export const TEXT_TOOL_OPS: readonly Operation[] = [
  swapCase,
  alternatingCaps,
  getAllCasings,
  removeNullBytes,
  removeAnsiEscapeCodes,
  stripHtmlTags,
  addLineNumbers,
  removeLineNumbers,
  padLines,
];
