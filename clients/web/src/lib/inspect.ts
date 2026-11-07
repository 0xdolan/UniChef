// SPDX-License-Identifier: GPL-3.0-or-later
/** Renderings for the step inspector (FR-002): text, hex dump and table. */

import type { Dish } from '@unichef/core';

import type { StepModel } from '../state/recipe.js';
import { isSteps } from '../state/recipe.js';

export type InspectView = 'text' | 'hex' | 'table';

/** Rows shown in the table view; the preview may hold more. */
export const TABLE_ROWS = 200;

const utf8 = new TextEncoder();

/** Views that make sense for a dish type, the default first. */
export function viewsFor(type: Dish['type']): readonly InspectView[] {
  switch (type) {
    case 'bytes':
    case 'string':
      return ['text', 'hex'];
    case 'table':
      return ['table', 'text'];
    default:
      return ['text'];
  }
}

/**
 * `bytes` without a UTF-8 sequence cut off at the end, as a 4 KiB preview can be, so the
 * text view does not fall back to hex because of the cut.
 */
export function utf8Prefix(bytes: Uint8Array): Uint8Array {
  const n = bytes.length;
  for (let back = 1; back <= Math.min(3, n); back++) {
    const b = bytes[n - back] ?? 0;
    if ((b & 0xc0) === 0x80) continue; // continuation byte: keep looking for the lead
    const need = b >= 0xf8 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return need > back ? bytes.subarray(0, n - back) : bytes;
  }
  return bytes;
}

/** The dish's bytes for the hex view: bytes as they are, strings as UTF-8. */
export function bytesOf(dish: Dish): Uint8Array | null {
  if (dish.type === 'bytes') return dish.value;
  if (dish.type === 'string') return utf8.encode(dish.value);
  return null;
}

const printable = (b: number): string => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.');

/** Classic hex dump: offset, 16 bytes per line, ASCII column. */
export function hexDump(bytes: Uint8Array): string {
  const lines: string[] = [];
  for (let at = 0; at < bytes.length; at += 16) {
    const row = bytes.subarray(at, at + 16);
    const cells = Array.from(row, (b) => b.toString(16).padStart(2, '0'));
    const left = cells.slice(0, 8).join(' ');
    const right = cells.slice(8).join(' ');
    lines.push(
      `${at.toString(16).padStart(8, '0')}  ${left.padEnd(23)}  ${right.padEnd(23)}  |${Array.from(row, printable).join('')}|`,
    );
  }
  return lines.join('\n');
}

/** The model step at a numeric path, following nested step lists. */
export function stepAt(steps: readonly StepModel[], path: readonly number[]): StepModel | null {
  let list = steps;
  let step: StepModel | null = null;
  for (const [depth, i] of path.entries()) {
    step = list[i] ?? null;
    if (step === null) return null;
    if (depth < path.length - 1) {
      const nested = Object.values(step.args).find(isSteps);
      if (nested === undefined) return null;
      list = nested;
    }
  }
  return step;
}

/**
 * Snapshot key of the step whose output fed `path`: the nearest earlier sibling that ran,
 * else the same for the parent. Null means the recipe input.
 */
export function inputKey(path: readonly number[], has: (key: string) => boolean): string | null {
  for (let depth = path.length; depth > 0; depth--) {
    const parent = path.slice(0, depth - 1);
    for (let j = (path[depth - 1] ?? 0) - 1; j >= 0; j--) {
      const key = [...parent, j].join('/');
      if (has(key)) return key;
    }
  }
  return null;
}
