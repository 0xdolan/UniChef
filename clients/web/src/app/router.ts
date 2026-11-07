// SPDX-License-Identifier: GPL-3.0-or-later
/** Hash routing (`#/…`), so GitHub Pages needs no server rewrites. */

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

/** The route path without `#` or query: `''` and `'#/'` are both `/`. */
export function routePath(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  return path === '' ? '/' : path;
}

/** The route's query, e.g. `q` in `#/chars?q=arrow`. */
export function routeQuery(hash: string): URLSearchParams {
  const at = hash.indexOf('?');
  return new URLSearchParams(at === -1 ? '' : hash.slice(at + 1));
}

/** The whole fragment, `#` included; re-renders on every hash change. */
export const useHash = (): string => useSyncExternalStore(subscribe, () => window.location.hash);

export const useRoute = (): string => routePath(useHash());
