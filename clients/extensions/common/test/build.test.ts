// SPDX-License-Identifier: GPL-3.0-or-later

import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unzipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LINT_ALLOWED,
  lintProblems,
  manifestFor,
  referencedFiles,
  reproducibleZip,
  TARGETS,
} from '../build/build.ts';
import { merge } from '../build/merge.ts';

describe('merge', () => {
  it('merges objects, replaces arrays, appends and deletes', () => {
    const base = { a: { x: 1, y: 2 }, list: [1, 2], keep: 'k', gone: true, more: ['p'] };
    const overlay = { a: { y: 3, z: 4 }, list: [9], gone: null, more: { $append: ['q'] } };
    expect(merge(base, overlay)).toEqual({
      a: { x: 1, y: 3, z: 4 },
      list: [9],
      keep: 'k',
      more: ['p', 'q'],
    });
    expect(base.a).toEqual({ x: 1, y: 2 });
  });

  it('appends to a missing key and refuses to append to a non-array', () => {
    expect(merge({}, { l: { $append: [1] } })).toEqual({ l: [1] });
    expect(() => merge({ l: 'x' }, { l: { $append: [1] } })).toThrow('/l: $append');
  });
});

describe('manifests', () => {
  it.each(TARGETS)('%s has the version mapping (PRD §8.4)', (target) => {
    const m = manifestFor(target);
    expect(m['manifest_version']).toBe(3);
    expect(m['version']).toMatch(/^\d+(\.\d+){0,3}$/);
    expect(typeof m['version_name']).toBe('string');
  });

  it.each(TARGETS)('%s asks for no page access (FR-007, SEC-001)', (target) => {
    const m = manifestFor(target);
    expect(m['host_permissions']).toBeUndefined();
    expect(m['content_scripts']).toBeUndefined();
    expect(m['optional_permissions']).toBeUndefined();
    const permissions = m['permissions'] as string[];
    for (const p of ['activeTab', 'tabs', 'scripting', '<all_urls>']) {
      expect(permissions).not.toContain(p);
    }
  });

  it('gives Chrome a side panel and a service worker', () => {
    const m = manifestFor('chrome');
    expect(m['permissions']).toContain('sidePanel');
    expect(referencedFiles(m)).toContain('background.js');
    expect(referencedFiles(m)).toContain('extension.html');
  });

  it('gives Firefox a sidebar and background scripts, not a service worker', () => {
    const m = manifestFor('firefox');
    const background = m['background'] as Record<string, unknown>;
    expect(background['service_worker']).toBeUndefined();
    expect(background['scripts']).toEqual(['background.js']);
    expect(m['sidebar_action']).toBeDefined();
    expect(m['permissions']).not.toContain('sidePanel');
  });
});

describe('reproducibleZip', () => {
  let dir = '';
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('depends only on the files, not on their timestamps', () => {
    dir = mkdtempSync(join(tmpdir(), 'unichef-zip-'));
    mkdirSync(join(dir, 'icons'));
    writeFileSync(join(dir, 'b.txt'), 'b');
    writeFileSync(join(dir, 'icons', 'a.png'), 'a');
    const first = reproducibleZip(dir, 1_700_000_000);
    utimesSync(join(dir, 'b.txt'), new Date(0), new Date(0));
    const second = reproducibleZip(dir, 1_700_000_000);
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
    expect(Object.keys(unzipSync(first))).toEqual(['b.txt', 'icons/a.png']);
  });
});

describe('lintProblems', () => {
  const warn = (code: string) => ({ code, message: 'm', file: 'f.js' });
  const allowed = Object.entries(LINT_ALLOWED).flatMap(([code, n]) =>
    Array.from({ length: n }, () => warn(code)),
  );

  it('passes the known warnings at their exact counts', () => {
    expect(lintProblems({ errors: [], warnings: allowed })).toEqual([]);
  });

  it('fails on errors, new warnings, and an extra known warning', () => {
    expect(lintProblems({ errors: [warn('E')], warnings: allowed })).toEqual(['E: m (f.js)']);
    expect(lintProblems({ errors: [], warnings: [...allowed, warn('NEW')] })).toEqual([
      'NEW: m (f.js)',
    ]);
    const extra = lintProblems({
      errors: [],
      warnings: [...allowed, warn('UNSAFE_VAR_ASSIGNMENT')],
    });
    expect(extra).toHaveLength(3);
  });
});

describe('store listings', () => {
  const read = (path: string): unknown =>
    JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

  it('lists only screenshots that the branding manifest produces (PRD §7.6)', () => {
    const shots = read('../../chrome/store/screenshots.json') as {
      size: number[];
      screenshots: { file: string; caption: string }[];
    };
    const branding = read('../../../../assets/branding/manifest.json') as {
      outputs: { kind: string; names?: string[]; size?: number[] }[];
    };
    const spec = branding.outputs.find((o) => o.kind === 'screenshot');
    expect(spec).toBeDefined();
    expect(shots.size).toEqual(spec?.size);
    expect(shots.screenshots.map((s) => s.file).sort()).toEqual(
      spec?.names?.map((n) => `screenshot-${n}.png`).sort(),
    );
    for (const s of shots.screenshots) expect(s.caption.length).toBeLessThanOrEqual(132);
  });
});
