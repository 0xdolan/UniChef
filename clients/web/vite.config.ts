// SPDX-License-Identifier: GPL-3.0-or-later
/** Vite config for the web app (PRD §6.4). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const core = fileURLToPath(new URL('../../packages/npm-core/src/', import.meta.url));
const constants = JSON.parse(
  readFileSync(new URL('../../project.constants.json', import.meta.url), 'utf8'),
) as { PAGES_URL: string };

// GitHub Pages cannot send headers, so the policy is a meta tag. Dev mode injects
// <style> elements for hot reload, so the tag is added to production builds only.
const CSP =
  "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; " +
  "img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; " +
  "form-action 'none'";

function csp(): Plugin {
  return {
    name: 'unichef-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  base: new URL(constants.PAGES_URL).pathname,
  plugins: [react(), csp()],
  // Build against the core's sources, so the app needs no separate core build step.
  resolve: {
    alias: [
      { find: /^@unichef\/core$/, replacement: `${core}index.ts` },
      { find: /^@unichef\/core\/(.*)$/, replacement: `${core}$1` },
    ],
  },
  worker: { format: 'es' },
  build: { target: 'es2022', manifest: true, sourcemap: true },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
