// SPDX-License-Identifier: GPL-3.0-or-later
/** Runs character lookups off the main thread, so the UCD never loads there. */

/// <reference lib="webworker" />

import { setDataSource } from '@unichef/core';

import { dataSource } from '../lib/data.js';
import { toWorkerError } from './protocol.js';
import { handle } from './ucd.js';
import type { FromUcd, ToUcd } from './ucd-protocol.js';

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', (event: MessageEvent<ToUcd>) => {
  const { id, request } = event.data;
  handle(request).then(
    (result) => {
      self.postMessage({ id, ok: true, result } satisfies FromUcd);
    },
    (exc: unknown) => {
      self.postMessage({ id, ok: false, error: toWorkerError(exc) } satisfies FromUcd);
    },
  );
});

setDataSource(dataSource());
