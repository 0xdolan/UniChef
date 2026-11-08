// SPDX-License-Identifier: GPL-3.0-or-later
/** The character pages' connection to `ucd.worker.ts`: one shared worker, promise per request. */

import { createContext, useContext } from 'react';

import type { WorkerError } from '../worker/protocol.js';
import type { FromUcd, RegexRun, ToUcd, UcdRequest, UcdResult } from '../worker/ucd-protocol.js';

export interface UcdService {
  call<R extends UcdRequest>(request: R): Promise<UcdResult<R>>;
}

/** A failed lookup, with the worker's error code (e.g. `E_ARG_INVALID` for a bad query). */
export class UcdError extends Error {
  readonly code: string;

  constructor(error: WorkerError) {
    super(error.message);
    this.name = 'UcdError';
    this.code = error.code;
  }
}

interface Port {
  postMessage(message: ToUcd): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<FromUcd>) => void): void;
}

export class UcdClient implements UcdService {
  private next = 1;
  private readonly pending = new Map<
    number,
    { resolve: (value: never) => void; reject: (error: UcdError) => void }
  >();

  constructor(private readonly port: Port) {
    port.addEventListener('message', ({ data }) => {
      const waiting = this.pending.get(data.id);
      if (waiting === undefined) return;
      this.pending.delete(data.id);
      if (data.ok) waiting.resolve(data.result as never);
      else waiting.reject(new UcdError(data.error));
    });
  }

  call<R extends UcdRequest>(request: R): Promise<UcdResult<R>> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.port.postMessage({ id, request });
    });
  }
}

const createWorker = (): Worker =>
  new Worker(new URL('../worker/ucd.worker.ts', import.meta.url), { type: 'module' });

let shared: UcdClient | null = null;

/** The app's worker, started on the first character lookup. */
function workerService(): UcdService {
  shared ??= new UcdClient(createWorker());
  return shared;
}

/** How long past its timeout a regex run may take before the watchdog stops it. */
export const REGEX_GRACE_MS = 500;

export type RegexRequest = Extract<UcdRequest, { kind: 'regex' }>;

export interface RegexService {
  run(request: RegexRequest): Promise<RegexRun>;
  dispose(): void;
}

interface TerminablePort extends Port {
  terminate(): void;
}

/**
 * Runs regexes in a worker of their own. A JavaScript regex search cannot be interrupted,
 * so the watchdog terminates the worker when a run overruns its timeout (PRD §4.9). A new
 * run replaces the one in flight the same way, so it never queues behind a stuck search.
 */
export class RegexClient implements RegexService {
  private worker: { port: TerminablePort; client: UcdClient } | null = null;
  /** Ends the run in flight with an error. */
  private abort: ((error: UcdError) => void) | null = null;

  constructor(private readonly create: () => TerminablePort = createWorker) {}

  run(request: RegexRequest): Promise<RegexRun> {
    this.abort?.(
      new UcdError({ code: 'E_CANCELLED', message: 'A newer run replaced this one.', path: [] }),
    );
    if (this.worker === null) {
      const port = this.create();
      this.worker = { port, client: new UcdClient(port) };
    }
    const { client } = this.worker;
    return new Promise((resolve, reject) => {
      const finish = (): boolean => {
        if (this.abort !== abort) return false;
        clearTimeout(timer);
        this.abort = null;
        return true;
      };
      const abort = (error: UcdError) => {
        if (!finish()) return;
        this.restart();
        reject(error);
      };
      const timer = setTimeout(() => {
        const message = `The regex ran longer than ${String(request.timeoutMs)} ms and was stopped.`;
        abort(new UcdError({ code: 'E_REGEX_TIMEOUT', message, path: [] }));
      }, request.timeoutMs + REGEX_GRACE_MS);
      this.abort = abort;
      client.call(request).then(
        (result) => {
          if (finish()) resolve(result);
        },
        (error: unknown) => {
          if (finish()) reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  dispose(): void {
    this.abort?.(new UcdError({ code: 'E_CANCELLED', message: 'The page closed.', path: [] }));
    this.restart();
  }

  private restart(): void {
    this.worker?.port.terminate();
    this.worker = null;
  }
}

const lazy: UcdService = { call: (request) => workerService().call(request) };

export const UcdContext = createContext<UcdService>(lazy);

export const useUcd = (): UcdService => useContext(UcdContext);

/** `U+0041` form, at least four hex digits. */
export const cpLabel = (cp: number): string =>
  `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

export const charHref = (cp: number): string => `#/char/${cpLabel(cp)}`;
