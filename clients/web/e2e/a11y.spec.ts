// SPDX-License-Identifier: GPL-3.0-or-later
/** An axe-core scan of every route: no serious or critical violations (NFR-040). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = [
  '#/',
  '#/chars',
  '#/chars?q=arrow',
  '#/char/U+0645',
  '#/blocks',
  '#/blocks/Basic_Latin',
  '#/scripts',
  '#/scripts/Arab',
  '#/regex?p=%5Cp%7BLu%7D&f=',
  '#/playground',
  '#/playground/to-hex',
  '#/recipes',
  '#/about',
];

for (const route of ROUTES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`NFR-040: ${route} in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`./${route}`);
      await expect(page.locator('main h1, main h2').first()).toBeVisible();
      // Let lazy pages and lookups settle before scanning.
      await expect(page.getByText(/Loading…|Looking up…/)).toHaveCount(0);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });
  }
}
