// SPDX-License-Identifier: GPL-3.0-or-later
/** Connects the bake worker to the store: auto-bake, results and watchdog restarts. */

import { DEFAULT_LIMITS } from '@unichef/core';
import { useCallback, useEffect, useRef } from 'react';

import { recipeDoc } from '../state/recipe.js';
import { useApp } from '../state/store.js';
import { BakeClient, type WorkerLike } from '../worker/client.js';
import type { FromWorker } from '../worker/protocol.js';
import { InputError, inputDish } from './format.js';

export const AUTO_BAKE_MS = 300;
/** Watchdog budget for one bake (`limits.bakeMs`, PRD §6.4). */
export const BAKE_MS = 10_000;

const createWorker = (): WorkerLike =>
  new Worker(new URL('../worker/bake.worker.ts', import.meta.url), { type: 'module' });

/** Starts a bake of the current recipe and input. */
function startBake(client: BakeClient): void {
  const { steps, input, inputFormat, bakeStarted, bakeFailed } = useApp.getState();
  let dish;
  try {
    dish = inputDish(input, inputFormat);
  } catch (exc) {
    if (!(exc instanceof InputError)) throw exc;
    client.cancel();
    bakeFailed({ code: 'E_INPUT', message: exc.message, path: [] });
    return;
  }
  bakeStarted();
  client.bake(recipeDoc(steps), dish, { snapshots: true, limits: DEFAULT_LIMITS }, BAKE_MS);
}

function onMessage(message: FromWorker): void {
  const { bakeDone, bakeFailed, stepDone } = useApp.getState();
  switch (message.kind) {
    case 'step':
      stepDone(message.path, {
        type: message.type,
        byteLength: message.byteLength,
        preview: message.preview,
        ms: message.ms,
      });
      break;
    case 'done':
      bakeDone(message.output, message.warnings, message.ms);
      break;
    case 'error':
      bakeFailed(message.error);
      break;
    case 'ready':
      break;
  }
}

/** Owns the worker for the workbench's lifetime. Returns a function that bakes now. */
export function useBaker(create: () => WorkerLike = createWorker): () => void {
  const client = useRef<BakeClient | null>(null);

  useEffect(() => {
    const c = new BakeClient(create, {
      onMessage,
      onRestart: (_id, error, retry) => {
        if (retry) startBake(c);
        else useApp.getState().bakeFailed(error);
      },
    });
    client.current = c;
    return () => {
      c.dispose();
      client.current = null;
    };
  }, [create]);

  const bakeNow = useCallback(() => {
    if (client.current !== null) startBake(client.current);
  }, []);

  const steps = useApp((s) => s.steps);
  const input = useApp((s) => s.input);
  const inputFormat = useApp((s) => s.inputFormat);
  const autoBake = useApp((s) => s.autoBake);
  useEffect(() => {
    if (!autoBake) return;
    const timer = setTimeout(bakeNow, AUTO_BAKE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [steps, input, inputFormat, autoBake, bakeNow]);

  return bakeNow;
}
