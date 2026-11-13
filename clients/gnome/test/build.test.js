// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { FILES, UUID, build, metadataProblems, reproducibleZip, versionName } from '../build.mjs';

const SRC = join(import.meta.dirname, '..', UUID);
const meta = JSON.parse(readFileSync(join(SRC, 'metadata.json'), 'utf8'));
const REPO = join(import.meta.dirname, '..', '..', '..');
const VERSION = readFileSync(join(REPO, 'VERSION'), 'utf8').trim();

describe('FR-016: GNOME extension package', () => {
  it('has valid metadata that matches VERSION', () => {
    expect(metadataProblems(meta, VERSION)).toEqual([]);
  });

  it('rejects metadata extensions.gnome.org would refuse', () => {
    expect(metadataProblems({ ...meta, uuid: 'x@y' }, VERSION)).toContain(`uuid must be ${UUID}`);
    expect(metadataProblems({ ...meta, 'version-name': '1.0.0-rc.1' }, VERSION).join()).toMatch(
      /1-16 letters/,
    );
    expect(metadataProblems({ ...meta, 'shell-version': ['44'] }, VERSION).join()).toMatch(
      /45 or later/,
    );
    expect(metadataProblems(meta, '9.9.9').join()).toMatch(/does not match VERSION/);
  });

  it('spells pre-release versions the way extensions.gnome.org accepts', () => {
    expect(versionName('1.0.0-rc.12')).toBe('1.0.0 rc.12');
    expect(versionName('1.0.0')).toBe('1.0.0');
  });

  it('builds a reproducible zip with the extension files and the panel icon', () => {
    const { dir, zip } = build();
    const names = Object.keys(unzipSync(readFileSync(zip))).sort();
    expect(names).toEqual([...FILES, 'icons/unichef-symbolic.svg'].sort());
    expect(reproducibleZip(dir, 1_700_000_000)).toEqual(reproducibleZip(dir, 1_700_000_000));
  });

  it('imports only names that lib.js exports', async () => {
    const lib = await import(`../${UUID}/lib.js`);
    const source = readFileSync(join(SRC, 'extension.js'), 'utf8');
    const block = /import \{([^}]+)\} from '\.\/lib\.js'/.exec(source);
    expect(block).not.toBeNull();
    const names = block[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of names) expect(lib).toHaveProperty(name);
  });

  it('ships the same files in the Debian package as in the zip', () => {
    const rules = readFileSync(join(REPO, 'debian', 'rules'), 'utf8');
    const files = /^EXT_FILES = (.*)$/m.exec(rules)?.[1].split(' ');
    expect(files?.sort()).toEqual([...FILES].sort());
    expect(rules).toContain(`EXT_UUID = ${UUID}`);
  });

  it('depends on the oldest GNOME Shell that metadata.json supports', () => {
    const control = readFileSync(join(REPO, 'debian', 'control'), 'utf8');
    const oldest = Math.min(...meta['shell-version'].map(Number));
    expect(control).toContain(`gnome-shell (>= ${oldest})`);
  });
});
