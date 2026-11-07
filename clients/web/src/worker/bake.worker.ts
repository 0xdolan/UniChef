// SPDX-License-Identifier: GPL-3.0-or-later
/** Runs every bake off the main thread (PRD §6.4). One bake at a time; a new one cancels the old. */

/// <reference lib="webworker" />

import { bake, dishSize, isUniChefError, parseRecipe, setDataSource } from '@unichef/core';
import { UCD_VERSION } from '@unichef/core/unicode/data.js';

import { dataSource } from '../lib/data.js';
import { preview } from './preview.js';
import { transferables, type FromWorker, type ToWorker, type WorkerError } from './protocol.js';

declare const self: DedicatedWorkerGlobalScope;

let current: { id: number; controller: AbortController } | null = null;

function post(message: FromWorker, transfer: Transferable[] = []): void {
  self.postMessage(message, transfer);
}

function toWorkerError(exc: unknown): WorkerError {
  if (isUniChefError(exc)) {
    return { code: exc.code, message: exc.message, path: exc.path };
  }
  const message = exc instanceof Error ? exc.message : String(exc);
  return { code: 'E_INTERNAL', message, path: [] };
}

async function runBake(message: Extract<ToWorker, { kind: 'bake' }>): Promise<void> {
  current?.controller.abort();
  const controller = new AbortController();
  current = { id: message.id, controller };
  const { id, options } = message;
  const start = performance.now();
  try {
    const recipe = parseRecipe(message.recipe);
    const result = await bake(recipe, message.input, {
      limits: options.limits,
      signal: controller.signal,
      ...(options.snapshots
        ? {
            onStep: ({ path, dish, ms }) => {
              const shown = preview(dish);
              post(
                {
                  kind: 'step',
                  id,
                  path,
                  type: dish.type,
                  byteLength: dishSize(dish),
                  preview: shown,
                  ms,
                },
                transferables(shown),
              );
            },
          }
        : {}),
    });
    if (controller.signal.aborted) throw new Error('cancelled');
    const output = result.dish;
    post(
      { kind: 'done', id, output, warnings: result.warnings, ms: performance.now() - start },
      transferables(output),
    );
  } catch (exc) {
    // A cancelled bake still answers, so the client's watchdog knows the worker is alive.
    const error: WorkerError = controller.signal.aborted
      ? { code: 'E_CANCELLED', message: 'The bake was cancelled.', path: [] }
      : toWorkerError(exc);
    post({ kind: 'error', id, error });
  } finally {
    finish(id);
  }
}

/** Forget bake `id` unless a newer one replaced it. Out of line: `current` changes across awaits. */
function finish(id: number): void {
  if (current !== null && current.id === id) current = null;
}

self.addEventListener('message', (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  switch (message.kind) {
    case 'bake':
      void runBake(message);
      break;
    case 'cancel':
      if (current?.id === message.id) current.controller.abort();
      break;
    case 'load-ucd':
      setDataSource(dataSource(message.baseUrl));
      post({ kind: 'ready', ucdVersion: UCD_VERSION });
      break;
  }
});

setDataSource(dataSource());
