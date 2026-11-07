// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * `virtual:licenses`: every npm package the app ships (the runtime dependencies and theirs,
 * not dev tools), with its licence text, for the About page (PRD §6.4).
 */
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { findPackageJSON } from 'node:module';
import { dirname, join, sep } from 'node:path';

import type { Plugin } from 'vite';

export interface Licence {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly text: string;
}

interface Manifest {
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const ID = 'virtual:licenses';
const RESOLVED = `\0${ID}`;
const LICENCE_FILE = /^(licen[cs]e|copying)(\.|$)/i;

const readManifest = (file: string): Manifest => JSON.parse(readFileSync(file, 'utf8')) as Manifest;

function licenceText(dir: string): string {
  const file = readdirSync(dir).find((name) => LICENCE_FILE.test(name));
  return file === undefined ? '' : readFileSync(join(dir, file), 'utf8').trim();
}

/** A dependency's package.json, or undefined for an optional peer that is not installed. */
function locate(dep: string, from: string): string | undefined {
  try {
    return findPackageJSON(dep, from);
  } catch (exc) {
    if ((exc as { code?: string }).code === 'ERR_MODULE_NOT_FOUND') return undefined;
    throw exc;
  }
}

const runtimeDeps = (manifest: Manifest): string[] =>
  Object.keys({ ...manifest.peerDependencies, ...manifest.dependencies });

/**
 * Walk the runtime dependency tree from `root` (a package.json path). Workspace packages
 * such as `@unichef/core` are UniChef itself: their dependencies are listed, they are not.
 */
export function collectLicences(root: string): Licence[] {
  const found = new Map<string, Licence>();
  const seen = new Set<string>();
  const visit = (manifestPath: string, deps: readonly string[]) => {
    for (const dep of deps) {
      // Type declarations (optional peers such as `@types/react`) never reach the bundle.
      if (dep.startsWith('@types/')) continue;
      const file = locate(dep, manifestPath);
      if (file === undefined) continue;
      const real = realpathSync(file);
      if (seen.has(real)) continue;
      seen.add(real);
      const manifest = readManifest(real);
      if (real.split(sep).includes('node_modules')) {
        found.set(`${manifest.name}@${manifest.version}`, {
          name: manifest.name,
          version: manifest.version,
          license: manifest.license ?? 'UNKNOWN',
          text: licenceText(dirname(real)),
        });
      }
      visit(real, runtimeDeps(manifest));
    }
  };
  visit(root, runtimeDeps(readManifest(root)));
  return [...found.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function licences(root: string): Plugin {
  return {
    name: 'unichef-licences',
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load: (id) =>
      id === RESOLVED ? `export default ${JSON.stringify(collectLicences(root))};` : undefined,
  };
}
