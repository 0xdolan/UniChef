// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lazy loading of the compiled data files in `packages/npm-core/data/` (PRD §4.2).
 *
 * Each file is gzipped JSON, read once per process. Node reads it from disk; browsers
 * fetch it next to the module. A host that serves the files elsewhere (a bundled web
 * app, an extension) calls `setDataSource` before the first bake.
 */

import { UniChefError } from '../errors.js';

/**
 * Returns the bytes of one data file, e.g. `ucd-core-18.0.0.json.gz`: gzipped, or already
 * decompressed when a server sent it with `Content-Encoding: gzip`.
 */
export type DataSource = (file: string) => Promise<Uint8Array>;

async function defaultSource(file: string): Promise<Uint8Array> {
  const url = new URL(`../../data/${file}`, import.meta.url);
  if (url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    return new Uint8Array(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)} for ${url.href}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

let source: DataSource = defaultSource;
const cache = new Map<string, Promise<unknown>>();

/** Serve data files from somewhere else. Clears the cache. */
export function setDataSource(fn: DataSource): void {
  source = fn;
  cache.clear();
}

async function gunzip(data: Uint8Array): Promise<string> {
  if (data[0] !== 0x1f || data[1] !== 0x8b) {
    return new TextDecoder().decode(data);
  }
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .pipeThrough(new TextDecoderStream());
  let out = '';
  for await (const chunk of stream) {
    out += chunk;
  }
  return out;
}

async function read(file: string): Promise<unknown> {
  try {
    return JSON.parse(await gunzip(await source(file))) as unknown;
  } catch (exc) {
    cache.delete(file);
    const why = exc instanceof Error ? exc.message : String(exc);
    throw new UniChefError('E_INTERNAL', `Cannot load data file ${file} (${why}).`);
  }
}

/** Parse one gzipped JSON data file, once. Plain `JSON.parse` objects are returned. */
export function loadData(file: string): Promise<unknown> {
  let pending = cache.get(file);
  if (pending === undefined) {
    pending = read(file);
    cache.set(file, pending);
  }
  return pending;
}
