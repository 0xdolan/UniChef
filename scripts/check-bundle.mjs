#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Fail when the web build exceeds its bundle budgets (NFR-010, PRD §6.4), read from the
 * Vite manifest. Initial JS is the entry chunk, everything it imports statically and the
 * workers it starts, gzipped; lazy page chunks and the UCD are left out. The UCD files are
 * already gzipped, so their size on disk is what counts.
 *
 * Usage: node scripts/check-bundle.mjs [dist-dir]   (default: clients/web/dist)
 */
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KIB = 1024;
const BUDGETS = {
  'initial JS': 250 * KIB,
  'ucd-core': 400 * KIB,
  'ucd-names': 900 * KIB,
  'ucd-security': 150 * KIB,
};

const dist = resolve(process.argv[2] ?? 'clients/web/dist');
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));

/** Files of the entry chunk and its static imports, with the workers they reference. */
function initialFiles() {
  const files = new Set();
  const visit = (key) => {
    const chunk = manifest[key];
    if (chunk === undefined || files.has(chunk.file)) return;
    files.add(chunk.file);
    for (const asset of chunk.assets ?? []) if (asset.endsWith('.js')) files.add(asset);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
  return [...files];
}

function dataFile(prefix) {
  const entry = Object.values(manifest).find((chunk) => chunk.file.startsWith(`assets/${prefix}-`));
  if (entry === undefined) throw new Error(`${prefix} is missing from the build manifest`);
  return entry.file;
}

const sizes = {
  'initial JS': initialFiles().reduce(
    (sum, file) => sum + gzipSync(readFileSync(join(dist, file)), { level: 9 }).length,
    0,
  ),
  'ucd-core': statSync(join(dist, dataFile('ucd-core'))).size,
  'ucd-names': statSync(join(dist, dataFile('ucd-names'))).size,
  'ucd-security': statSync(join(dist, dataFile('ucd-security'))).size,
};

let failed = false;
for (const [name, budget] of Object.entries(BUDGETS)) {
  const size = sizes[name];
  const over = size > budget;
  failed ||= over;
  const kib = (n) => `${(n / KIB).toFixed(1)} KiB`;
  console.log(
    `${over ? 'FAIL' : 'ok  '} ${name.padEnd(12)} ${kib(size).padStart(11)} of ${kib(budget)} gzip`,
  );
}
process.exit(failed ? 1 : 0);
