// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The extension tour (PRD §9.3, §9.5): the side panel at 400×720, 1x and 2x, light and dark,
 * from the built Chrome extension (`make build-ext`). The browser's own context menu cannot
 * be captured, so the tour starts with the panel after "Inspect with UniChef".
 */
import { fileURLToPath } from 'node:url';

import { chromium, expect, test, type Page, type Worker } from '@playwright/test';

import { SCALES, shotPath, THEMES } from './paths';

const EXT_DIR = fileURLToPath(new URL('../../extensions/common/dist/chrome', import.meta.url));

/** name -> drive the panel into the state to capture */
const SHOTS: Record<string, (page: Page, worker: Worker) => Promise<void>> = {
  async panel(page, worker) {
    await worker.evaluate(
      (text) => chrome.storage.session.set({ selection: { text, sourceUrl: null } }),
      'Pay\u202Egnp.exe\u202C now\u200B — café',
    );
    await expect(page.getByText(/^Invisible characters: [1-9]/)).toBeVisible();
  },
  async recipe(page) {
    await page
      .getByRole('navigation', { name: 'Panel sections' })
      .getByRole('link', { name: 'Recipe' })
      .click();
    await page.getByRole('searchbox', { name: 'Search operations' }).fill('hex');
    await page.getByRole('button', { name: 'Add To Hex to the recipe' }).click();
    await page.getByRole('searchbox', { name: 'Search operations' }).fill('');
    await page.getByRole('textbox', { name: 'Input', exact: true }).fill('café ✓');
    await expect(page.getByRole('textbox', { name: 'Output', exact: true })).toHaveValue(
      '63 61 66 c3 a9 20 e2 9c 93',
    );
  },
};

for (const theme of THEMES) {
  for (const scale of SCALES) {
    test.describe(`extension ${theme} ${String(scale)}x`, () => {
      for (const [name, drive] of Object.entries(SHOTS)) {
        test(name, async () => {
          const context = await chromium.launchPersistentContext('', {
            channel: 'chromium',
            args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
            colorScheme: theme,
            deviceScaleFactor: scale,
            viewport: { width: 400, height: 720 },
          });
          try {
            const worker =
              context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
            const page = await context.newPage();
            await page.goto(
              `chrome-extension://${new URL(worker.url()).host}/extension.html#/panel`,
            );
            await drive(page, worker);
            await page.screenshot({
              path: shotPath('extension', theme, scale, name),
              animations: 'disabled',
            });
          } finally {
            await context.close();
          }
        });
      }
    });
  }
}
