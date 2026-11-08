// SPDX-License-Identifier: GPL-3.0-or-later
/** The workbench: building, inspecting and sharing a recipe (FR-001, FR-002, FR-008). */
import { expect, test, type Page } from '@playwright/test';

const output = (page: Page) => page.getByRole('textbox', { name: 'Output', exact: true });

async function addOp(page: Page, query: string, name: string) {
  await page.getByRole('searchbox', { name: 'Search operations' }).fill(query);
  await page.getByRole('button', { name: `Add ${name} to the recipe` }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./#/');
});

test('FR-001: search, add steps and see the output recompute', async ({ page }) => {
  await addOp(page, 'hex', 'To Hex');
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('Hé');
  await expect(output(page)).toHaveValue('48 c3 a9');
  await addOp(page, 'reverse', 'Reverse');
  await expect(output(page)).toHaveValue('9a 3c 84');
});

test('FR-002: the inspector shows a step output', async ({ page }) => {
  await addOp(page, 'hex', 'To Hex');
  await addOp(page, 'reverse', 'Reverse');
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('hi');
  await expect(output(page)).toHaveValue('96 86');
  await page.getByRole('button', { name: 'Inspect step 1, To Hex' }).click();
  const inspector = page.getByRole('region', { name: 'Step 1: To Hex' });
  await expect(inspector).toContainText('68 69');
  await inspector.getByRole('radio', { name: 'Hex' }).check();
  await expect(inspector).toContainText('36 38 20 36 39');
});

test('FR-008: a link restores the recipe and input', async ({ page, context }) => {
  await addOp(page, 'base64', 'To Base64');
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('UniChef ✓');
  await expect(output(page)).toHaveValue('VW5pQ2hlZiDinJM=');
  await expect(page).toHaveURL(/#\/\?r=[\w-]+&i=[\w-]+$/);
  const shared = await context.newPage();
  await shared.goto(page.url());
  await expect(output(shared)).toHaveValue('VW5pQ2hlZiDinJM=');
  await expect(shared.getByRole('textbox', { name: 'Input', exact: true })).toHaveValue(
    'UniChef ✓',
  );
});

test('builds and bakes a recipe with the keyboard only', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Search operations' });
  for (let i = 0; i < 20 && !(await search.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(search).toBeFocused();
  await page.keyboard.type('to hex');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add To Hex to the recipe' })).toBeFocused();
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Input', exact: true });
  for (let i = 0; i < 40 && !(await input.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(input).toBeFocused();
  await page.keyboard.type('A');
  await expect(output(page)).toHaveValue('41');
});

test('NFR-041: table cells isolate bidi text and label control characters', async ({ page }) => {
  await addOp(page, 'analyse', 'Analyse Characters');
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('a\u202Eب');
  const table = page.getByRole('table').first();
  await expect(table).toContainText('⟨RIGHT-TO-LEFT OVERRIDE⟩');
  const cells = table.locator('tbody td:not([colspan])');
  await expect(cells.first()).toBeVisible();
  const report = await cells.evaluateAll((tds) =>
    tds.map((td) => ({
      dir: td.getAttribute('dir'),
      bidi: getComputedStyle(td).unicodeBidi,
      raw: td.textContent.includes('\u202E'),
    })),
  );
  expect(report.length).toBeGreaterThan(0);
  for (const cell of report) {
    expect(cell).toEqual({ dir: 'auto', bidi: 'isolate', raw: false });
  }
});
