// SPDX-License-Identifier: GPL-3.0-or-later
/** The app talks to nobody but its own origin (PRD §5.3). */
import { expect, test } from '@playwright/test';

test('SEC-001: the page policy limits connections to its own origin', async ({ page }) => {
  await page.goto('./#/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain("default-src 'self'");
});

test('SEC-002: every request stays on the same origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== origin) {
      foreign.push(request.url());
    }
  });
  for (const route of [
    './#/',
    './#/chars',
    './#/char/U+0645',
    './#/blocks',
    './#/scripts',
    './#/regex',
    './#/playground',
    './#/recipes',
    './#/about',
  ]) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }
  await page.getByRole('link', { name: 'Workbench', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('hex');
  await page.getByRole('button', { name: 'Add To Hex to the recipe' }).click();
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('A');
  await expect(page.getByRole('textbox', { name: 'Output', exact: true })).toHaveValue('41');
  expect(foreign).toEqual([]);
});
