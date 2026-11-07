// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Messages between the character pages and `ucd.worker.ts`. Lookups are read-only and
 * short, so they get their own worker instead of queueing behind bakes.
 */

import type { WorkerError } from './protocol.js';

export type UcdRequest =
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'blocks' }
  | { readonly kind: 'scripts' }
  | { readonly kind: 'script'; readonly code: string; readonly extensions: boolean }
  | { readonly kind: 'cells'; readonly codePoints: readonly number[] }
  | { readonly kind: 'char'; readonly cp: number };

/** What a grid cell shows: the printable form from `analyse-characters`, name and category. */
export interface CharCell {
  readonly cp: number;
  readonly glyph: string;
  readonly name: string;
  readonly gc: string;
}

export interface SearchResult {
  readonly codePoints: readonly number[];
  readonly total: number;
  readonly truncated: boolean;
  /** For plain words, the character whose name or alias matches them loosely (UAX44-LM2). */
  readonly exact: number | null;
}

export interface BlockInfo {
  readonly start: number;
  readonly end: number;
  readonly name: string;
  /** Code points in the block whose General_Category is not Cn. */
  readonly assigned: number;
}

export interface ScriptInfo {
  /** ISO 15924 code, e.g. `Arab`. */
  readonly code: string;
  readonly name: string;
  /** Code points with this Script value. */
  readonly count: number;
}

export interface ScriptChars {
  readonly code: string;
  readonly name: string;
  readonly codePoints: readonly number[];
}

export interface CharDetail {
  readonly cp: number;
  readonly text: string;
  /** The `analyse-characters` columns after `index`, as label and value. */
  readonly fields: readonly (readonly [string, string])[];
  readonly aliases: readonly { readonly alias: string; readonly type: string }[];
  /** Every `escape-unicode` format with this character written in it. */
  readonly escapes: readonly (readonly [string, string])[];
}

export interface UcdResults {
  readonly search: SearchResult;
  readonly blocks: readonly BlockInfo[];
  readonly scripts: readonly ScriptInfo[];
  readonly script: ScriptChars;
  readonly cells: readonly CharCell[];
  readonly char: CharDetail;
}

export type UcdResult<R extends UcdRequest> = UcdResults[R['kind']];

export interface ToUcd {
  readonly id: number;
  readonly request: UcdRequest;
}

export type FromUcd =
  | { readonly id: number; readonly ok: true; readonly result: UcdResults[keyof UcdResults] }
  | { readonly id: number; readonly ok: false; readonly error: WorkerError };
