// SPDX-License-Identifier: GPL-3.0-or-later
/** End-to-end tests against the production build on three engines (PRD §11.1). */
import { readFileSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

const constants = JSON.parse(
  readFileSync(new URL('../../project.constants.json', import.meta.url), 'utf8'),
) as { PAGES_URL: string };

const PORT = 4917;
const CI = process.env.CI !== undefined;
const URL_BASE = `http://localhost:${PORT}${new URL(constants.PAGES_URL).pathname}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['junit', { outputFile: '../../reports/e2e.xml' }]] : 'list',
  use: { baseURL: URL_BASE, trace: 'on-first-retry' },
  // `make e2e` builds first; the tests run against what ships.
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort`,
    url: URL_BASE,
    reuseExistingServer: !CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
