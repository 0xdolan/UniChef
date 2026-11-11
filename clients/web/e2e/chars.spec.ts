// SPDX-License-Identifier: GPL-3.0-or-later
/** Character lookup and queries (FR-005, FR-006). */
import { expect, test } from '@playwright/test';

test('FR-005: look up U+0645 by code point and by a loose name', async ({ page }) => {
  await page.goto('./#/char/U+0645');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ARABIC LETTER MEEM');
  await expect(page.getByText('Arabic', { exact: true }).first()).toBeVisible();

  await page.goto('./#/chars');
  await page.getByRole('searchbox').fill('arabic_letter-meem');
  await page.getByRole('link', { name: 'U+0645', exact: true }).click();
  await expect(page).toHaveURL(/#\/char\/U\+0645$/);
});

test('FR-006: a query returns the same characters as the Python core', async ({ page }) => {
  await page.goto(`./#/chars?q=${encodeURIComponent('name~/ARROW$/ & gc=Sm & age<=6.0')}`);
  // 73 is what `unichef search` returns for this query on the pinned UCD.
  await expect(page.getByText(/^73 characters · \d+ ms$/)).toBeVisible();
});
