// SPDX-License-Identifier: GPL-3.0-or-later
/** The operation registry. Each op module exports an array; this file joins them. */

import { UniChefError } from '../errors.js';
import { pyRepr, type Operation } from './types.js';
import { CRYPTO_OPS } from './crypto.js';
import { CODEC_OPS } from './codecs.js';
import { RADIX_OPS } from './radix.js';
import { TEXT_TOOL_OPS } from './text-tools.js';
import { COMPRESSION_OPS } from './compression.js';
import { DATA_OPS } from './data.js';
import { ENCODING_OPS } from './encoding.js';
import { FLOW_OPS } from './flow.js';
import { HASHING_OPS } from './hashing.js';
import { HTML_OPS } from './html.js';
import { IDNA_OPS } from './idna.js';
import { JWT_OPS } from './jwt.js';
import { SECURITY_OPS } from './security.js';
import { TEXT_OPS } from './text.js';
import { UNICODE_OPS } from './unicode.js';
import { FLOW_REGEX_OPS } from './flow-regex.js';

const MODULES: readonly (readonly Operation[])[] = [
  FLOW_OPS,
  FLOW_REGEX_OPS,
  TEXT_OPS,
  ENCODING_OPS,
  CODEC_OPS,
  RADIX_OPS,
  TEXT_TOOL_OPS,
  HTML_OPS,
  HASHING_OPS,
  CRYPTO_OPS,
  JWT_OPS,
  UNICODE_OPS,
  SECURITY_OPS,
  DATA_OPS,
  COMPRESSION_OPS,
  IDNA_OPS,
];

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
