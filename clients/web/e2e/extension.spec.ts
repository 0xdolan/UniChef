// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The Chrome extension in a real Chromium (PRD §7): install, permissions, the context menu,
 * the panel tabs, the popup, settings, privacy and CSP. Runs in the `extension` project
 * against clients/extensions/common/dist/chrome (`make build-ext`).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';

const EXT_DIR = fileURLToPath(new URL('../../extensions/common/dist/chrome', import.meta.url));
// CI always has the build (the extensions job); locally, skip with a hint rather than time out.
base.skip(
  !existsSync(`${EXT_DIR}/manifest.json`) && process.env.CI === undefined,
  'Build the extension first: make build-ext',
);

const SAMPLE = 'Héllo ‮abc‬ ​ мир 👩🏽‍💻 ﷺ';

interface Fixtures {
  context: BrowserContext;
  worker: Worker;
  extUrl: (hash: string) => string;
}

const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extUrl: async ({ worker }, use) => {
    const id = new URL(worker.url()).host;
    await use((hash) => `chrome-extension://${id}/extension.html${hash}`);
  },
});

/** Opens the panel layout and collects console errors and non-extension requests. */
async function openPanel(context: BrowserContext, url: string) {
  const page = await context.newPage();
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!/^(chrome-extension|data|blob):/.test(r.url())) foreign.push(r.url());
  });
  await page.goto(url);
  return { page, errors, foreign };
}

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Panel sections' }).getByRole('link', { name });

test('SEC-001: installs with no host permissions and no content scripts', async ({ worker }) => {
  const manifest = (await worker.evaluate(() => chrome.runtime.getManifest())) as {
    permissions?: string[];
    host_permissions?: string[];
    optional_host_permissions?: string[];
    content_scripts?: unknown[];
    action?: { default_title?: string };
  };
  expect([...(manifest.permissions ?? [])].sort()).toEqual([
    'contextMenus',
    'sidePanel',
    'storage',
  ]);
  expect(manifest.host_permissions ?? []).toEqual([]);
  expect(manifest.optional_host_permissions ?? []).toEqual([]);
  expect(manifest.content_scripts ?? []).toEqual([]);
  expect(manifest.action?.default_title).toBe('UniChef');
});

test('FR-007: the Inspect with UniChef menu item is registered', async ({ worker }) => {
  // update() rejects for an id that does not exist.
  await expect
    .poll(() =>
      worker.evaluate(() =>
        chrome.contextMenus.update('unichef-inspect', {}).then(
          () => true,
          () => false,
        ),
      ),
    )
    .toBe(true);
});

test('FR-007: a stored selection reaches the open panel and updates it live', async ({
  context,
  worker,
  extUrl,
}) => {
  const { page, errors, foreign } = await openPanel(context, extUrl('#/panel'));
  await expect(tab(page, 'Inspect')).toHaveAttribute('aria-current', 'page');

  await worker.evaluate(
    (text) => chrome.storage.session.set({ selection: { text, sourceUrl: null } }),
    SAMPLE,
  );
  const box = page.getByRole('textbox', { name: 'Text to inspect' });
  await expect(box).toHaveValue(SAMPLE);
  await expect(page.getByText(/^Invisible characters: [1-9]/)).toBeVisible();
  await expect(page.getByText(/^Code points: \d+/)).toBeVisible();

  await worker.evaluate(() =>
    chrome.storage.session.set({ selection: { text: 'second', sourceUrl: null } }),
  );
  await expect(box).toHaveValue('second');
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('FR-007: a selection over the limit is cut, without splitting an emoji, and says so', async ({
  context,
  worker,
  extUrl,
}) => {
  const { page } = await openPanel(context, extUrl('#/panel'));
  await expect(tab(page, 'Inspect')).toBeVisible();
  // The default limit is 100 000 code points; the cut keeps whole emoji.
  await worker.evaluate(
    (text) => chrome.storage.session.set({ selection: { text, sourceUrl: null } }),
    'a'.repeat(99_999) + '😀'.repeat(10),
  );
  await expect(page.getByRole('status')).toContainText('cut to its first 100000 characters');
  const value = await page.getByRole('textbox', { name: 'Text to inspect' }).inputValue();
  expect(Array.from(value)).toHaveLength(100_000);
  expect(value.endsWith('a😀')).toBe(true);
});

test('SEC-001: Recipe, Characters and the popup work offline with no outside requests', async ({
  context,
  extUrl,
}) => {
  await context.setOffline(true);
  const { page, errors, foreign } = await openPanel(context, extUrl('#/recipe'));
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('hex');
  await page.getByRole('button', { name: 'Add To Hex to the recipe' }).click();
  await page.getByRole('textbox', { name: 'Input', exact: true }).fill('Hé');
  await expect(page.getByRole('textbox', { name: 'Output', exact: true })).toHaveValue('48 c3 a9');

  await tab(page, 'Characters').click();
  await page.getByRole('searchbox').first().fill('arabic ligature sallallahou');
  await page
    .getByRole('link', { name: /FDFA ARABIC LIGATURE/ })
    .first()
    .click();
  await expect(page.getByText('ARABIC LIGATURE SALLALLAHOU ALAYHE WASALLAM').first()).toBeVisible();

  const popup = await openPanel(context, extUrl('#/popup'));
  await expect(tab(popup.page, 'Inspect')).toHaveAttribute('aria-current', 'page');
  await popup.page.getByRole('textbox', { name: 'Text to inspect' }).fill('a​b');
  await expect(popup.page.getByText('Invisible characters: 1')).toBeVisible();

  expect([...errors, ...popup.errors]).toEqual([]);
  expect([...foreign, ...popup.foreign]).toEqual([]);
});

test('FR-007: settings apply at once, persist, and refuse an out-of-range limit', async ({
  context,
  extUrl,
}) => {
  const { page } = await openPanel(context, extUrl('#/settings'));
  await page.getByLabel('Theme').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('Open on').selectOption('chars');

  const max = page.getByLabel('Longest selection (characters)');
  await max.fill('5');
  await max.blur();
  await expect(page.getByRole('alert')).toContainText('from 1000 to 1000000');

  const next = await openPanel(context, extUrl('#/panel'));
  await expect(next.page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(tab(next.page, 'Characters')).toHaveAttribute('aria-current', 'page');
});
