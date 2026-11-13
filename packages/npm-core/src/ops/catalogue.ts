// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Operation metadata without the implementations, for code that lists, describes or
 * validates operations but never runs them (the web app's main thread, recipe
 * validation). The data is a copy of spec/ops.json, written by `make ops`; a test checks
 * it against the registry.
 */

import { UniChefError } from '../errors.js';
import { pyRepr, type ArgSpec, type Operation } from './types.js';
import INDEX from './catalogue.json' with { type: 'json' };

/** An operation's metadata: everything in {@link Operation} except `run`. */
export type OperationInfo = Omit<Operation, 'run'>;

interface IndexArg {
  name: string;
  kind: ArgSpec['kind'];
  default?: unknown;
  options?: string[];
  minimum?: number;
  maximum?: number;
  encodings?: string[];
  secret?: boolean;
  flags?: string;
  multiline?: boolean;
}

interface IndexEntry {
  id: string;
  name: string;
  category: Operation['category'];
  description: string;
  input: Operation['inputType'];
  output: Operation['outputType'];
  parity: Operation['parity'];
  args: IndexArg[];
  examples: Operation['examples'];
}

/** The inverse of the argument shape scripts/spec/ops.py writes. */
function toArgSpec(a: IndexArg): ArgSpec {
  const { minimum, maximum, ...rest } = a;
  return {
    ...rest,
    ...(minimum === undefined ? {} : { min: minimum }),
    ...(maximum === undefined ? {} : { max: maximum }),
  } as unknown as ArgSpec;
}

const CATALOGUE: ReadonlyMap<string, OperationInfo> = new Map(
  (INDEX as unknown as { ops: IndexEntry[] }).ops.map((e) => [
    e.id,
    {
      id: e.id,
      name: e.name,
      category: e.category,
      description: e.description,
      inputType: e.input,
      outputType: e.output,
      args: e.args.map(toArgSpec),
      parity: e.parity,
      examples: e.examples,
    },
  ]),
);

/** The metadata of operation `id`; throws `E_OP_UNKNOWN` like `getOperation`. */
export function getOperationInfo(id: string): OperationInfo {
  const op = CATALOGUE.get(id);
  if (op === undefined) {
    throw new UniChefError('E_OP_UNKNOWN', `Unknown operation ${pyRepr(id.slice(0, 64))}.`);
  }
  return op;
}

/** Every operation's metadata, sorted by id. */
export function allOperationInfo(): OperationInfo[] {
  return [...CATALOGUE.values()];
}

/** Whether `id` names an operation. */
export function hasOperationInfo(id: string): boolean {
  return CATALOGUE.has(id);
}
