// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * A docs page as `vite.docs.ts` emits it (FR-014): Markdown parsed at build time into plain
 * data, so the app renders it with React elements and never with raw HTML. Links are
 * already rewritten: `#/…` stays in the app, anything else is an absolute https URL.
 */

export type Inline =
  | { readonly t: 'text'; readonly v: string }
  | { readonly t: 'code'; readonly v: string }
  | { readonly t: 'strong' | 'em' | 'del'; readonly c: readonly Inline[] }
  | { readonly t: 'link'; readonly href: string; readonly c: readonly Inline[] }
  | { readonly t: 'br' };

export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | { readonly t: 'h'; readonly level: 1 | 2 | 3 | 4 | 5 | 6; readonly c: readonly Inline[] }
  | { readonly t: 'p'; readonly c: readonly Inline[] }
  /** The text of a tight list item: inline content without a paragraph around it. */
  | { readonly t: 'text'; readonly c: readonly Inline[] }
  | {
      readonly t: 'list';
      readonly ordered: boolean;
      readonly start: number;
      readonly items: readonly (readonly Block[])[];
    }
  | { readonly t: 'pre'; readonly lang: string; readonly v: string }
  | {
      readonly t: 'table';
      readonly align: readonly Align[];
      readonly head: readonly (readonly Inline[])[];
      readonly rows: readonly (readonly (readonly Inline[])[])[];
    }
  | { readonly t: 'quote'; readonly c: readonly Block[] }
  | { readonly t: 'hr' };

export interface DocPage {
  /** The text of the first level-1 heading. */
  readonly title: string;
  readonly blocks: readonly Block[];
}
