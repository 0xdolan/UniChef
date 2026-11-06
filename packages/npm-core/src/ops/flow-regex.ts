// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Flow-control operations that need the regex engine (PRD §3.5): `conditional-jump`,
 * which the runner interprets, and `subsection`.
 */

import { coerce } from '../dish/coerce.js';
import { ofString } from '../dish/types.js';
import { UniChefError } from '../errors.js';
import * as run from '../regex/run.js';
import { ready } from '../unicode/data.js';
import {
  boolArg,
  defineOp,
  intArg,
  regexArg,
  stepsArg,
  stringArg,
  type Operation,
} from './types.js';

export const MAX_GROUP = 99;

/** Compile after loading the UCD data that class expansion reads. */
export async function compile(pattern: string, flags: string): Promise<run.Compiled> {
  await ready('core');
  return run.compileRegex(pattern, flags);
}

/** `E_ARG_INVALID` unless the pattern has capture group `group`. */
export function checkGroup(compiled: run.Compiled, group: number): void {
  if (group > compiled.groups) {
    throw new UniChefError(
      'E_ARG_INVALID',
      `The pattern has ${String(compiled.groups)} capture group(s); there is no group ${String(group)}.`,
    );
  }
}

/** Every match with `global`, else the first one only. */
export function matchesOf(
  compiled: run.Compiled,
  text: string,
  timeoutMs: number,
  global: boolean,
  check: () => void,
): run.Match[] {
  if (global) {
    return [...run.finditer(compiled, text, timeoutMs, check)];
  }
  const first = run.search(compiled, text, timeoutMs);
  return first === null ? [] : [first];
}

export const conditionalJump = defineOp({
  id: 'conditional-jump',
  name: 'Conditional jump',
  category: 'Flow',
  description:
    'Jump to the label `to` when `pattern` matches the dish (or does not, with ' +
    '`invert`), at most `max` times; then continue with a W_JUMP_LIMIT warning.',
  inputType: 'string',
  outputType: 'string',
  args: [
    regexArg('pattern'),
    stringArg('flags'),
    boolArg('invert'),
    stringArg('to'),
    intArg('max', 10, 0, 1000),
  ],
  async run(text, args, ctx) {
    const compiled = await compile(args.text('pattern'), args.text('flags'));
    const found = run.search(compiled, text, ctx.limits.regexTimeoutMs) !== null;
    return found !== args.flag('invert');
  },
});

export const subsection = defineOp({
  id: 'subsection',
  name: 'Subsection',
  category: 'Flow',
  description:
    'Run `steps` on each match of `pattern` (or on its capture group `group`) and ' +
    'splice the results back; the rest of the dish passes through. Empty matches and ' +
    'groups that did not participate are left alone. With `global` off, only the first ' +
    'match is used. An error inside a match fails the step; its path names the match.',
  inputType: 'string',
  outputType: 'string',
  args: [
    regexArg('pattern'),
    stringArg('flags'),
    intArg('group', 0, 0, MAX_GROUP),
    boolArg('global', true),
    stepsArg(),
  ],
  async run(text, args, ctx) {
    const compiled = await compile(args.text('pattern'), args.text('flags'));
    const group = args.int('group');
    checkGroup(compiled, group);
    // Matching finishes before any steps run, so the regex timeout covers matching only.
    const matches = matchesOf(
      compiled,
      text,
      ctx.limits.regexTimeoutMs,
      args.flag('global'),
      ctx.check,
    );
    const out: string[] = [];
    let done = 0;
    for (const [i, match] of matches.entries()) {
      const span = match.spans[group];
      if (span !== undefined && span !== null && span[1] > span[0]) {
        const part = ofString(text.slice(span[0], span[1]));
        const result = await ctx.runNested(args.steps(), part, 'match', i);
        out.push(text.slice(done, span[0]), coerce(result, 'string', ctx.warn).value as string);
        done = span[1];
      }
    }
    out.push(text.slice(done));
    return out.join('');
  },
});

export const FLOW_REGEX_OPS: readonly Operation[] = [conditionalJump, subsection];
