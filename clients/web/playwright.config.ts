// SPDX-License-Identifier: GPL-3.0-or-later
/** End-to-end tests against the production build on three engines (PRD §11.1). */
import { readFileSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

const constants = JSON.parse(
  readFileSync(new URL('../../project.constants.json', import.meta.url), 'utf8'),
) as { PAGES_URL: string };

const PORT = 4917;
const MOBILE = /mobile\.spec\.ts$/;
const EXTENSION = /extension\.spec\.ts$/;
const CI = process.env.CI !== undefined;
const URL_BASE = `http://localhost:${PORT}${new URL(constants.PAGES_URL).pathname}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['junit', { outputFile: '../../reports/e2e.xml' }]] : 'list',
  use: {
    baseURL: URL_BASE,
    trace: 'on-first-retry',
    // The first-run tour (FR-015) counts as seen; e2e/tour.spec.ts starts from empty storage.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${PORT}`,
          localStorage: [{ name: 'unichef.tour', value: '1' }],
        },
      ],
    },
  },
  // `make e2e` builds first; the tests run against what ships.
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort`,
    url: URL_BASE,
    reuseExistingServer: !CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: [MOBILE, EXTENSION] },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: [MOBILE, EXTENSION] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: [MOBILE, EXTENSION] },
    // NFR-043: phone layouts on a touch Android and a touch iOS profile.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, testMatch: MOBILE },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] }, testMatch: MOBILE },
    // FR-007, SEC-001: the built Chrome extension (make build-ext), loaded into Chromium.
    { name: 'extension', testMatch: EXTENSION },
  ],
});
