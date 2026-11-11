// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The docs pages `vite.docs.ts` generates at build time, by route key (FR-014). Each page's
 * default export is a `DocPage` (src/features/docs/tree.ts); an ambient module cannot import
 * it by relative path, so the reader casts.
 */
declare module 'virtual:docs' {
  export const pages: Readonly<Record<string, () => Promise<{ default: unknown }>>>;
}
