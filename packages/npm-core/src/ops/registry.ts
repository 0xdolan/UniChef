// SPDX-License-Identifier: GPL-3.0-or-later
/** The operation registry. Each op module exports an array; this file joins them. */

import { UniChefError } from '../errors.js';
import { pyRepr, type Operation } from './types.js';
import { FLOW_OPS } from './flow.js';

const MODULES: readonly (readonly Operation[])[] = [FLOW_OPS];

const REGISTRY = new Map<string, Operation>();
for (const ops of MODULES) {
  for (const op of ops) {
    if (REGISTRY.has(op.id)) {
      throw new Error(`duplicate operation id ${op.id}`);
    }
    REGISTRY.set(op.id, op);
  }
}

export function getOperation(id: string): Operation {
  const op = REGISTRY.get(id);
  if (op === undefined) {
    throw new UniChefError('E_OP_UNKNOWN', `Unknown operation ${pyRepr(id.slice(0, 64))}.`);
  }
  return op;
}

export function hasOperation(id: string): boolean {
  return REGISTRY.has(id);
}

/** Every operation, sorted by id. */
export function allOperations(): Operation[] {
  return [...REGISTRY.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
