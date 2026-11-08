// SPDX-License-Identifier: GPL-3.0-or-later
/** Security requirements that hold across the whole core (PRD §5.3). */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function sources(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

function matches(pattern: RegExp): string[] {
  return sources().flatMap((path) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .flatMap((line, i) =>
        pattern.test(line) && !/^\s*(\*|\/\/|\/\*)/.test(line)
          ? [`${relative(SRC, path)}:${String(i + 1)}`]
          : [],
      ),
  );
}

describe('security (PRD §5.3)', () => {
  it('SEC-001: makes no network calls beyond reading its own data files', () => {
    const network =
      /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|node:(net|http|https|tls|dgram)/;
    // load.ts fetches the compiled data files next to the module, never another origin.
    expect(matches(network)).toEqual(['data/load.ts:24']);
    expect(readFileSync(join(SRC, 'data/load.ts'), 'utf8')).toContain(
      'new URL(`../../data/${file}`, import.meta.url)',
    );
  });

  it('SEC-003: never evaluates code or writes HTML', () => {
    expect(matches(/\beval\(|new Function\b|\binnerHTML\b|outerHTML|document\.write/)).toEqual([]);
  });
});
