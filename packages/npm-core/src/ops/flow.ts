// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Flow-control operations (PRD §3.5).
 *
 * `label`, `comment`, `jump` and `conditional-jump` are interpreted by the runner; their
 * `run` functions only document the no-op behaviour. Nested step lists run through
 * `OpContext.runNested` so limits, warnings and error paths carry over.
 */

import { coerce } from '../dish/coerce.js';
import { ofBytes, ofString } from '../dish/types.js';
import { defineOp, intArg, stepsArg, stringArg, type Operation } from './types.js';

export const fork = defineOp({
  id: 'fork',
  name: 'Fork',
  category: 'Flow',
  description:
    'Split the input on `split`, run `steps` on each part, and join the results with ' +
    '`merge`. An error in any branch fails the fork; its path names the branch.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    {
      input: 'a,b,c',
      args: { split: ',', merge: ' | ', steps: [{ op: 'unicode-case', args: { mode: 'upper' } }] },
      output: 'A | B | C',
    },
  ],
  args: [stringArg('split', '\n'), stringArg('merge', '\n'), stepsArg()],
  async run(text, args, ctx) {
    const sep = args.text('split');
    // Python's list(str) splits by code point.
    const parts = sep === '' ? Array.from(text) : text.split(sep);
    const out: string[] = [];
    for (const [i, part] of parts.entries()) {
      const result = await ctx.runNested(args.steps(), ofString(part), 'branch', i);
      out.push(coerce(result, 'string', ctx.warn).value as string);
    }
    return out.join(args.text('merge'));
  },
});

export const subRecipe = defineOp({
  id: 'sub-recipe',
  name: 'Sub-recipe',
  category: 'Flow',
  description:
    'Run `steps` as one group. The runner keeps the dish type across the group; this ' +
    'function serves direct calls only.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [
    {
      input: 'hello',
      args: { steps: [{ op: 'to-base64' }, { op: 'reverse' }] },
      output: '=8GbsVGa',
    },
  ],
  args: [stepsArg()],
  async run(data, args, ctx) {
    const result = await ctx.runNested(args.steps(), ofBytes(data));
    return coerce(result, 'bytes', ctx.warn).value as Uint8Array;
  },
});

export const label = defineOp({
  id: 'label',
  name: 'Label',
  category: 'Flow',
  description: 'A jump target. The dish passes through unchanged, whatever its type.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [{ input: 'unchanged', args: { name: 'start' }, output: 'unchanged' }],
  args: [stringArg('name')],
  run: (data) => data,
});

export const comment = defineOp({
  id: 'comment',
  name: 'Comment',
  category: 'Flow',
  description: 'An annotation. The dish passes through unchanged, whatever its type.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [{ input: 'unchanged', args: { text: 'notes for readers' }, output: 'unchanged' }],
  args: [stringArg('text', '', true)],
  run: (data) => data,
});

export const jump = defineOp({
  id: 'jump',
  name: 'Jump',
  category: 'Flow',
  description:
    'Jump to the label `to`, at most `max` times; then continue with a W_JUMP_LIMIT ' +
    'warning. Every jump counts towards the step limit.',
  inputType: 'string',
  outputType: 'string',
  args: [stringArg('to'), intArg('max', 10, 0, 1000)],
  run: () => true,
});

/** Ops that need no regex engine; `conditional-jump` and `subsection` are in flow-regex.ts. */
export const FLOW_OPS: readonly Operation[] = [fork, subRecipe, label, comment, jump];
