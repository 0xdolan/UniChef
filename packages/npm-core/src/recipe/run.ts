// SPDX-License-Identifier: GPL-3.0-or-later
/** Recipe execution: coercion between steps, flow control and limits (PRD §3.2-§3.6). */

import { coerce } from '../dish/coerce.js';
import { makeDish, type Dish } from '../dish/types.js';
import { scrub } from '../dish/utf8.js';
import { UniChefError, type PathItem, type RunWarning } from '../errors.js';
import { getOperation } from '../ops/registry.js';
import { Args, OpContext, Rng, outputLimit, type Limits, type Step } from '../ops/types.js';
import { VERSION } from '../version.js';
import { JUMP_OPS, checkJumps, jumpTargets, resolveArgs, type Recipe } from './validate.js';

/** No-op steps: the dish passes through with its type unchanged. */
export const PASSTHROUGH_OPS: ReadonlySet<string> = new Set(['label', 'comment']);

export interface BakeResult {
  readonly dish: Dish;
  readonly warnings: readonly RunWarning[];
  readonly stepsExecuted: number;
  /** Top-level index of the step the bake stopped before (`until` or a breakpoint). */
  readonly stoppedAt: number | null;
}

/** One executed step, reported through `BakeOptions.onStep`. */
export interface StepEvent {
  /** The step path, e.g. `[2]` or `[2, 0]` inside a sub-recipe. */
  readonly path: readonly PathItem[];
  readonly dish: Dish;
  /** Wall time of the step in milliseconds, nested steps included. */
  readonly ms: number;
}

export interface BakeOptions {
  readonly limits?: Limits;
  /** Called after every executed step, at any depth, with the dish it produced. */
  readonly onStep?: (event: StepEvent) => void;
  readonly signal?: AbortSignal;
  readonly ctx?: OpContext;
  readonly until?: number;
  readonly breakpoints?: boolean;
}

/** Size used for the input and output limits: bytes, UTF-16 units, items or cells. */
export function dishSize(dish: Dish): number {
  switch (dish.type) {
    case 'bytes':
    case 'string':
    case 'codepoints':
      return dish.value.length;
    case 'table':
      return dish.value.rows.reduce((n, row) => n + row.length, 0);
    default:
      return 0;
  }
}

function isStackOverflow(exc: unknown): boolean {
  return exc instanceof RangeError && /call stack/i.test(exc.message);
}

/** Executes step lists against one context. Not reusable across bakes. */
class Runner {
  executed = 0;

  constructor(
    readonly ctx: OpContext,
    private readonly onStep?: (event: StepEvent) => void,
  ) {
    ctx.nested = (steps, dish, path) => this.runSteps(steps, dish, path);
  }

  async runStep(step: Step, dish: Dish, path: readonly PathItem[]): Promise<Dish> {
    const op = getOperation(step.op);
    const ctx = this.ctx;
    ctx.check();
    const saved = ctx.path;
    ctx.path = path;
    try {
      const source = coerce(dish, op.inputType, ctx.warn);
      const value = (await op.run(source.value, new Args(step.args), ctx)) as Dish['value'];
      let result = makeDish(op.outputType, value as never);
      if (result.type === 'string') {
        result = { type: 'string', value: scrub(result.value) };
      }
      const limit = outputLimit(ctx.limits, dishSize(source));
      if (dishSize(result) > limit) {
        throw new UniChefError('E_LIMIT', `${op.id} produced more than ${limit} units of output.`);
      }
      return result;
    } catch (exc) {
      if (exc instanceof UniChefError) {
        if (exc.path.length === 0) {
          exc.path = [...path];
        }
        throw exc;
      }
      if (isStackOverflow(exc)) {
        throw new UniChefError('E_LIMIT', `${op.id}: input is nested too deeply.`, path);
      }
      const kind = exc instanceof Error ? exc.name : typeof exc;
      throw new UniChefError(
        'E_INTERNAL',
        `${op.id} failed unexpectedly (${kind}); please report this with UniChef ${VERSION}.`,
        path,
      );
    } finally {
      ctx.path = saved;
    }
  }

  private count(path: readonly PathItem[]): void {
    this.executed += 1;
    if (this.executed > this.ctx.limits.maxSteps) {
      throw new UniChefError(
        'E_LIMIT',
        `The bake executed more than ${this.ctx.limits.maxSteps} steps.`,
        path,
      );
    }
  }

  private async shouldJump(step: Step, dish: Dish): Promise<boolean> {
    if (step.op === 'jump') {
      return true;
    }
    const op = getOperation(step.op);
    const text = coerce(dish, 'string', this.ctx.warn).value;
    return Boolean(await op.run(text as never, new Args(step.args), this.ctx));
  }

  async runSteps(steps: readonly Step[], dish: Dish, path: readonly PathItem[]): Promise<Dish> {
    return (await this.runList(steps, dish, path)).dish;
  }

  async runList(
    steps: readonly Step[],
    dish: Dish,
    path: readonly PathItem[],
    until?: number,
    breakpoints = false,
  ): Promise<{ dish: Dish; stoppedAt: number | null }> {
    const targets = jumpTargets(steps, path);
    const jumps = new Map<number, number>();
    let current = dish;
    let i = 0;
    while (i < steps.length) {
      const step = steps[i];
      if (step === undefined) {
        break;
      }
      const here = [...path, i];
      if ((until !== undefined && i >= until) || (breakpoints && step.breakpoint)) {
        return { dish: current, stoppedAt: i };
      }
      if (step.disabled) {
        i += 1;
        continue;
      }
      this.count(here);
      if (PASSTHROUGH_OPS.has(step.op)) {
        this.onStep?.({ path: here, dish: current, ms: 0 });
        i += 1;
        continue;
      }
      if (step.op === 'sub-recipe') {
        // A scope keeps the dish type, so it bypasses input coercion.
        const start = performance.now();
        current = await this.runSteps(step.args.get('steps') as readonly Step[], current, here);
        this.onStep?.({ path: here, dish: current, ms: performance.now() - start });
        i += 1;
        continue;
      }
      if (JUMP_OPS.has(step.op)) {
        this.ctx.path = here;
        if (await this.shouldJump(step, current)) {
          const taken = jumps.get(i) ?? 0;
          const max = step.args.get('max') as number;
          const to = step.args.get('to') as string;
          if (taken < max) {
            jumps.set(i, taken + 1);
            i = targets.get(to) ?? i + 1;
            continue;
          }
          if (taken === max) {
            jumps.set(i, taken + 1);
            this.ctx.warn('W_JUMP_LIMIT', `Jump to ${to} reached its limit of ${max}; continuing.`);
          }
        }
        i += 1;
        continue;
      }
      const start = performance.now();
      current = await this.runStep(step, current, here);
      this.onStep?.({ path: here, dish: current, ms: performance.now() - start });
      i += 1;
    }
    return { dish: current, stoppedAt: null };
  }
}

/** Run `recipe` on `dish`. Throws `UniChefError` with the step path on failure. */
export async function bake(
  recipe: Recipe,
  dish: Dish,
  options: BakeOptions = {},
): Promise<BakeResult> {
  const ctx =
    options.ctx ??
    new OpContext({
      ...(options.limits === undefined ? {} : { limits: options.limits }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      rng: new Rng(recipe.seed),
    });
  if (dishSize(dish) > ctx.limits.maxInputSize) {
    throw new UniChefError('E_LIMIT', `The input is larger than ${ctx.limits.maxInputSize} bytes.`);
  }
  const runner = new Runner(ctx, options.onStep);
  const { dish: out, stoppedAt } = await runner.runList(
    recipe.steps,
    dish,
    [],
    options.until,
    options.breakpoints ?? false,
  );
  return { dish: out, warnings: ctx.warnings, stepsExecuted: runner.executed, stoppedAt };
}

/** Run one operation with raw (JSON) arguments, as `unichef op` does. */
export async function runOperation(
  opId: string,
  args: unknown,
  dish: Dish,
  options: BakeOptions = {},
): Promise<BakeResult> {
  const op = getOperation(opId);
  const step: Step = {
    op: opId,
    args: resolveArgs(op, args ?? {}, [0]),
    disabled: false,
    breakpoint: false,
    label: null,
    comment: null,
  };
  checkJumps([step], []);
  return bake(
    { steps: [step], name: null, description: null, seed: null, version: 1 },
    dish,
    options,
  );
}
