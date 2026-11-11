// SPDX-License-Identifier: GPL-3.0-or-later
/** The web app at 1280×800 and on a 390×844 phone, 1x and 2x, light and dark (PRD §9.3). */
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
  async docs(page) {
    await page.goto('./#/docs/reference/ops/to-base64');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  },
  async tour(page) {
    await firstVisit(page);
  },
};

/** The first-run tour (FR-015): forget that it was seen, then open the bare workbench. */
async function firstVisit(page: Page) {
  await page.goto('./#/');
  await page.evaluate(() => {
    localStorage.removeItem('unichef.tour');
  });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Welcome to UniChef' })).toBeVisible();
}

/** Phone shots: name -> drive the page. */
const PHONE: Record<string, (page: Page) => Promise<void>> = {
  async workbench(page) {
    await page.goto('./#/');
    await addOp(page, 'base64', 'To Base64');
    await input(page).fill('UniChef ✓ café');
    await expect(output(page)).not.toHaveValue('');
    await page.getByRole('searchbox', { name: 'Search operations' }).fill('');
    // Show the recipe and its output rather than the operation list above them.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.getByRole('heading', { name: 'Recipe' }).evaluate((h) => {
      h.scrollIntoView({ block: 'start' });
      // Clear the sticky header.
      window.scrollBy(0, -((document.querySelector('header')?.offsetHeight ?? 0) + 24));
    });
  },
  async menu(page) {
    await page.goto('./#/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  },
  async char(page) {
    await page.goto('./#/char/U+202E');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('RIGHT-TO-LEFT OVERRIDE');
  },
  async docs(page) {
    await page.goto('./#/docs/learn/unicode-security');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  },
  async tour(page) {
    await firstVisit(page);
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

for (const theme of THEMES) {
  for (const scale of SCALES) {
    test.describe(`phone ${theme} ${String(scale)}x`, () => {
      test.use({
        colorScheme: theme,
        deviceScaleFactor: scale,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      for (const [name, drive] of Object.entries(PHONE)) {
        test(name, async ({ page }) => {
          await drive(page);
          await page.screenshot({
            path: shotPath('phone', theme, scale, name),
            animations: 'disabled',
            caret: 'hide',
          });
        });
      }
    });
  }
}
