// SPDX-License-Identifier: GPL-3.0-or-later
/** UCD lookups for tests: the data files from disk, and a service that skips the worker. */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { setDataSource } from '@unichef/core';

import { UcdError, type UcdService } from '../src/lib/ucd.js';
import { toWorkerError } from '../src/worker/protocol.js';
import { handle } from '../src/worker/ucd.js';

// Vitest runs from clients/web, and serves this module from a `/@fs/` URL.
const dir = resolve('../../packages/npm-core/data');

export function useDiskData(): void {
  setDataSource(async (file) => new Uint8Array(gunzipSync(await readFile(resolve(dir, file)))));
}

/** Answers lookups in-process, with the worker's error mapping. */
export const inProcessUcd: UcdService = {
  call: (request) =>
    handle(request).catch((exc: unknown) => {
      throw new UcdError(toWorkerError(exc));
    }),
};
