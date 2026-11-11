// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Render the CLI frames that scripts/screenshots/cli.py recorded as SVG to PNG at 1x and
 * 2x (PRD §9.3). Chromium stands in for rsvg-convert so every PNG comes from one renderer.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { expect, test } from '@playwright/test';

import { ROOT, SCALES, shotPath, THEMES } from './paths';

const SVG_DIR = `${ROOT}build/screenshots/cli`;

for (const theme of THEMES) {
  const dir = `${SVG_DIR}/${theme}`;
  const names = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.svg'))
        .map((f) => f.slice(0, -4))
    : [];
  for (const scale of SCALES) {
    test.describe(`cli ${theme} ${String(scale)}x`, () => {
      test.use({ deviceScaleFactor: scale });
      test('frames were recorded', () => {
        expect(names, `run scripts/screenshots/cli.py first (${dir})`).not.toHaveLength(0);
      });
      for (const name of names) {
        test(name, async ({ page }) => {
          const file = `${dir}/${name}.svg`;
          const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(readFileSync(file, 'utf8'));
          expect(box, `${file} has no viewBox`).not.toBeNull();
          const [width, height] = [Math.ceil(Number(box?.[1])), Math.ceil(Number(box?.[2]))];
          await page.setViewportSize({ width, height });
          await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
          await page.screenshot({
            path: shotPath('cli', theme, scale, name),
            omitBackground: true,
          });
        });
      }
    });
  }
}
