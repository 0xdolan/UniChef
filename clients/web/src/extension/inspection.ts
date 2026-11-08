// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The Inspect tab's bakes (PRD §7.1): `detect-invisible`, then `analyse-characters`, one
 * after the other in the page's bake worker. Nothing runs in the background script.
 */

import { DEFAULT_LIMITS, makeDish, type Dish } from '@unichef/core';
import { useEffect, useRef, useState } from 'react';

import { BAKE_MS, createBakeWorker } from '../lib/baker.js';
import { BakeClient, type WorkerLike } from '../worker/client.js';
import type { FromWorker, WorkerError } from '../worker/protocol.js';

export type Table = Extract<Dish, { type: 'table' }>['value'];

export const INSPECT_MS = 250;
export const STEPS = ['detect-invisible', 'analyse-characters'] as const;

export type Inspection =
  | { readonly state: 'idle' }
  | { readonly state: 'running' }
  | { readonly state: 'done'; readonly invisible: Table; readonly chars: Table }
  | { readonly state: 'error'; readonly error: WorkerError };

const recipe = (op: string) => ({ version: 1, steps: [{ op, args: {} }] });

const asTable = (dish: Dish): Table | null => (dish.type === 'table' ? dish.value : null);

export function useInspection(
  text: string,
  create: () => WorkerLike = createBakeWorker,
): Inspection {
  const [result, setResult] = useState<Inspection>({ state: 'idle' });
  const client = useRef<BakeClient | null>(null);
  const startRef = useRef<((step: number, input: string, invisible?: Table) => void) | null>(null);
  // Bake results arrive through one listener; this says which step a result belongs to.
  const pending = useRef<{ id: number; step: number; text: string; invisible?: Table } | null>(
    null,
  );

  useEffect(() => {
    const start = (step: number, input: string, invisible?: Table): void => {
      const id = c.bake(
        recipe(STEPS[step] ?? ''),
        makeDish('string', input),
        { snapshots: false, limits: DEFAULT_LIMITS },
        BAKE_MS,
      );
      pending.current = { id, step, text: input, ...(invisible ? { invisible } : {}) };
    };
    const onMessage = (message: FromWorker): void => {
      const job = pending.current;
      if (job === null || message.kind === 'ready' || message.kind === 'step') return;
      if (message.id !== job.id) return;
      if (message.kind === 'error') {
        pending.current = null;
        setResult({ state: 'error', error: message.error });
        return;
      }
      const table = asTable(message.output);
      if (table === null) {
        pending.current = null;
        setResult({
          state: 'error',
          error: { code: 'E_INTERNAL', message: 'Expected a table.', path: [] },
        });
      } else if (job.step === 0) {
        start(1, job.text, table);
      } else {
        pending.current = null;
        setResult({
          state: 'done',
          invisible: job.invisible ?? { columns: [], rows: [] },
          chars: table,
        });
      }
    };
    const c = new BakeClient(create, {
      onMessage,
      onRestart: (_id, error) => {
        pending.current = null;
        setResult({ state: 'error', error });
      },
    });
    client.current = c;
    startRef.current = start;
    return () => {
      c.dispose();
      client.current = null;
      startRef.current = null;
    };
  }, [create]);

  useEffect(() => {
    if (text === '') {
      client.current?.cancel();
      pending.current = null;
      setResult({ state: 'idle' });
      return;
    }
    const timer = setTimeout(() => {
      if (startRef.current === null) return;
      setResult({ state: 'running' });
      startRef.current(0, text);
    }, INSPECT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  return result;
}
