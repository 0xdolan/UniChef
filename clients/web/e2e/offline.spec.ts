// SPDX-License-Identifier: GPL-3.0-or-later
/** The PWA works offline once installed (PRD §6.4). */
import { expect, test } from '@playwright/test';

// Playwright emulates offline service workers reliably in Chromium only.
test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only');

test('works offline after the first visit, UCD lookups included', async ({ page, context }) => {
  await page.goto('./#/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first visit precaches everything; wait until the worker controls the page.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await context.setOffline(true);
  await page.goto('./#/char/U+0645');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ARABIC LETTER MEEM');
  await page.goto('./#/');
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('hex');
  await page.getByRole('button', { name: 'Add To Hex to the recipe' }).click();
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('A');
  await expect(page.getByRole('textbox', { name: 'Output', exact: true })).toHaveValue('41');
});
