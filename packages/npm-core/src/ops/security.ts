// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Security detection ops (PRD §4.7): invisible characters, bidi controls, UTS #39
 * confusables and restriction levels.
 */

import type { Cell, Table } from '../dish/types.js';
import * as confusables from '../unicode/confusables.js';
import { ready, toCodePoints } from '../unicode/data.js';
import * as names from '../unicode/names.js';
import * as props from '../unicode/props.js';
import { boolArg, defineOp, stringArg, type Operation } from './types.js';
import { hex } from './unicode.js';

const LF = 0x0a;
const ASCII_END = 0x80;
const ZERO_WIDTH = new Set([0x180e, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);
const HANGUL_FILLERS = new Set([0x115f, 0x1160, 0x3164, 0xffa0]);
const EXTRA = new Set([0x00ad, 0x034f, ...HANGUL_FILLERS]);

export const INVISIBLE_COLUMNS = ['index', 'cp', 'name', 'kind', 'line', 'column'] as const;
export const CONFUSABLE_COLUMNS = ['index', 'cp', 'name', 'prototype'] as const;
export const COMPARE_COLUMNS = ['input-skeleton', 'reference-skeleton', 'confusable'] as const;

export const RESTRICTION_LEVELS = [
  'ASCII-Only',
  'Single Script',
  'Highly Restrictive',
  'Moderately Restrictive',
  'Minimally Restrictive',
  'Unrestricted',
] as const;
const CJK_SETS = ['Hanb', 'Jpan', 'Kore'];

/** The finding kind for `cp` (first match in this order), or null when it is not invisible. */
export function invisibleKind(cp: number): string | null {
  if (props.has('Bidi_Control', cp)) return 'bidi-control';
  if (cp >= 0xe0000 && cp < 0xe0080) return 'tag';
  if (props.has('Variation_Selector', cp)) return 'variation-selector';
  if (ZERO_WIDTH.has(cp)) return 'zero-width';
  if (HANGUL_FILLERS.has(cp)) return 'hangul-filler';
  if (EXTRA.has(cp) || props.has('Default_Ignorable_Code_Point', cp)) return 'default-ignorable';
  return null;
}

const detectInvisible = defineOp({
  id: 'detect-invisible',
  name: 'Detect Invisible Characters',
  category: 'Security',
  description:
    'One row per invisible code point: bidi controls (Trojan Source, CVE-2021-42574), ' +
    'tag characters, variation selectors, zero-width characters, Hangul fillers and other ' +
    'default-ignorables. `index` is the 0-based code-point offset; `line` and `column` are ' +
    '1-based, lines are LF-separated and columns count code points.',
  inputType: 'string',
  outputType: 'table',
  examples: [
    {
      input: 'a\u200bb\u2060c',
      args: {},
      output:
        'index\tcp\tname\tkind\tline\tcolumn\n1\tU+200B\tZERO WIDTH SPACE\tzero-width\t1\t2\n3\tU+2060\tWORD JOINER\tzero-width\t1\t4',
    },
  ],
  async run(text, _args, ctx): Promise<Table> {
    await ready('core', 'names');
    const rows: Cell[][] = [];
    let line = 1;
    let column = 1;
    toCodePoints(text).forEach((cp, i) => {
      if (i % 4096 === 0) {
        ctx.check();
      }
      const kind = invisibleKind(cp);
      if (kind !== null) {
        rows.push([i, `U+${hex(cp)}`, names.preferred(cp), kind, line, column]);
      }
      if (cp === LF) {
        line++;
        column = 1;
      } else {
        column++;
      }
    });
    return { columns: INVISIBLE_COLUMNS, rows };
  },
});

const removeBidiControls = defineOp({
  id: 'remove-bidi-controls',
  name: 'Remove Bidi Controls',
  category: 'Security',
  description:
    'Delete every Bidi_Control character (U+061C, U+200E, U+200F, U+202A..U+202E, ' +
    'U+2066..U+2069).',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'abc\u202edef\u202c', args: {}, output: 'abcdef' }],
  async run(text) {
    await ready('core');
    return Array.from(text)
      .filter((ch) => !props.has('Bidi_Control', ch.codePointAt(0) ?? 0))
      .join('');
  },
});

const hexAll = (text: string): string =>
  toCodePoints(text)
    .map((cp) => hex(cp))
    .join(' ');

const detectConfusables = defineOp({
  id: 'detect-confusables',
  name: 'Detect Confusables',
  category: 'Security',
  description:
    'UTS #39 skeletons (NFD, confusables.txt, NFD). With a `reference`, one row compares ' +
    'both skeletons (code points as hex) and `confusable` is `true` when they are equal. ' +
    'Without one, one row per code point that has a confusables.txt prototype.',
  inputType: 'string',
  outputType: 'table',
  examples: [
    {
      input: 'p\u0430ypal',
      args: {},
      output: 'index\tcp\tname\tprototype\n1\tU+0430\tCYRILLIC SMALL LETTER A\tU+0061',
    },
  ],
  args: [stringArg('reference', '')],
  async run(text, args, ctx): Promise<Table> {
    await ready();
    const reference = args.text('reference');
    if (reference !== '') {
      ctx.check();
      const mine = confusables.skeleton(text);
      const theirs = confusables.skeleton(reference);
      const verdict = mine === theirs ? 'true' : 'false';
      return { columns: COMPARE_COLUMNS, rows: [[hexAll(mine), hexAll(theirs), verdict]] };
    }
    const rows: Cell[][] = [];
    toCodePoints(text).forEach((cp, i) => {
      if (i % 4096 === 0) {
        ctx.check();
      }
      const target = confusables.prototype(cp);
      if (target !== null) {
        const proto = target.map((p) => `U+${hex(p)}`).join(' ');
        rows.push([i, `U+${hex(cp)}`, names.preferred(cp), proto]);
      }
    });
    return { columns: CONFUSABLE_COLUMNS, rows };
  },
});

/** Resolved script set of the characters whose Script_Extensions lack Latin. */
function resolvedWithoutLatin(cps: readonly number[]): ReadonlySet<string> | null {
  let resolved: ReadonlySet<string> | null = null;
  for (const cp of cps) {
    const scripts = confusables.augmentedScripts(cp);
    if (scripts === null || scripts.has('Latn')) {
      continue;
    }
    resolved = resolved === null ? scripts : confusables.intersection(resolved, scripts);
  }
  return resolved;
}

/**
 * UTS #39 §5.2 restriction level. With `profile`, any character outside the General
 * Security Profile (Identifier_Status Restricted) makes the text Unrestricted.
 */
export function restrictionLevel(text: string, profile = true): string {
  const cps = toCodePoints(text);
  if (profile && cps.some((cp) => confusables.identifierStatus(cp) !== 'Allowed')) {
    return 'Unrestricted';
  }
  if (cps.every((cp) => cp < ASCII_END)) {
    return 'ASCII-Only';
  }
  const resolved = confusables.resolvedScriptSet(text);
  if (resolved?.size !== 0) {
    return 'Single Script';
  }
  const others = resolvedWithoutLatin(cps);
  if (others !== null && others.size > 0 && CJK_SETS.some((s) => others.has(s))) {
    return 'Highly Restrictive';
  }
  if (others !== null && others.size > 0 && !others.has('Cyrl') && !others.has('Grek')) {
    return 'Moderately Restrictive';
  }
  return 'Minimally Restrictive';
}

const scriptMixCheck = defineOp({
  id: 'script-mix-check',
  name: 'Script Mix Check',
  category: 'Security',
  description:
    'The UTS #39 restriction level of the whole input: ASCII-Only, Single Script, ' +
    'Highly Restrictive, Moderately Restrictive, Minimally Restrictive or Unrestricted. ' +
    '`profile` (default true) applies step 1, so characters that are not ' +
    'Identifier_Status=Allowed (including spaces and punctuation) give Unrestricted.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    { input: 'paypal', args: {}, output: 'ASCII-Only' },
    { input: 'p\u0430ypal', args: {}, output: 'Minimally Restrictive' },
  ],
  args: [boolArg('profile', true)],
  async run(text, args, ctx) {
    ctx.check();
    await ready('core', 'security');
    return restrictionLevel(text, args.flag('profile'));
  },
});

export const SECURITY_OPS: readonly Operation[] = [
  detectInvisible,
  removeBidiControls,
  detectConfusables,
  scriptMixCheck,
];
