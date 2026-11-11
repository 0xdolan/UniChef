// SPDX-License-Identifier: GPL-3.0-or-later
/** Error and warning codes shared with the Python core (PRD §3.7, spec/errors.json). */

export type ErrorCode =
  | 'E_USAGE'
  | 'E_INPUT_IO'
  | 'E_INPUT_TYPE'
  | 'E_ARG_INVALID'
  | 'E_DECODE'
  | 'E_CRYPTO'
  | 'E_REGEX_UNSUPPORTED'
  | 'E_REGEX_TIMEOUT'
  | 'E_LIMIT'
  | 'E_RECIPE_SCHEMA'
  | 'E_OP_UNKNOWN'
  | 'E_CANCELLED'
  | 'E_SCAN_FINDINGS'
  | 'E_INTERNAL';

export type WarningCode = 'W_DUPLICATE_KEY' | 'W_JUMP_LIMIT' | 'W_INSECURE';

/** An error path: step indexes, with `"branch", n` pairs for nested recipes (PRD §3.5). */
export type PathItem = number | string;

export const EXIT_CODES: Readonly<Record<ErrorCode, number>> = {
  E_USAGE: 2,
  E_INPUT_IO: 3,
  E_INPUT_TYPE: 1,
  E_ARG_INVALID: 1,
  E_DECODE: 1,
  E_CRYPTO: 1,
  E_REGEX_UNSUPPORTED: 1,
  E_REGEX_TIMEOUT: 5,
  E_LIMIT: 1,
  E_RECIPE_SCHEMA: 4,
  E_OP_UNKNOWN: 4,
  E_CANCELLED: 130,
  E_SCAN_FINDINGS: 6,
  E_INTERNAL: 70,
};

export const WARNING_CODES: readonly WarningCode[] = [
  'W_DUPLICATE_KEY',
  'W_JUMP_LIMIT',
  'W_INSECURE',
];

const MAX_QUOTED_BYTES = 64;

/** Quote user input for a message, keeping at most 64 UTF-8 bytes of it (PRD §3.7). */
export function quoteInput(text: string): string {
  let used = 0;
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const size = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (used + size > MAX_QUOTED_BYTES) {
      return `'${out}'…`;
    }
    out += ch;
    used += size;
  }
  return `'${out}'`;
}

/** The only error an operation throws. The CLI maps `code` to an exit code. */
export class UniChefError extends Error {
  override readonly name = 'UniChefError';
  readonly code: ErrorCode;
  path: PathItem[];
  readonly detail: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    path: readonly PathItem[] = [],
    detail?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.code = code;
    this.path = [...path];
    this.detail = detail;
  }

  get exitCode(): number {
    return EXIT_CODES[this.code];
  }

  /** Prepend `prefix` to the error path, as an error leaves a nested recipe. */
  withPrefix(...prefix: PathItem[]): this {
    this.path = [...prefix, ...this.path];
    return this;
  }

  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = { code: this.code, message: this.message };
    if (this.path.length > 0) {
      out['path'] = this.path.join('/');
    }
    if (this.detail !== undefined) {
      out['detail'] = this.detail;
    }
    return out;
  }
}

/** A non-fatal finding raised during a bake (spec/errors.json `warnings`). */
export interface RunWarning {
  readonly code: WarningCode;
  readonly message: string;
  readonly path: readonly PathItem[];
}

export function isUniChefError(value: unknown): value is UniChefError {
  return value instanceof UniChefError;
}
