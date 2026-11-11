// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Messages between the app and `bake.worker.ts` (PRD §6.4). Dishes cross as structured
 * clones (Maps, bigints and byte arrays survive), with byte buffers transferred.
 */

import {
  isUniChefError,
  type Dish,
  type DishType,
  type Limits,
  type PathItem,
  type RunWarning,
} from '@unichef/core';

/** A recipe document as JSON, validated by the worker with `parseRecipe`. */
export type RecipeDoc = Readonly<Record<string, unknown>>;

/** A `UniChefError` flattened for `postMessage` (class instances lose their prototype). */
export interface WorkerError {
  readonly code: string;
  readonly message: string;
  readonly path: readonly PathItem[];
}

export interface BakeRequestOptions {
  readonly snapshots: boolean;
  readonly limits: Limits;
}

export type ToWorker =
  | {
      readonly kind: 'bake';
      readonly id: number;
      readonly recipe: RecipeDoc;
      readonly input: Dish;
      readonly options: BakeRequestOptions;
    }
  | { readonly kind: 'cancel'; readonly id: number }
  | { readonly kind: 'load-ucd'; readonly baseUrl: string };

export type FromWorker =
  | {
      readonly kind: 'step';
      readonly id: number;
      readonly path: readonly PathItem[];
      readonly type: DishType;
      readonly byteLength: number;
      readonly preview: Dish;
      readonly ms: number;
    }
  | {
      readonly kind: 'done';
      readonly id: number;
      readonly output: Dish;
      readonly warnings: readonly RunWarning[];
      readonly ms: number;
    }
  | { readonly kind: 'error'; readonly id: number; readonly error: WorkerError }
  | { readonly kind: 'ready'; readonly ucdVersion: string };

/** Byte buffers to transfer with a dish, so large inputs are moved rather than copied. */
export function transferables(dish: Dish): Transferable[] {
  return dish.type === 'bytes' ? [dish.value.buffer as ArrayBuffer] : [];
}

/** Any thrown value as a `WorkerError`; only `UniChefError` keeps its code and path. */
export function toWorkerError(exc: unknown): WorkerError {
  if (isUniChefError(exc)) {
    return { code: exc.code, message: exc.message, path: exc.path };
  }
  const message = exc instanceof Error ? exc.message : String(exc);
  return { code: 'E_INTERNAL', message, path: [] };
}
