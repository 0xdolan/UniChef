// SPDX-License-Identifier: GPL-3.0-or-later
/** Vite config for the web app (PRD §6.4). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import { licences } from './vite.licenses.js';

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

const BRANDING = new URL('../../assets/branding/source/', import.meta.url);
const ICONS = { 'icon.svg': 'unichef-mark.svg', 'icon-maskable.svg': 'unichef-mark-maskable.svg' };

/** The app icons, emitted from the branding masters rather than copied into `public/`. */
function icons(): Plugin {
  return {
    name: 'unichef-icons',
    apply: 'build',
    generateBundle() {
      for (const [fileName, master] of Object.entries(ICONS)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(master, BRANDING)) });
      }
    },
  };
}

// Offline (PRD §6.4): precache the app shell and every data file. The service worker
// registers from a file, not an inline script, so the CSP holds.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'script',
  manifest: {
    name: 'UniChef',
    short_name: 'UniChef',
    description: 'Unicode-first data transformation recipes and character analysis.',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    background_color: '#0F1020',
    theme_color: '#0F1020',
    icons: [
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{html,js,css,svg,gz}'],
    globIgnores: ['404.html'],
    // ucd-names is the largest file; the default 2 MiB cap would leave it out.
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
});

export default defineConfig({
  base: new URL(constants.PAGES_URL).pathname,
  plugins: [
    react(),
    csp(),
    icons(),
    pwa,
    licences(fileURLToPath(new URL('package.json', import.meta.url))),
  ],
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
