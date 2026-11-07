// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Main-thread side of the bake worker, with the watchdog (PRD §6.4): if no `done` or
 * `error` arrives within `bakeMs`, or within 500 ms of a `cancel`, the worker is
 * terminated and recreated. Ops can loop synchronously, so termination is the only
 * reliable way to stop them.
 */

import type { Dish } from '@unichef/core';

import {
  transferables,
  type BakeRequestOptions,
  type FromWorker,
  type RecipeDoc,
  type ToWorker,
  type WorkerError,
} from './protocol.js';

export const CANCEL_GRACE_MS = 500;

/** The part of `Worker` the client uses, so tests can supply a fake. */
export interface WorkerLike {
  postMessage(message: ToWorker, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<FromWorker>) => void): void;
  terminate(): void;
}

export interface BakeEvents {
  /** Every message for the current bake, plus `ready`. Stale bakes are filtered out. */
  onMessage(message: FromWorker): void;
  /**
   * The watchdog terminated and recreated the worker, and bake `id` was lost with it.
   * `retry` is true when that bake was healthy but queued behind a stuck one: the app
   * should start it again.
   */
  onRestart?(id: number, error: WorkerError, retry: boolean): void;
}

export class BakeClient {
  private worker: WorkerLike;
  private nextId = 1;
  /** The bake whose result the app is waiting for. */
  private currentId: number | null = null;
  /** A bake that was told to cancel and has not answered yet. */
  private cancelling: number | null = null;
  private bakeTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly create: () => WorkerLike,
    private readonly events: BakeEvents,
  ) {
    this.worker = this.spawn();
  }

  /** Start a bake, cancelling the one in flight. Returns the bake id. */
  bake(recipe: RecipeDoc, input: Dish, options: BakeRequestOptions, bakeMs: number): number {
    if (this.currentId !== null) this.requestCancel(this.currentId);
    const id = this.nextId++;
    this.currentId = id;
    this.send({ kind: 'bake', id, recipe, input, options }, transferables(input));
    clear(this.bakeTimer);
    this.bakeTimer = setTimeout(() => {
      this.bakeTimer = null;
      if (this.currentId !== id) return;
      this.restart();
      const message = `The bake took longer than ${bakeMs} ms and was stopped.`;
      this.events.onRestart?.(id, { code: 'E_LIMIT', message, path: [] }, false);
    }, bakeMs);
    return id;
  }

  /** Cancel the bake in flight, if any. Its `E_CANCELLED` error still arrives. */
  cancel(): void {
    if (this.currentId !== null) this.requestCancel(this.currentId);
  }

  /** Point the worker at data files served from `baseUrl` (extensions). */
  loadUcd(baseUrl: string): void {
    this.send({ kind: 'load-ucd', baseUrl });
  }

  dispose(): void {
    clear(this.bakeTimer);
    clear(this.cancelTimer);
    this.worker.terminate();
  }

  private spawn(): WorkerLike {
    const worker = this.create();
    worker.addEventListener('message', (event) => {
      this.receive(worker, event.data);
    });
    return worker;
  }

  private send(message: ToWorker, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }

  private requestCancel(id: number): void {
    this.send({ kind: 'cancel', id });
    this.cancelling = id;
    clear(this.cancelTimer);
    this.cancelTimer = setTimeout(() => {
      this.cancelTimer = null;
      if (this.cancelling !== id) return;
      const lost = this.currentId ?? id;
      this.restart();
      const message = 'The bake did not stop when cancelled, so the worker was restarted.';
      this.events.onRestart?.(lost, { code: 'E_CANCELLED', message, path: [] }, lost !== id);
    }, CANCEL_GRACE_MS);
  }

  private receive(from: WorkerLike, message: FromWorker): void {
    if (from !== this.worker) return; // a terminated worker's last words
    if (message.kind === 'ready') {
      this.events.onMessage(message);
      return;
    }
    if (message.kind !== 'step' && message.id === this.cancelling) {
      this.cancelling = null;
      clear(this.cancelTimer);
    }
    if (message.id !== this.currentId) return;
    if (message.kind !== 'step') {
      this.currentId = null;
      clear(this.bakeTimer);
    }
    this.events.onMessage(message);
  }

  private restart(): void {
    clear(this.bakeTimer);
    clear(this.cancelTimer);
    this.currentId = null;
    this.cancelling = null;
    this.worker.terminate();
    this.worker = this.spawn();
  }
}

function clear(timer: ReturnType<typeof setTimeout> | null): void {
  if (timer !== null) clearTimeout(timer);
}
