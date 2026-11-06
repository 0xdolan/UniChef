// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Recipe parsing and two-phase validation (PRD §3.4).
 *
 * Phase 1 checks the shape against `spec/recipe.schema.json` (mirrored here so the core
 * needs no JSON Schema engine). Phase 2 resolves every operation and argument, and checks
 * labels, jump targets and nesting depth. Input is plain JSON data (`JSON.parse`) or a
 * `JsonValue` with `Map` objects.
 */

import { UniChefError, type PathItem } from '../errors.js';
import { getOperation } from '../ops/registry.js';
import {
  BytesValue,
  JS_SAFE_INTEGER,
  argSpec,
  pyRepr,
  type ArgSpec,
  type ArgValue,
  type BytesEncoding,
  type Operation,
  type Step,
} from '../ops/types.js';

const OP_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LABEL = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SEED = /^[0-9a-f]{32}$/;
const DECIMAL = /^-?(?:0|[1-9][0-9]*)$/;
const STEP_KEYS = new Set(['op', 'args', 'disabled', 'breakpoint', 'label', 'comment']);
const RECIPE_KEYS = new Set(['version', 'name', 'description', 'seed', 'steps']);
export const MAX_STEPS_PER_LIST = 1000;
export const MAX_DEPTH = 8;
export const JUMP_OPS: ReadonlySet<string> = new Set(['jump', 'conditional-jump']);

export interface Recipe {
  readonly steps: readonly Step[];
  readonly name: string | null;
  readonly description: string | null;
  readonly seed: string | null;
  readonly version: 1;
}

type Obj = ReadonlyMap<string, unknown>;

/** View a JSON object (plain or `Map`) as a map, or `null` if `raw` is not one. */
function asObject(raw: unknown): Obj | null {
  if (raw instanceof Map) {
    return raw as Obj;
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return new Map(Object.entries(raw));
  }
  return null;
}

function codePointLength(s: string): number {
  return Array.from(s).length;
}

function firstSorted(keys: Iterable<string>): string {
  return [...keys].sort()[0] ?? '';
}

function schemaError(path: readonly PathItem[], message: string): UniChefError {
  return new UniChefError('E_RECIPE_SCHEMA', message, path);
}

function checkStr(value: unknown, path: readonly PathItem[], what: string, max: number): string {
  if (typeof value !== 'string') {
    throw schemaError(path, `${what} must be a string.`);
  }
  if (codePointLength(value) > max) {
    throw schemaError(path, `${what} is longer than ${max} characters.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Arguments

function argError(op: Operation, spec: ArgSpec, message: string): UniChefError {
  return new UniChefError('E_ARG_INVALID', `${op.id}: argument ${pyRepr(spec.name)} ${message}`);
}

function integerValue(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && Math.abs(raw) <= JS_SAFE_INTEGER ? raw + 0 : null;
  }
  if (typeof raw === 'bigint') {
    return raw >= -BigInt(JS_SAFE_INTEGER) && raw <= BigInt(JS_SAFE_INTEGER) ? Number(raw) : null;
  }
  if (typeof raw === 'string' && DECIMAL.test(raw)) {
    // Decimal strings are how recipes spell integers beyond 2^53 - 1; every integer
    // argument has bounds well inside that range, so the min/max checks reject them.
    const big = BigInt(raw);
    if (big > BigInt(JS_SAFE_INTEGER)) {
      return Number.POSITIVE_INFINITY;
    }
    if (big < -BigInt(JS_SAFE_INTEGER)) {
      return Number.NEGATIVE_INFINITY;
    }
    return Number(big);
  }
  return null;
}

function resolveInteger(op: Operation, spec: ArgSpec & { kind: 'integer' }, raw: unknown): number {
  const value = integerValue(raw);
  if (value === null) {
    throw argError(op, spec, 'must be an integer.');
  }
  if (spec.min !== undefined && value < spec.min) {
    throw argError(op, spec, `must be at least ${spec.min}.`);
  }
  if (spec.max !== undefined && value > spec.max) {
    throw argError(op, spec, `must be at most ${spec.max}.`);
  }
  if (!Number.isFinite(value)) {
    throw argError(op, spec, 'must be an integer.');
  }
  return value;
}

function resolveBytes(op: Operation, spec: ArgSpec & { kind: 'bytes' }, raw: unknown): BytesValue {
  const obj = asObject(raw);
  const encoding = obj?.get('encoding');
  const value = obj?.get('value');
  if (
    obj?.size !== 2 ||
    typeof encoding !== 'string' ||
    !spec.encodings.includes(encoding as BytesEncoding) ||
    typeof value !== 'string'
  ) {
    throw argError(op, spec, `must be {"encoding": ${spec.encodings.join('|')}, "value": string}.`);
  }
  const out = new BytesValue(encoding as BytesEncoding, value);
  out.decode(spec.name);
  return out;
}

/** Validate one raw JSON argument value against its spec. */
export function resolveArg(
  op: Operation,
  spec: ArgSpec,
  raw: unknown,
  path: readonly PathItem[],
  depth: number,
): ArgValue {
  switch (spec.kind) {
    case 'string':
    case 'regex':
      if (typeof raw !== 'string') {
        throw argError(op, spec, 'must be a string.');
      }
      return raw;
    case 'enum':
      if (typeof raw !== 'string' || !spec.options.includes(raw)) {
        throw argError(op, spec, `must be one of ${spec.options.join(', ')}.`);
      }
      return raw;
    case 'boolean':
      if (typeof raw !== 'boolean') {
        throw argError(op, spec, 'must be true or false.');
      }
      return raw;
    case 'integer':
      return resolveInteger(op, spec, raw);
    case 'bytes':
      return resolveBytes(op, spec, raw);
    case 'steps':
      if (!Array.isArray(raw)) {
        throw argError(op, spec, 'must be a list of steps.');
      }
      return parseSteps(raw, path, depth + 1);
  }
}

export function defaultArg(spec: ArgSpec): ArgValue {
  switch (spec.kind) {
    case 'steps':
      return [];
    case 'bytes':
      return new BytesValue(spec.encodings[0] ?? 'hex', spec.default);
    default:
      return spec.default;
  }
}

/** Resolve named args: unknown names are errors, missing ones take their default. */
export function resolveArgs(
  op: Operation,
  raw: unknown,
  path: readonly PathItem[] = [],
  depth = 1,
): Map<string, ArgValue> {
  const given = asObject(raw) ?? new Map<string, unknown>();
  for (const name of given.keys()) {
    if (argSpec(op, name) === undefined) {
      throw new UniChefError(
        'E_ARG_INVALID',
        `${op.id}: unknown argument ${pyRepr(name.slice(0, 64))}.`,
        path,
      );
    }
  }
  const out = new Map<string, ArgValue>();
  for (const spec of op.args) {
    if (given.has(spec.name)) {
      try {
        out.set(spec.name, resolveArg(op, spec, given.get(spec.name), path, depth));
      } catch (exc) {
        if (exc instanceof UniChefError && exc.path.length === 0) {
          exc.path = [...path];
        }
        throw exc;
      }
    } else {
      out.set(spec.name, defaultArg(spec));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Steps

function parseStep(raw: unknown, path: readonly PathItem[], depth: number): Step {
  const obj = asObject(raw);
  if (obj === null) {
    throw schemaError(path, 'A step must be an object.');
  }
  const extra = [...obj.keys()].filter((k) => !STEP_KEYS.has(k));
  if (extra.length > 0) {
    throw schemaError(path, `Unknown step property ${pyRepr(firstSorted(extra).slice(0, 64))}.`);
  }
  const opId = obj.get('op');
  if (typeof opId !== 'string' || !OP_ID.test(opId)) {
    throw schemaError(path, "A step needs an 'op' id in kebab-case.");
  }
  const rawArgs = obj.has('args') ? obj.get('args') : new Map();
  if (asObject(rawArgs) === null) {
    throw schemaError(path, "Step 'args' must be an object.");
  }
  for (const key of ['disabled', 'breakpoint']) {
    if (obj.has(key) && typeof obj.get(key) !== 'boolean') {
      throw schemaError(path, `Step ${pyRepr(key)} must be true or false.`);
    }
  }
  const label = obj.get('label') ?? null;
  if (label !== null && (typeof label !== 'string' || !LABEL.test(label))) {
    throw schemaError(path, "Step 'label' must match ^[A-Za-z_][A-Za-z0-9_]{0,63}$.");
  }
  const comment = obj.get('comment') ?? null;
  if (comment !== null) {
    checkStr(comment, path, "Step 'comment'", 2000);
  }
  let op: Operation;
  try {
    op = getOperation(opId);
  } catch (exc) {
    throw exc instanceof UniChefError ? exc.withPrefix(...path) : exc;
  }
  const args = resolveArgs(op, rawArgs, path, depth);
  return {
    op: opId,
    args,
    disabled: obj.get('disabled') === true,
    breakpoint: obj.get('breakpoint') === true,
    label: label,
    comment: comment as string | null,
  };
}

/** Map each label name in one step list to its index. Names must be unique. */
export function jumpTargets(
  steps: readonly Step[],
  path: readonly PathItem[],
): Map<string, number> {
  const targets = new Map<string, number>();
  steps.forEach((step, i) => {
    const names = new Set<string>();
    if (step.label) {
      names.add(step.label);
    }
    if (step.op === 'label') {
      names.add(step.args.get('name') as string);
    }
    for (const name of names) {
      if (targets.has(name)) {
        throw schemaError([...path, i], `Duplicate label ${pyRepr(name)}.`);
      }
      targets.set(name, i);
    }
  });
  return targets;
}

/** Parse a step list at nesting `depth` (the top level is 1). */
export function parseSteps(
  raw: readonly unknown[],
  path: readonly PathItem[],
  depth: number,
): Step[] {
  if (depth > MAX_DEPTH) {
    throw new UniChefError('E_LIMIT', `Recipes may nest at most ${MAX_DEPTH} levels.`, path);
  }
  if (raw.length > MAX_STEPS_PER_LIST) {
    throw schemaError(path, `A step list holds at most ${MAX_STEPS_PER_LIST} steps.`);
  }
  const steps = raw.map((item, i) => parseStep(item, [...path, i], depth));
  const targets = jumpTargets(steps, path);
  steps.forEach((step, i) => {
    if (JUMP_OPS.has(step.op)) {
      const to = step.args.get('to') as string;
      if (!targets.has(to)) {
        throw schemaError([...path, i], `Jump target ${pyRepr(to.slice(0, 64))} does not exist.`);
      }
    }
  });
  return steps;
}

/** Validate a decoded recipe document and resolve it (both phases). */
export function parseRecipe(raw: unknown): Recipe {
  const obj = asObject(raw);
  if (obj === null) {
    throw schemaError([], 'A recipe must be a JSON object.');
  }
  const extra = [...obj.keys()].filter((k) => !RECIPE_KEYS.has(k));
  if (extra.length > 0) {
    throw schemaError([], `Unknown recipe property ${pyRepr(firstSorted(extra).slice(0, 64))}.`);
  }
  const version = obj.get('version');
  if (version !== 1 && version !== 1n) {
    throw schemaError([], "Recipe 'version' must be 1.");
  }
  const name = obj.get('name') ?? null;
  if (name !== null) {
    checkStr(name, [], "Recipe 'name'", 200);
  }
  const description = obj.get('description') ?? null;
  if (description !== null) {
    checkStr(description, [], "Recipe 'description'", 5000);
  }
  const seed = obj.get('seed') ?? null;
  if (seed !== null && (typeof seed !== 'string' || !SEED.test(seed))) {
    throw schemaError([], "Recipe 'seed' must be 32 lower-case hex digits.");
  }
  const steps = obj.get('steps');
  if (!Array.isArray(steps)) {
    throw schemaError([], "Recipe 'steps' must be an array.");
  }
  return {
    steps: parseSteps(steps, [], 1),
    name: name as string | null,
    description: description as string | null,
    seed: seed,
    version: 1,
  };
}
