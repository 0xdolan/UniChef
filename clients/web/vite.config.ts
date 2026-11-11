// SPDX-License-Identifier: GPL-3.0-or-later
/** Vite config for the web app (PRD §6.4). */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import { docs } from './vite.docs.js';
import { licences } from './vite.licenses.js';

const core = fileURLToPath(new URL('../../packages/npm-core/src/', import.meta.url));
const constants = JSON.parse(
  readFileSync(new URL('../../project.constants.json', import.meta.url), 'utf8'),
) as { PAGES_URL: string; REPO_URL: string };

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

// Raster icons come from `scripts/assets/build.py --only web/` (PRD §9.2), which needs
// rsvg-convert, ImageMagick and oxipng. Without them the build still works, with the SVG
// icons only; UNICHEF_REQUIRE_ICONS=1 (the Pages build) makes a missing PNG an error.
const RASTER = new URL('../../assets/branding/dist/web/', import.meta.url);
const RASTER_FILES = [
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'og-image.png',
] as const;
const missing = RASTER_FILES.filter((f) => !existsSync(new URL(f, RASTER)));
if (missing.length > 0 && process.env.UNICHEF_REQUIRE_ICONS === '1') {
  throw new Error(`assets/branding/dist/web/ lacks ${missing.join(', ')}; run make assets`);
}
const hasRaster = missing.length === 0;

/** The app icons, emitted from the branding masters rather than copied into `public/`. */
function icons(): Plugin {
  return {
    name: 'unichef-icons',
    apply: 'build',
    generateBundle() {
      for (const [fileName, master] of Object.entries(ICONS)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(master, BRANDING)) });
      }
      if (!hasRaster) return;
      for (const fileName of RASTER_FILES) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(fileName, RASTER)) });
      }
    },
    // Tags for files that exist only with the raster set: the .ico for old browsers and
    // search engines, the iOS home-screen icon, and the link-preview image.
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { property: 'og:url', content: constants.PAGES_URL } },
      ...(hasRaster
        ? [
            { tag: 'link', attrs: { rel: 'icon', href: `${BASE}favicon.ico`, sizes: '32x32' } },
            {
              tag: 'link',
              attrs: { rel: 'apple-touch-icon', href: `${BASE}apple-touch-icon.png` },
            },
            {
              tag: 'meta',
              attrs: { property: 'og:image', content: `${constants.PAGES_URL}og-image.png` },
            },
            { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
            { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
            { tag: 'meta', attrs: { property: 'og:image:alt', content: 'UniChef' } },
            { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
          ]
        : []),
    ],
  };
}

const BASE = new URL(constants.PAGES_URL).pathname;
const RASTER_ICONS = hasRaster
  ? [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
  : [];

// Offline (PRD §6.4): precache the app shell and every data file. src/main.tsx registers
// the service worker through `virtual:pwa-register` (no inline script, so the CSP holds), and
// reloads into a new release as soon as it is installed instead of serving the old copy.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: false,
  manifest: {
    id: BASE,
    name: 'UniChef',
    short_name: 'UniChef',
    description:
      'Cybersecurity and Unicode workbench: encode, decode, hash, encrypt and inspect text and data offline.',
    lang: 'en',
    dir: 'ltr',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    orientation: 'any',
    categories: ['developer', 'utilities', 'productivity'],
    background_color: '#0F1020',
    theme_color: '#1A1D27',
    icons: [
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ...RASTER_ICONS,
    ],
  },
  workbox: {
    globPatterns: ['**/*.{html,js,css,svg,gz,png,ico}'],
    // The TypeDoc pages (pages.yml writes them to api/) are a separate site, not app shell,
    // and the link-preview image is for other sites' crawlers, not for offline use.
    globIgnores: ['404.html', 'api/**', 'og-image.png'],
    // ucd-names is the largest file; the default 2 MiB cap would leave it out.
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/\/api\//],
    cleanupOutdatedCaches: true,
  },
});

const ext = new URL('../extensions/common/src/', import.meta.url);

// `vite build --mode extension` builds the extensions' panel and popup page (PRD §7.5)
// into dist-extension/: relative URLs, no service worker, and icons from the extension
// package instead of the PWA's.
export default defineConfig(({ mode }) => {
  const extension = mode === 'extension';
  return {
    base: extension ? './' : BASE,
    plugins: [
      react(),
      csp(),
      ...(extension ? [] : [icons(), pwa]),
      licences(fileURLToPath(new URL('package.json', import.meta.url))),
      docs({
        root: fileURLToPath(new URL('../../', import.meta.url)),
        repoUrl: constants.REPO_URL,
        pagesUrl: constants.PAGES_URL,
      }),
    ],
    // Build against the core's sources, so the app needs no separate core build step.
    resolve: {
      alias: [
        { find: /^@unichef\/core$/, replacement: `${core}index.ts` },
        { find: /^@unichef\/core\/(.*)$/, replacement: `${core}$1` },
        { find: /^@ext\/(.*)$/, replacement: `${fileURLToPath(ext)}$1` },
      ],
    },
    worker: { format: 'es' as const },
    build: extension
      ? {
          target: 'es2022',
          outDir: 'dist-extension',
          emptyOutDir: true,
          rolldownOptions: { input: fileURLToPath(new URL('extension.html', import.meta.url)) },
        }
      : { target: 'es2022', manifest: true, sourcemap: true },
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.{ts,tsx}'],
    },
  };
});
