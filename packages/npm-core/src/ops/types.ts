// SPDX-License-Identifier: GPL-3.0-or-later
/** Operation contract, argument specs and run context (PRD §3.3). */

import { sha256 } from '@noble/hashes/sha2.js';

import type { Dish, DishType, DishValues, JsonValue } from '../dish/types.js';
import { decode as base64Decode } from '../dish/base64.js';
import { encode as utf8Encode } from '../dish/utf8.js';
import { UniChefError, type PathItem, type RunWarning, type WarningCode } from '../errors.js';

export type BytesEncoding = 'hex' | 'utf8' | 'base64' | 'latin1';
export type ParityClass = 'exact' | 'roundtrip' | 'nondeterministic';
export type Category =
  | 'Encoding'
  | 'Unicode'
  | 'Security'
  | 'Hashing'
  | 'Crypto'
  | 'Text'
  | 'Flow'
  | 'Compression'
  | 'Data';

export const JS_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
export const ALL_ENCODINGS: readonly BytesEncoding[] = ['hex', 'utf8', 'base64', 'latin1'];

/** One named argument. Integer arguments are JS numbers bounded to the safe range. */
export type ArgSpec =
  | {
      readonly kind: 'string';
      readonly name: string;
      readonly default: string;
      readonly multiline?: boolean;
    }
  | {
      readonly kind: 'bytes';
      readonly name: string;
      readonly default: string;
      readonly encodings: readonly BytesEncoding[];
    }
  | {
      readonly kind: 'integer';
      readonly name: string;
      readonly default: number;
      readonly min?: number;
      readonly max?: number;
    }
  | { readonly kind: 'boolean'; readonly name: string; readonly default: boolean }
  | {
      readonly kind: 'enum';
      readonly name: string;
      readonly options: readonly string[];
      readonly default: string;
    }
  | {
      readonly kind: 'regex';
      readonly name: string;
      readonly default: string;
      readonly flags: string;
    }
  | { readonly kind: 'steps'; readonly name: string };

export type ArgKind = ArgSpec['kind'];

export const stringArg = (name: string, def = '', multiline = false): ArgSpec =>
  multiline
    ? { kind: 'string', name, default: def, multiline }
    : { kind: 'string', name, default: def };

export const enumArg = (name: string, options: readonly string[], def?: string): ArgSpec => ({
  kind: 'enum',
  name,
  options,
  default: def ?? options[0] ?? '',
});

export const boolArg = (name: string, def = false): ArgSpec => ({
  kind: 'boolean',
  name,
  default: def,
});

export function intArg(name: string, def: number, min?: number, max?: number): ArgSpec {
  return {
    kind: 'integer',
    name,
    default: def,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  };
}

export const bytesArg = (
  name: string,
  def = '',
  encodings: readonly BytesEncoding[] = ALL_ENCODINGS,
): ArgSpec => ({ kind: 'bytes', name, default: def, encodings });

export const regexArg = (name: string, def = '', flags = ''): ArgSpec => ({
  kind: 'regex',
  name,
  default: def,
  flags,
});

export const stepsArg = (name = 'steps'): ArgSpec => ({ kind: 'steps', name });

/** A bytes argument as written in a recipe: `{"encoding": …, "value": …}`. */
export class BytesValue {
  constructor(
    readonly encoding: BytesEncoding,
    readonly value: string,
  ) {}

  decode(name: string): Uint8Array {
    const out = this.tryDecode();
    if (out === null) {
      throw new UniChefError(
        'E_ARG_INVALID',
        `Argument ${pyRepr(name)} is not valid ${this.encoding}.`,
      );
    }
    return out;
  }

  private tryDecode(): Uint8Array | null {
    switch (this.encoding) {
      case 'hex':
        return hexFromPython(this.value);
      case 'utf8':
        return utf8Encode(this.value);
      case 'base64':
        return base64Decode(this.value);
      case 'latin1': {
        const out = new Uint8Array(this.value.length);
        for (let i = 0; i < this.value.length; i += 1) {
          const c = this.value.charCodeAt(i);
          if (c > 0xff) {
            return null;
          }
          out[i] = c;
        }
        return out;
      }
    }
  }
}

/** `bytes.fromhex`: hex pairs, with ASCII whitespace allowed between pairs. */
function hexFromPython(text: string): Uint8Array | null {
  const out: number[] = [];
  let i = 0;
  while (i < text.length) {
    if (' \t\n\r\v\f'.includes(text[i] ?? '')) {
      i += 1;
      continue;
    }
    const pair = text.slice(i, i + 2);
    if (!/^[0-9A-Fa-f]{2}$/.test(pair)) {
      return null;
    }
    out.push(Number.parseInt(pair, 16));
    i += 2;
  }
  return Uint8Array.from(out);
}

/** Python `repr()` of a string, as used in error messages shared with the Python core. */
export function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === '\\') {
      out += '\\\\';
    } else if (ch === quote) {
      out += `\\${quote}`;
    } else if (ch === '\n') {
      out += '\\n';
    } else if (ch === '\r') {
      out += '\\r';
    } else if (ch === '\t') {
      out += '\\t';
    } else if (cp < 0x20 || cp === 0x7f) {
      out += `\\x${cp.toString(16).padStart(2, '0')}`;
    } else if (cp >= 0xd800 && cp <= 0xdfff) {
      out += `\\u${cp.toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
  }
  return out + quote;
}

export type ArgValue = string | number | boolean | BytesValue | readonly Step[];

/** One recipe step (PRD §3.4). `args` holds the resolved values after validation. */
export interface Step {
  readonly op: string;
  readonly args: ReadonlyMap<string, ArgValue>;
  readonly disabled: boolean;
  readonly breakpoint: boolean;
  readonly label: string | null;
  readonly comment: string | null;
}

/** Resolved argument values with typed accessors. */
export class Args {
  constructor(private readonly values: ReadonlyMap<string, ArgValue>) {}

  private get(name: string): ArgValue {
    const v = this.values.get(name);
    if (v === undefined) {
      throw new UniChefError('E_INTERNAL', `Missing argument ${name}; please report this.`);
    }
    return v;
  }

  text(name: string): string {
    return this.get(name) as string;
  }

  int(name: string): number {
    return this.get(name) as number;
  }

  flag(name: string): boolean {
    return this.get(name) as boolean;
  }

  data(name: string): Uint8Array {
    return (this.get(name) as BytesValue).decode(name);
  }

  steps(name = 'steps'): readonly Step[] {
    return this.get(name) as readonly Step[];
  }

  raw(): ReadonlyMap<string, ArgValue> {
    return this.values;
  }
}

/** Run limits (PRD §3.5, §3.6). Defaults are the CLI defaults. */
export interface Limits {
  readonly maxInputSize: number;
  readonly minOutputSize: number;
  readonly outputFactor: number;
  readonly regexTimeoutMs: number;
  readonly maxSteps: number;
  readonly maxDepth: number;
}

export const DEFAULT_LIMITS: Limits = {
  maxInputSize: GiB,
  minOutputSize: 64 * MiB,
  outputFactor: 4,
  regexTimeoutMs: 2000,
  maxSteps: 100_000,
  maxDepth: 8,
};

export function outputLimit(limits: Limits, inputSize: number): number {
  return Math.max(limits.outputFactor * inputSize, limits.minOutputSize);
}

/** Random bytes: SHA-256 in counter mode when seeded, else the platform CSPRNG. */
export class Rng {
  private counter = 0n;
  private readonly seed: Uint8Array | null;

  constructor(seed?: string | null) {
    this.seed = seed == null ? null : hexFromPython(seed);
  }

  get seeded(): boolean {
    return this.seed !== null;
  }

  randomBytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    if (this.seed === null) {
      for (let i = 0; i < n; i += 65536) {
        globalThis.crypto.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
      }
      return out;
    }
    const block = new Uint8Array(this.seed.length + 8);
    block.set(this.seed);
    const view = new DataView(block.buffer);
    for (let o = 0; o < n; o += 32) {
      view.setBigUint64(this.seed.length, this.counter);
      out.set(sha256(block).subarray(0, Math.min(32, n - o)), o);
      this.counter += 1n;
    }
    return out;
  }
}

export type NestedRunner = (
  steps: readonly Step[],
  dish: Dish,
  path: readonly PathItem[],
) => Promise<Dish>;

/** Per-bake state passed to every operation (PRD §3.3). */
export class OpContext {
  readonly limits: Limits;
  readonly signal: AbortSignal | undefined;
  readonly rng: Rng;
  readonly warnings: RunWarning[] = [];
  path: readonly PathItem[] = [];
  nested: NestedRunner | null = null;

  constructor(options: { limits?: Limits; signal?: AbortSignal; rng?: Rng } = {}) {
    this.limits = options.limits ?? DEFAULT_LIMITS;
    this.signal = options.signal;
    this.rng = options.rng ?? new Rng();
  }

  /** Run a nested step list (flow ops). `suffix` extends the error path. */
  runNested(steps: readonly Step[], dish: Dish, ...suffix: PathItem[]): Promise<Dish> {
    if (this.nested === null) {
      throw new UniChefError('E_INTERNAL', 'Nested steps need a runner; please report this.');
    }
    return this.nested(steps, dish, [...this.path, ...suffix]);
  }

  warn = (code: WarningCode, detail: string): void => {
    this.warnings.push({ code, message: detail, path: this.path });
  };

  get cancelled(): boolean {
    return this.signal?.aborted ?? false;
  }

  /** Throw `E_CANCELLED` if the run was cancelled. Call at least every 64 KiB. */
  check = (): void => {
    if (this.cancelled) {
      throw new UniChefError('E_CANCELLED', 'The run was cancelled.');
    }
  };
}

export interface Example {
  readonly input: string;
  readonly args: Readonly<Record<string, JsonValue>>;
  readonly output: string;
}

/** An operation definition. `run` receives the input already coerced. */
export interface Operation<I extends DishType = DishType, O extends DishType = DishType> {
  readonly id: string;
  readonly name: string;
  readonly category: Category;
  readonly description: string;
  readonly inputType: I;
  readonly outputType: O;
  readonly args: readonly ArgSpec[];
  readonly parity: ParityClass;
  readonly examples: readonly Example[];
  run(input: DishValues[I], args: Args, ctx: OpContext): unknown;
}

/** Define an operation with inferred input type for `run`. */
export function defineOp<I extends DishType, O extends DishType>(def: {
  id: string;
  name: string;
  category: Category;
  description: string;
  inputType: I;
  outputType: O;
  args?: readonly ArgSpec[];
  parity?: ParityClass;
  examples?: readonly Example[];
  run: (
    input: DishValues[I],
    args: Args,
    ctx: OpContext,
  ) => DishValues[O] | boolean | Promise<DishValues[O] | boolean>;
}): Operation {
  return {
    args: [],
    parity: 'exact',
    examples: [],
    ...def,
  } as unknown as Operation;
}

export function argSpec(op: Operation, name: string): ArgSpec | undefined {
  return op.args.find((a) => a.name === name);
}
