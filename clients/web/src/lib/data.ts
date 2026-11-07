// SPDX-License-Identifier: GPL-3.0-or-later
/** Serves the core's gzipped data files (UCD, HTML entities) as hashed build assets. */

import type { DataSource } from '@unichef/core';

const urls: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../../packages/npm-core/data/*.json.gz', {
      query: '?url',
      import: 'default',
      eager: true,
    }),
  ).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)} for ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** The bundled files, or `baseUrl + file` when a host (an extension) serves them itself. */
export function dataSource(baseUrl?: string): DataSource {
  return (file) => {
    if (baseUrl !== undefined) return fetchBytes(new URL(file, baseUrl).href);
    const url = urls[file];
    if (url === undefined) {
      return Promise.reject(new Error(`No bundled data file ${file}`));
    }
    return fetchBytes(url);
  };
}
