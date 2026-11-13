// SPDX-License-Identifier: GPL-3.0-or-later
/** The editable recipe: plain JSON args plus a stable `uid` per step for React keys. */

import { getOperationInfo, hasOperationInfo, parseRecipe, type ArgSpec } from '@unichef/core';

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
  readonly label?: string;
  readonly comment?: string;
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
  for (const spec of getOperationInfo(op).args) args[spec.name] = defaultRaw(spec);
  return { uid: newUid(), op, args, disabled: false, breakpoint: false };
}

export const isSteps = (value: RawArg | undefined): value is readonly StepModel[] =>
  Array.isArray(value);

/** What a shared link holds in place of a key or IV (SEC-007). */
export const REDACTED = '<redacted>';

/** A recipe document may give a bytes argument as a bare string. */
const secretText = (value: RawArg): string =>
  typeof value === 'string' ? value : (value as BytesArg).value;

/** Every key and IV value in `steps`, at any depth. */
function secretValues(steps: readonly StepModel[]): string[] {
  return steps.flatMap((step) =>
    getOperationInfo(step.op).args.flatMap((spec) => {
      const value = step.args[spec.name];
      if (value === undefined) return [];
      if (isSteps(value)) return secretValues(value);
      return spec.kind === 'bytes' && spec.secret === true ? [secretText(value)] : [];
    }),
  );
}

export const hasSecrets = (steps: readonly StepModel[]): boolean =>
  secretValues(steps).some((value) => value !== '');

/** `steps` with each non-empty key and IV replaced by `REDACTED`. */
export function redactSecrets(steps: readonly StepModel[]): readonly StepModel[] {
  return steps.map((step) => {
    const args: Record<string, RawArg> = { ...step.args };
    for (const spec of getOperationInfo(step.op).args) {
      const value = args[spec.name];
      if (value === undefined) continue;
      if (isSteps(value)) args[spec.name] = redactSecrets(value);
      else if (spec.kind === 'bytes' && spec.secret === true && secretText(value) !== '') {
        args[spec.name] =
          typeof value === 'string' ? REDACTED : { ...(value as BytesArg), value: REDACTED };
      }
    }
    return { ...step, args };
  });
}

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

/** Move step `uid` to where step `over` is, when both are in the same list (drag and drop). */
export const moveTo = (
  steps: readonly StepModel[],
  uid: string,
  over: string,
): readonly StepModel[] =>
  updateList(steps, uid, (list, i) => {
    const to = list.findIndex((s) => s.uid === over);
    if (to < 0 || to === i) return list;
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
    ...(step.label === undefined ? {} : { label: step.label }),
    ...(step.comment === undefined ? {} : { comment: step.comment }),
  };
}

/** The recipe JSON document the worker validates with `parseRecipe`. */
export const recipeDoc = (steps: readonly StepModel[]): RecipeDoc => ({
  version: 1,
  steps: steps.map(stepDoc),
});

type Json = Readonly<Record<string, unknown>>;

function stepFromDoc(raw: Json): StepModel {
  const step = newStep(raw.op as string);
  const given = (raw.args ?? {}) as Json;
  const args: Record<string, RawArg> = { ...step.args };
  for (const spec of getOperationInfo(step.op).args) {
    const value = given[spec.name];
    if (value === undefined) continue;
    args[spec.name] =
      spec.kind === 'steps' ? (value as readonly Json[]).map(stepFromDoc) : (value as RawArg);
  }
  return {
    ...step,
    args,
    disabled: raw.disabled === true,
    breakpoint: raw.breakpoint === true,
    ...(typeof raw.label === 'string' ? { label: raw.label } : {}),
    ...(typeof raw.comment === 'string' ? { comment: raw.comment } : {}),
  };
}

/**
 * `doc` with each redacted key and IV emptied, so that it validates, and whether it had
 * any. `doc` is still unvalidated, so anything unexpected is left for `parseRecipe`.
 */
export function clearRedacted(doc: unknown): { doc: unknown; redacted: boolean } {
  let redacted = false;
  const clear = (value: unknown): unknown => {
    if (value === REDACTED) {
      redacted = true;
      return '';
    }
    if (typeof value === 'object' && value !== null && (value as Json).value === REDACTED) {
      redacted = true;
      return { ...(value as Json), value: '' };
    }
    return value;
  };
  const walk = (steps: unknown): unknown => {
    if (!Array.isArray(steps)) return steps;
    return steps.map((raw: unknown) => {
      const step = raw as Json | null;
      if (typeof step !== 'object' || step === null) return raw;
      if (typeof step.op !== 'string' || !hasOperationInfo(step.op)) return raw;
      if (typeof step.args !== 'object' || step.args === null) return raw;
      const args: Record<string, unknown> = { ...(step.args as Json) };
      for (const spec of getOperationInfo(step.op).args) {
        if (spec.kind === 'steps') args[spec.name] = walk(args[spec.name]);
        else if (spec.kind === 'bytes' && spec.secret === true) {
          args[spec.name] = clear(args[spec.name]);
        }
      }
      return { ...step, args };
    });
  };
  if (typeof doc !== 'object' || doc === null) return { doc, redacted };
  return { doc: { ...(doc as Json), steps: walk((doc as Json).steps) }, redacted };
}

/**
 * The editable steps of a recipe document from outside (a shared link). `parseRecipe`
 * validates it first and throws `UniChefError`, so the casts below only see valid shapes.
 */
export function stepsFromDoc(doc: unknown): StepModel[] {
  parseRecipe(doc);
  return ((doc as Json).steps as readonly Json[]).map(stepFromDoc);
}
