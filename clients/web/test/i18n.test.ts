// SPDX-License-Identifier: GPL-3.0-or-later
/** UI strings are externalised so the UI can be localised later (NFR-042). */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import en from '../src/i18n/en.json';
import { t } from '../src/i18n/index.js';

const SRC = join(__dirname, '..', 'src');
const EXT = join(__dirname, '..', '..', 'extensions', 'common');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(path);
    return e.name.endsWith('.tsx') ? [path] : [];
  });
}

// English words between JSX tags, or a literal user-facing attribute value.
const JSX_TEXT = />\s*[A-Za-z][A-Za-z ,.'’!?-]{2,}\s*</;
const ATTR = /\b(?:aria-label|title|placeholder|alt)="[A-Za-z][^"]*"/;

describe('web UI strings (NFR-042)', () => {
  it('has no literal English text in components', () => {
    const offenders = tsxFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          JSX_TEXT.test(line) || ATTR.test(line)
            ? [`${relative(SRC, file)}:${i + 1}: ${line.trim()}`]
            : [],
        ),
    );
    expect(offenders).toEqual([]);
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('ops.add', { name: 'To Hex' })).toBe('Add To Hex to the recipe');
    expect(t('ops.add')).toBe('Add {name} to the recipe');
  });

  it('has no empty messages', () => {
    expect(Object.entries(en).filter(([, v]) => v.trim() === '')).toEqual([]);
  });
});

describe('extension strings (NFR-042)', () => {
  const messages = JSON.parse(
    readFileSync(join(EXT, '_locales', 'en', 'messages.json'), 'utf8'),
  ) as Record<string, { message: string }>;

  it('defines every __MSG_…__ the manifest uses', () => {
    const manifest = readFileSync(join(EXT, 'manifest.base.json'), 'utf8');
    const used = [...manifest.matchAll(/__MSG_(\w+)__/g)].map((m) => m[1] ?? '');
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((key) => !messages[key]?.message)).toEqual([]);
  });

  it('defines every message the scripts ask for', () => {
    const src = join(EXT, 'src');
    const used = readdirSync(src)
      .filter((f) => f.endsWith('.ts'))
      .flatMap((f) =>
        [...readFileSync(join(src, f), 'utf8').matchAll(/getMessage\('(\w+)'\)/g)].map(
          (m) => m[1] ?? '',
        ),
      );
    expect(used.filter((key) => !messages[key]?.message)).toEqual([]);
  });
});
