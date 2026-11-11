// SPDX-License-Identifier: GPL-3.0-or-later
/** Phone layout, touch targets and install metadata (NFR-043). Runs on the mobile projects. */
import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  '#/',
  '#/chars',
  '#/char/U+0645',
  '#/blocks',
  '#/blocks/Arabic',
  '#/scripts',
  '#/scripts/Arab',
  '#/regex',
  '#/playground',
  '#/playground/to-hex',
  '#/recipes',
  '#/about',
  '#/docs',
  '#/docs/learn/hashing',
  '#/docs/reference/ops/to-base64',
];

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`./${route}`);
  await expect(page.locator('main h1, main h2').first()).toBeVisible();
  await expect(page.getByText(/Loading…|Looking up…/)).toHaveCount(0);
}

/** Interactive elements under 24 × 24 px. Links inside running text are exempt (WCAG 2.5.8). */
function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, summary, [role=button], [tabindex="0"]',
      ),
    ]
      .filter((e) => {
        const s = getComputedStyle(e);
        if (s.visibility === 'hidden' || s.display === 'none') return false;
        const r = e.getBoundingClientRect();
        if (r.width === 0) return false;
        const inline = e.tagName === 'A' && s.display === 'inline' && e.closest('p') !== null;
        return !inline && (r.width < 24 || r.height < 24);
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const label = (e.getAttribute('aria-label') ?? e.textContent).trim().slice(0, 20);
        return `${e.tagName} ${Math.round(r.width)}x${Math.round(r.height)} ${label}`;
      }),
  );
}

for (const route of ROUTES) {
  test(`NFR-043: ${route} fits the screen with touch-sized targets`, async ({ page }) => {
    await open(page, route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
  });
}

test('NFR-043: the menu button opens the nav, navigates and closes', async ({ page }) => {
  await open(page, '#/');
  const menu = page.getByRole('button', { name: 'Menu' });
  const nav = page.getByRole('navigation', { name: 'Main', includeHidden: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
  const header = await page.locator('header').boundingBox();
  expect(header?.height ?? 0).toBeLessThanOrEqual(72);

  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/#\/about$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
});

test('NFR-043: the Workbench stacks its panes and fields do not trigger zoom', async ({ page }) => {
  await open(page, '#/');
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('hex');
  await page.getByRole('button', { name: 'Add To Hex to the recipe' }).click();
  const input = page.getByRole('textbox', { name: 'Input', exact: true });
  const output = page.getByRole('textbox', { name: 'Output', exact: true });
  await input.fill('Hé');
  await expect(output).toHaveValue('48 c3 a9');

  const a = await input.boundingBox();
  const b = await output.boundingBox();
  expect(a && b && a.y + a.height <= b.y).toBeTruthy();

  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')].map((e) =>
      parseFloat(getComputedStyle(e).fontSize),
    ),
  );
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  // The step's move, disable and remove buttons only exist once a step is added.
  expect(await smallTargets(page)).toEqual([]);
});

test('NFR-043: the credit footer wraps inside the screen and stays reachable', async ({ page }) => {
  await open(page, '#/about');
  const footer = page.getByRole('contentinfo');
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByRole('link', { name: /^v\d/ })).toBeVisible();
  const box = await footer.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
});

test('NFR-043: the install metadata and every manifest icon resolve', async ({ page, request }) => {
  await open(page, '#/');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(touchIcon ?? '', page.url()).href)).ok()).toBeTruthy();

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href ?? '', page.url()).href;
  const manifest = (await (await request.get(manifestUrl)).json()) as {
    icons: { src: string; purpose?: string; type: string }[];
  };
  expect(manifest.icons.some((i) => i.type === 'image/png')).toBeTruthy();
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBeTruthy();
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, manifestUrl).href);
    expect(res.ok(), icon.src).toBeTruthy();
  }
});
