// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Web performance budgets (PRD §13.1: NFR-001, NFR-003) against the production build.
 * They need the Chrome DevTools Protocol for network throttling, so they run in Chromium.
 */
import { expect, test } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'chromium', 'Throttling needs Chromium (CDP).');

/** Chrome DevTools' "Fast 4G" preset: 9 Mbit/s down, 1.5 Mbit/s up, 60 ms RTT, each with
 * DevTools' own adjustment factors (0.9 for throughput, 2.75 for latency). */
const FAST_4G = {
  offline: false,
  downloadThroughput: ((9 * 1000 * 1000) / 8) * 0.9,
  uploadThroughput: ((1.5 * 1000 * 1000) / 8) * 0.9,
  latency: 60 * 2.75,
};

test('NFR-001: first paint and interactivity on Fast 4G', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', FAST_4G);
  await page.goto('./#/', { waitUntil: 'commit' });

  // Interactive: the operation search filters the list and offers a step to add.
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('hex');
  await expect(page.getByRole('button', { name: 'Add To Hex to the recipe' })).toBeVisible();
  const interactive = await page.evaluate(() => performance.now());
  const paint = await page.evaluate(
    () => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? Infinity,
  );
  test.info().annotations.push({
    type: 'timing',
    description: `first paint ${paint.toFixed(0)} ms, interactive ${interactive.toFixed(0)} ms`,
  });
  expect(paint).toBeLessThanOrEqual(1500);
  expect(interactive).toBeLessThanOrEqual(2500);
});

test('NFR-003: analyse-characters on 100 000 code points', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('searchbox', { name: 'Search operations' }).fill('analyse');
  await page.getByRole('button', { name: 'Add Analyse Characters to the recipe' }).click();
  // Letters, Arabic, CJK, emoji, a combining mark and a format character.
  const bases = [0x41, 0x645, 0x4e2d, 0x1f600, 0x301, 0x200b];
  const sample = Array.from({ length: 100_000 }, (_, i) =>
    String.fromCodePoint((bases[i % bases.length] ?? 0x41) + (i % 20)),
  ).join('');
  const output = page.getByRole('table', { name: 'Output', exact: true });
  const input = page.getByRole('textbox', { name: 'Input', exact: true });

  await input.fill(sample);
  const started = await page.evaluate(() => performance.now());
  // The header row, then the first data row (rendered by virtualisation).
  await expect(output.getByRole('row').nth(1)).toBeVisible({ timeout: 10_000 });
  await expect(output).toHaveAttribute('aria-rowcount', '100001');
  const baked = (await page.evaluate(() => performance.now())) - started;

  await page.getByRole('button', { name: 'Inspect step 1, Analyse Characters' }).click();
  const shown = await page.evaluate(() => performance.now());
  const inspector = page.getByRole('region', { name: 'Step 1: Analyse Characters' });
  await inspector.getByRole('radio', { name: 'Table' }).check();
  await expect(inspector.getByRole('row').nth(1)).toBeVisible();
  const rows = (await page.evaluate(() => performance.now())) - shown;

  test.info().annotations.push({
    type: 'timing',
    description: `bake and output ${baked.toFixed(0)} ms, first rows ${rows.toFixed(0)} ms`,
  });
  expect(baked).toBeLessThanOrEqual(1500);
  expect(rows).toBeLessThanOrEqual(300);
});
