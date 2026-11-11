// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Builds one browser's extension (PRD §7.2):
 *
 *     pnpm --filter extensions build --target chrome|edge|firefox|safari [--skip-web]
 *
 * 1. builds the web app's `extension.html` entry (`pnpm --filter web build:extension`);
 * 2. bundles `src/background.ts` into one ES module;
 * 3. merges `manifest.base.json` with `overlays/<target>.json`;
 * 4. copies the icons from `assets/branding/dist/ext/` (`make assets`);
 * 5. validates: every referenced file exists, Chrome and Edge against the Chrome manifest
 *    schema, Firefox with `web-ext lint`;
 * 6. writes `dist/<target>/` and a reproducible `dist/unichef-<target>-<version>.zip`.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { Ajv } from 'ajv';
import { zipSync, type Zippable } from 'fflate';
import { build as viteBuild } from 'vite';

import { isObject, merge, type Json, type JsonObject } from './merge.ts';

export const TARGETS = ['chrome', 'edge', 'firefox', 'safari'] as const;
export type Target = (typeof TARGETS)[number];

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const ROOT = join(PKG, '..', '..', '..');
const WEB_DIST = join(ROOT, 'clients', 'web', 'dist-extension');
const ICONS = join(ROOT, 'assets', 'branding', 'dist', 'ext');
const ICON_SIZES = [16, 32, 48, 96, 128];
/** SchemaStore `chrome-manifest.json` at the commit in THIRD_PARTY_NOTICES.md. */
const SCHEMA = join(HERE, 'chrome-manifest.schema.json');
const SCHEMA_SHA256 = '8fc2fe8078ed7c05dce7b6e3e969e160ca3ba20e22e410ab42dc801fcae8492a';

const readJson = (path: string): JsonObject => {
  const value = JSON.parse(readFileSync(path, 'utf8')) as Json;
  if (!isObject(value)) throw new Error(`${path}: expected a JSON object.`);
  return value;
};

function run(cmd: string, args: readonly string[], cwd = ROOT): void {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed.`);
}

export function manifestFor(target: Target): JsonObject {
  return merge(
    readJson(join(PKG, 'manifest.base.json')),
    readJson(join(PKG, 'overlays', `${target}.json`)),
  );
}

/** Package-relative paths the manifest points at, without `#fragment`s. */
export function referencedFiles(manifest: JsonObject): string[] {
  const files = new Set<string>();
  const add = (v: Json | undefined): void => {
    if (typeof v === 'string') files.add(v.split('#')[0] ?? v);
  };
  const values = (v: Json | undefined): void => {
    if (isObject(v)) Object.values(v).forEach(add);
  };
  values(manifest['icons']);
  const action = manifest['action'];
  if (isObject(action)) {
    add(action['default_popup']);
    values(action['default_icon']);
  }
  const background = manifest['background'];
  if (isObject(background)) {
    add(background['service_worker']);
    const scripts = background['scripts'];
    if (Array.isArray(scripts)) scripts.forEach(add);
  }
  const panel = manifest['side_panel'];
  if (isObject(panel)) add(panel['default_path']);
  const sidebar = manifest['sidebar_action'];
  if (isObject(sidebar)) add(sidebar['default_panel']);
  return [...files].sort();
}

function validate(target: Target, manifest: JsonObject, outDir: string): void {
  const missing = referencedFiles(manifest).filter((f) => !existsSync(join(outDir, f)));
  if (missing.length > 0)
    throw new Error(`The manifest names missing files: ${missing.join(', ')}`);
  if (target === 'chrome' || target === 'edge') {
    const raw = readFileSync(SCHEMA);
    if (createHash('sha256').update(raw).digest('hex') !== SCHEMA_SHA256) {
      throw new Error(`${relative(ROOT, SCHEMA)} does not match its pinned SHA-256.`);
    }
    const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
    const check = ajv.compile(JSON.parse(raw.toString('utf8')) as JsonObject);
    if (!check(manifest)) {
      throw new Error(`Chrome manifest schema: ${ajv.errorsText(check.errors)}`);
    }
  }
  if (target === 'firefox') webExtLint(outDir);
}

interface LintMessage {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
}

/**
 * Known `web-ext lint` warnings, each with its exact count, so that a new one of the same
 * kind still fails the build:
 *
 * - `data_collection_permissions` arrived in Firefox 140 (Android 142). AMO requires it;
 *   Firefox 128 ESR (`FIREFOX_MIN`, PRD §7.2) ignores it.
 * - react-dom assigns `innerHTML` for `dangerouslySetInnerHTML`, which UniChef never uses
 *   (eslint bans `innerHTML` and `dangerouslySetInnerHTML` in our code).
 */
export const LINT_ALLOWED: Readonly<Record<string, number>> = {
  KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION: 1,
  KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION: 1,
  UNSAFE_VAR_ASSIGNMENT: 2,
};

/** The lint problems left after the allowance; empty when the package passes. */
export function lintProblems(report: {
  readonly errors: readonly LintMessage[];
  readonly warnings: readonly LintMessage[];
}): string[] {
  const line = (m: LintMessage): string => `${m.code}: ${m.message} (${m.file ?? 'package'})`;
  const problems = report.errors.map(line);
  const counts = new Map<string, LintMessage[]>();
  for (const w of report.warnings) counts.set(w.code, [...(counts.get(w.code) ?? []), w]);
  for (const [code, found] of counts) {
    if (found.length !== (LINT_ALLOWED[code] ?? 0)) problems.push(...found.map(line));
  }
  return problems;
}

function webExtLint(outDir: string): void {
  const result = spawnSync(
    join(PKG, 'node_modules', '.bin', 'web-ext'),
    ['lint', '--source-dir', outDir, '--output', 'json', '--no-input'],
    { cwd: PKG, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  let report: { errors: LintMessage[]; warnings: LintMessage[] };
  try {
    report = JSON.parse(result.stdout) as typeof report;
  } catch {
    throw new Error(`web-ext lint gave no report: ${result.stderr.trim()}`);
  }
  const problems = lintProblems(report);
  if (problems.length > 0) throw new Error(`web-ext lint:\n  ${problems.join('\n  ')}`);
  process.stdout.write('web-ext lint: ok\n');
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => statSync(join(dir, f)).isFile())
    .map((f) => f.split(sep).join('/'))
    .sort();
}

/** A zip whose bytes depend only on the files: sorted entries and one fixed timestamp. */
export function reproducibleZip(dir: string, epochSeconds: number): Uint8Array {
  // Zip timestamps cannot go below 1980.
  const mtime = new Date(Math.max(epochSeconds, 315_532_800) * 1000);
  const entries: Zippable = {};
  for (const file of listFiles(dir)) {
    entries[file] = [readFileSync(join(dir, file)), { mtime, level: 9 }];
  }
  return zipSync(entries);
}

function sourceDateEpoch(): number {
  const fromEnv = process.env['SOURCE_DATE_EPOCH'];
  if (fromEnv !== undefined && /^\d+$/.test(fromEnv)) return Number(fromEnv);
  const git = spawnSync('git', ['log', '-1', '--format=%ct'], { cwd: ROOT, encoding: 'utf8' });
  return Number(git.stdout.trim()) || 0;
}

async function buildTarget(target: Target): Promise<void> {
  const outDir = join(PKG, 'dist', target);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(join(WEB_DIST, 'extension.html'))) {
    throw new Error(
      `${relative(ROOT, WEB_DIST)} is missing; run pnpm --filter web build:extension`,
    );
  }
  // `404.html` is the GitHub Pages fallback from `public/`; an extension has no use for it.
  cpSync(WEB_DIST, outDir, {
    recursive: true,
    filter: (src) => relative(WEB_DIST, src) !== '404.html',
  });

  await viteBuild({
    configFile: false,
    logLevel: 'warn',
    root: PKG,
    build: {
      outDir,
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: false,
      lib: {
        entry: join(PKG, 'src', 'background.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
    },
  });

  const manifest = manifestFor(target);
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  cpSync(join(PKG, '_locales'), join(outDir, '_locales'), { recursive: true });

  mkdirSync(join(outDir, 'icons'));
  for (const size of ICON_SIZES) {
    const icon = join(ICONS, `${String(size)}.png`);
    if (!existsSync(icon)) throw new Error(`${relative(ROOT, icon)} is missing; run make assets`);
    cpSync(icon, join(outDir, 'icons', `${String(size)}.png`));
  }

  validate(target, manifest, outDir);

  const version = manifest['version_name'] ?? manifest['version'];
  if (typeof version !== 'string') throw new Error(`${target}: the manifest has no version.`);
  const zip = join(PKG, 'dist', `unichef-${target}-${version}.zip`);
  writeFileSync(zip, reproducibleZip(outDir, sourceDateEpoch()));
  process.stdout.write(`${relative(ROOT, zip)}\n`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      target: { type: 'string', multiple: true },
      'skip-web': { type: 'boolean', default: false },
    },
  });
  const targets = values.target ?? [...TARGETS];
  for (const t of targets) {
    if (!(TARGETS as readonly string[]).includes(t))
      throw new Error(`Unknown target ${t}; use ${TARGETS.join(', ')}.`);
  }
  if (!values['skip-web']) run('pnpm', ['--filter', 'web', 'build:extension']);
  for (const t of targets) await buildTarget(t as Target);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((exc: unknown) => {
    process.stderr.write(`extensions: ${exc instanceof Error ? exc.message : String(exc)}\n`);
    process.exit(1);
  });
}
