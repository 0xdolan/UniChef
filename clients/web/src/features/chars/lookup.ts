// SPDX-License-Identifier: GPL-3.0-or-later
/** Runs one UCD lookup for a page and tracks its state. */

import { useEffect, useState } from 'react';

import { UcdError, useUcd } from '../../lib/ucd.js';
import type { UcdRequest, UcdResult } from '../../worker/ucd-protocol.js';

export type Lookup<T> =
  | { readonly state: 'loading' }
  | { readonly state: 'done'; readonly value: T; readonly ms: number }
  | { readonly state: 'error'; readonly error: UcdError };

/** Looks up `request`, again whenever it changes; `null` waits. */
export function useLookup<R extends UcdRequest>(request: R | null): Lookup<UcdResult<R>> | null {
  const ucd = useUcd();
  const key = request === null ? null : JSON.stringify(request);
  const [result, setResult] = useState<{
    key: string;
    lookup: Lookup<UcdResult<R>>;
  } | null>(null);

  useEffect(() => {
    if (key === null) return;
    let live = true;
    const started = performance.now();
    ucd.call(JSON.parse(key) as R).then(
      (value) => {
        if (live)
          setResult({ key, lookup: { state: 'done', value, ms: performance.now() - started } });
      },
      (exc: unknown) => {
        const error =
          exc instanceof UcdError
            ? exc
            : new UcdError({ code: 'E_INTERNAL', message: String(exc), path: [] });
        if (live) setResult({ key, lookup: { state: 'error', error } });
      },
    );
    return () => {
      live = false;
    };
  }, [ucd, key]);

  if (key === null) return null;
  return result?.key === key ? result.lookup : { state: 'loading' };
}

/** Block names as in UAX44-LM3: case, spaces, underscores, hyphens and a leading "is" ignored. */
export const looseName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace(/^is/, '');

/** `Basic Latin` ↔ `Basic_Latin`, the form block names take in a route. */
export const blockSlug = (name: string): string => name.replace(/ /g, '_');

export const hexRange = (start: number, end: number): string =>
  `${start.toString(16).toUpperCase().padStart(4, '0')}–${end.toString(16).toUpperCase().padStart(4, '0')}`;
