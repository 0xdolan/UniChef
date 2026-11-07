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

export const useRoute = (): string =>
  useSyncExternalStore(subscribe, () => routePath(window.location.hash));
