// SPDX-License-Identifier: GPL-3.0-or-later
/** The first-run tour in a fresh browser: keyboard, focus, accessibility, once only (FR-015). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('FR-015: the first visit opens the tour, the keyboard drives it, and it stays closed after', async ({
  page,
}) => {
  await page.goto('./#/');
  const tour = page.getByRole('dialog', { name: 'Welcome to UniChef' });
  await expect(tour).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused();

  const { violations } = await new AxeBuilder({ page })
    .include('dialog')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Build a recipe' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The page behind is usable again.
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('base64');

  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search operations' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('./#/about');
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to UniChef' })).toBeVisible();
});

test('FR-015: a shared link skips the tour', async ({ page }) => {
  await page.goto('./#/char/U+202E');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('RIGHT-TO-LEFT OVERRIDE');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
