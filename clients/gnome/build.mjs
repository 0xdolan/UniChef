// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Build the GNOME Shell extension (FR-016):
 * 1. checks metadata.json against VERSION and the extensions.gnome.org rules;
 * 2. writes dist/unichef@0xdolan.github.io/ with the panel icon from the brand masters;
 * 3. writes a reproducible dist/unichef-gnome-<version>.zip, the file uploaded to
 *    extensions.gnome.org.
 * `--install` also copies the extension to ~/.local/share/gnome-shell/extensions/.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import process from 'node:process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

const PKG = dirname(fileURLToPath(import.meta.url));
const ROOT = join(PKG, '..', '..');
export const UUID = 'unichef@0xdolan.github.io';
const SRC = join(PKG, UUID);
const ICON = join(ROOT, 'assets', 'branding', 'source', 'unichef-mark-mono.svg');
export const FILES = ['extension.js', 'lib.js', 'metadata.json', 'stylesheet.css'];

/** extensions.gnome.org's `version-name`: 1-16 letters, digits, spaces and periods. */
export function versionName(semver) {
  return semver.replace('-', ' ');
}

/** Problems with metadata.json; empty when it is valid for `semver`. */
export function metadataProblems(meta, semver) {
  const problems = [];
  if (meta.uuid !== UUID) problems.push(`uuid must be ${UUID}`);
  for (const key of ['name', 'description', 'url']) {
    if (typeof meta[key] !== 'string' || meta[key] === '') problems.push(`${key} is missing`);
  }
  const vn = meta['version-name'];
  if (typeof vn !== 'string' || !/^[a-zA-Z0-9 .]{1,16}$/.test(vn)) {
    problems.push('version-name must be 1-16 letters, digits, spaces or periods');
  } else if (vn !== versionName(semver)) {
    problems.push(`version-name ${vn} does not match VERSION ${semver}; run make version`);
  }
  const shells = meta['shell-version'];
  if (!Array.isArray(shells) || shells.length === 0 || !shells.every((s) => /^\d+$/.test(s))) {
    problems.push('shell-version must list major GNOME versions');
  } else if (shells.some((s) => Number(s) < 45)) {
    problems.push('shell-version must be 45 or later (ES modules)');
  }
  return problems;
}

function sourceDateEpoch() {
  const fromEnv = process.env.SOURCE_DATE_EPOCH;
  if (fromEnv !== undefined && /^\d+$/.test(fromEnv)) return Number(fromEnv);
  const git = spawnSync('git', ['log', '-1', '--format=%ct'], { cwd: ROOT, encoding: 'utf8' });
  return Number(git.stdout.trim()) || 0;
}

function listFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? listFiles(join(dir, e.name), `${prefix}${e.name}/`)
        : [`${prefix}${e.name}`],
    )
    .sort();
}

/** A zip whose bytes depend only on the files and the epoch. */
export function reproducibleZip(dir, epochSeconds) {
  const mtime = new Date(Math.max(epochSeconds, 315_532_800) * 1000);
  const entries = {};
  for (const file of listFiles(dir))
    entries[file] = [readFileSync(join(dir, file)), { mtime, level: 9 }];
  return zipSync(entries);
}

export function build() {
  const semver = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
  const meta = JSON.parse(readFileSync(join(SRC, 'metadata.json'), 'utf8'));
  const problems = metadataProblems(meta, semver);
  if (problems.length > 0) throw new Error(`metadata.json: ${problems.join('; ')}`);

  const out = join(PKG, 'dist', UUID);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'icons'), { recursive: true });
  for (const f of FILES) cpSync(join(SRC, f), join(out, f));
  cpSync(ICON, join(out, 'icons', 'unichef-symbolic.svg'));

  const zip = join(PKG, 'dist', `unichef-gnome-${semver}.zip`);
  writeFileSync(zip, reproducibleZip(out, sourceDateEpoch()));
  process.stdout.write(`${relative(ROOT, zip)}\n`);
  return { dir: out, zip };
}

function install(dir) {
  const target = join(homedir(), '.local', 'share', 'gnome-shell', 'extensions', UUID);
  rmSync(target, { recursive: true, force: true });
  cpSync(dir, target, { recursive: true });
  process.stdout.write(
    `installed ${target}\nLog out and in (Wayland) or press Alt+F2 r (X11), then run:\n` +
      `  gnome-extensions enable ${UUID}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { dir } = build();
    if (process.argv.includes('--install')) install(dir);
  } catch (exc) {
    process.stderr.write(`gnome: ${exc instanceof Error ? exc.message : String(exc)}\n`);
    process.exit(1);
  }
}
