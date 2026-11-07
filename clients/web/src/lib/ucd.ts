// SPDX-License-Identifier: GPL-3.0-or-later
/** The character pages' connection to `ucd.worker.ts`: one shared worker, promise per request. */

import { createContext, useContext } from 'react';

import type { WorkerError } from '../worker/protocol.js';
import type { FromUcd, ToUcd, UcdRequest, UcdResult } from '../worker/ucd-protocol.js';

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

let shared: UcdClient | null = null;

/** The app's worker, started on the first character lookup. */
function workerService(): UcdService {
  shared ??= new UcdClient(
    new Worker(new URL('../worker/ucd.worker.ts', import.meta.url), { type: 'module' }),
  );
  return shared;
}

const lazy: UcdService = { call: (request) => workerService().call(request) };

export const UcdContext = createContext<UcdService>(lazy);

export const useUcd = (): UcdService => useContext(UcdContext);

/** `U+0041` form, at least four hex digits. */
export const cpLabel = (cp: number): string =>
  `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

export const charHref = (cp: number): string => `#/char/${cpLabel(cp)}`;
