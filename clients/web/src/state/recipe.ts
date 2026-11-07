// SPDX-License-Identifier: GPL-3.0-or-later
/** The editable recipe: plain JSON args plus a stable `uid` per step for React keys. */

import { getOperation, type ArgSpec } from '@unichef/core';

import type { RecipeDoc } from '../worker/protocol.js';

export interface BytesArg {
  readonly encoding: string;
  readonly value: string;
}

export type RawArg = string | number | boolean | BytesArg | readonly StepModel[];

export interface StepModel {
  readonly uid: string;
  readonly op: string;
  readonly args: Readonly<Record<string, RawArg>>;
  readonly disabled: boolean;
  readonly breakpoint: boolean;
}

let counter = 0;
export const newUid = (): string => `s${(++counter).toString(36)}`;

export function defaultRaw(spec: ArgSpec): RawArg {
  switch (spec.kind) {
    case 'steps':
      return [];
    case 'bytes':
      return { encoding: spec.encodings[0] ?? 'hex', value: spec.default };
    default:
      return spec.default;
  }
}

export function newStep(op: string): StepModel {
  const args: Record<string, RawArg> = {};
  for (const spec of getOperation(op).args) args[spec.name] = defaultRaw(spec);
  return { uid: newUid(), op, args, disabled: false, breakpoint: false };
}

export const isSteps = (value: RawArg | undefined): value is readonly StepModel[] =>
  Array.isArray(value);

/** Apply `fn` to the step list that holds `uid`, at any depth. */
export function updateList(
  steps: readonly StepModel[],
  uid: string,
  fn: (list: readonly StepModel[], index: number) => readonly StepModel[],
): readonly StepModel[] {
  const index = steps.findIndex((s) => s.uid === uid);
  if (index >= 0) return fn(steps, index);
  const out = steps.map((step) => {
    let args = step.args;
    for (const [name, value] of Object.entries(step.args)) {
      if (!isSteps(value)) continue;
      const next = updateList(value, uid, fn);
      if (next !== value) args = { ...args, [name]: next };
    }
    return args === step.args ? step : { ...step, args };
  });
  return out.some((step, i) => step !== steps[i]) ? out : steps;
}

/** Replace step `uid` with `fn(step)`. */
export const updateStep = (
  steps: readonly StepModel[],
  uid: string,
  fn: (step: StepModel) => StepModel,
): readonly StepModel[] =>
  updateList(steps, uid, (list, i) => list.map((s, j) => (j === i ? fn(s) : s)));

export const removeStep = (steps: readonly StepModel[], uid: string): readonly StepModel[] =>
  updateList(steps, uid, (list, i) => list.filter((_, j) => j !== i));

/** Move step `uid` by `delta` places within its own list. */
export const moveStep = (
  steps: readonly StepModel[],
  uid: string,
  delta: number,
): readonly StepModel[] =>
  updateList(steps, uid, (list, i) => {
    const to = i + delta;
    if (to < 0 || to >= list.length) return list;
    const out = [...list];
    const [step] = out.splice(i, 1);
    if (step !== undefined) out.splice(to, 0, step);
    return out;
  });

function stepDoc(step: StepModel): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(step.args)) {
    args[name] = isSteps(value) ? value.map(stepDoc) : value;
  }
  return {
    op: step.op,
    args,
    ...(step.disabled ? { disabled: true } : {}),
    ...(step.breakpoint ? { breakpoint: true } : {}),
  };
}

/** The recipe JSON document the worker validates with `parseRecipe`. */
export const recipeDoc = (steps: readonly StepModel[]): RecipeDoc => ({
  version: 1,
  steps: steps.map(stepDoc),
});
