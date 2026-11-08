// SPDX-License-Identifier: GPL-3.0-or-later
/** The web tour at 1280×800, 1x and 2x, light and dark (PRD §9.3). */
import { expect, test, type Page } from '@playwright/test';

import { SCALES, shotPath, THEMES } from './paths';

const output = (page: Page) => page.getByRole('textbox', { name: 'Output', exact: true });
const input = (page: Page) => page.getByRole('textbox', { name: 'Input', exact: true });

async function addOp(page: Page, query: string, name: string) {
  await page.getByRole('searchbox', { name: 'Search operations' }).fill(query);
  await page.getByRole('button', { name: `Add ${name} to the recipe` }).click();
}

/** name -> drive the page into the state to capture */
const SHOTS: Record<string, (page: Page) => Promise<void>> = {
  async workbench(page) {
    await page.goto('./#/');
    await addOp(page, 'normalize', 'Normalize');
    await addOp(page, 'base64', 'To Base64');
    await input(page).fill('UniChef ✓ café');
    await expect(output(page)).not.toHaveValue('');
    await page.getByRole('searchbox', { name: 'Search operations' }).fill('');
  },
  async inspector(page) {
    await page.goto('./#/');
    await addOp(page, 'hex', 'To Hex');
    await addOp(page, 'reverse', 'Reverse');
    await input(page).fill('hi ✓');
    await expect(output(page)).toHaveValue('39 c9 2e 02 96 86');
    await page.getByRole('button', { name: 'Inspect step 1, To Hex' }).click();
    await expect(page.getByRole('region', { name: 'Step 1: To Hex' })).toContainText('68 69');
    await page.getByRole('searchbox', { name: 'Search operations' }).fill('');
  },
  async char(page) {
    await page.goto('./#/char/U+202E');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('RIGHT-TO-LEFT OVERRIDE');
  },
  async chars(page) {
    await page.goto(`./#/chars?q=${encodeURIComponent('name~/ARROW$/ & gc=Sm & age<=6.0')}`);
    await expect(page.getByText(/^73 characters · \d+ ms$/)).toBeVisible();
  },
  async regex(page) {
    await page.goto(`./#/regex?p=${encodeURIComponent('\\p{Lu}\\p{L}*|\\p{Nd}+')}&f=`);
    await expect(page.getByText(/^[1-9]\d* matches · /)).toBeVisible();
  },
  async recipes(page) {
    await page.goto('./#/recipes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  },
};

for (const theme of THEMES) {
  for (const scale of SCALES) {
    test.describe(`web ${theme} ${String(scale)}x`, () => {
      test.use({
        colorScheme: theme,
        deviceScaleFactor: scale,
        viewport: { width: 1280, height: 800 },
      });
      for (const [name, drive] of Object.entries(SHOTS)) {
        test(name, async ({ page }) => {
          await drive(page);
          await page.screenshot({
            path: shotPath('web', theme, scale, name),
            animations: 'disabled',
            caret: 'hide',
          });
        });
      }
    });
  }
}
