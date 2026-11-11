// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The workbench state in the URL fragment (FR-008, PRD §6.4):
 * `#/?r=<base64url(deflate-raw(recipe JSON))>&i=<base64url(deflate-raw(input))>&f=<format>`.
 * Nothing leaves the browser.
 */

import { INPUT_FORMATS, type InputFormat } from './format.js';

/** Past this fragment length the input is left out and the UI warns; the recipe is kept. */
export const MAX_FRAGMENT = 32 * 1024;
/** Inflated size cap, so a crafted link cannot exhaust memory. */
const MAX_INFLATED = 16 * 1024 * 1024;

export class ShareError extends Error {}

async function pipe(
  data: Uint8Array,
  transform: ReadableWritablePair<Uint8Array, BufferSource>,
  cap = Infinity,
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // A failed write also errors the readable side, where the reader below sees it.
  writer
    .write(data as Uint8Array<ArrayBuffer>)
    .then(() => writer.close())
    .catch(() => undefined);
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > cap) {
      await reader.cancel();
      throw new ShareError('The link is too large to open.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new ShareError('The link is damaged.');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const deflate = (data: Uint8Array) => pipe(data, new CompressionStream('deflate-raw'));

async function inflate(text: string): Promise<Uint8Array> {
  try {
    return await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'), MAX_INFLATED);
  } catch (exc) {
    if (exc instanceof ShareError) throw exc;
    throw new ShareError('The link is damaged.');
  }
}

export interface SharedState {
  /** The recipe document, still unvalidated. */
  readonly recipe?: unknown;
  readonly input?: string;
  readonly format?: InputFormat;
}

/** Encode the state as a fragment, leaving out the input if the result is too long. */
export async function encodeState(
  recipe: unknown,
  input: string,
  format: InputFormat,
): Promise<{ fragment: string; inputOmitted: boolean }> {
  const encoder = new TextEncoder();
  const params = new URLSearchParams({
    r: toBase64Url(await deflate(encoder.encode(JSON.stringify(recipe)))),
  });
  const base = `#/?${params.toString()}`;
  if (input === '') return { fragment: base, inputOmitted: false };
  params.set('i', toBase64Url(await deflate(encoder.encode(input))));
  if (format !== 'text') params.set('f', format);
  const full = `#/?${params.toString()}`;
  return full.length > MAX_FRAGMENT
    ? { fragment: base, inputOmitted: true }
    : { fragment: full, inputOmitted: false };
}

/** The state in `hash`, or null when it carries none. Throws `ShareError` for a bad link. */
export async function decodeState(hash: string): Promise<SharedState | null> {
  const query = hash.replace(/^#/, '').split('?')[1];
  if (query === undefined) return null;
  const params = new URLSearchParams(query);
  const r = params.get('r');
  const i = params.get('i');
  const f = params.get('f') ?? 'text';
  if (r === null && i === null) return null;
  if (!INPUT_FORMATS.includes(f as InputFormat))
    throw new ShareError(`Unknown input format “${f.slice(0, 16)}”.`);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let recipe: unknown;
  let input: string | undefined;
  try {
    if (r !== null) recipe = JSON.parse(decoder.decode(await inflate(r)));
    if (i !== null) input = decoder.decode(await inflate(i));
  } catch (exc) {
    if (exc instanceof ShareError) throw exc;
    throw new ShareError('The link is damaged.');
  }
  return {
    ...(r === null ? {} : { recipe }),
    ...(input === undefined ? {} : { input, format: f as InputFormat }),
  };
}
