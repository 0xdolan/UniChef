// SPDX-License-Identifier: GPL-3.0-or-later
/** Documentation screenshots (PRD §9.3): Chromium only, run by `make screenshots`. */
import config from './playwright.config';

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  ...config,
  testDir: 'screenshots',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
