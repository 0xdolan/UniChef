// SPDX-License-Identifier: GPL-3.0-or-later
/** The pending selection, kept in `storage.session` so no state lives in globals (PRD §7.4). */

import type { ExtApi } from './browser.js';

export const SELECTION_KEY = 'selection';
/** A hard cap below the session-storage quota; the panel applies the user's own limit. */
export const SELECTION_CAP = 1_000_000;

export interface StoredSelection {
  readonly text: string;
  readonly sourceUrl: string | null;
}

export function isStoredSelection(v: unknown): v is StoredSelection {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s['text'] === 'string' && (s['sourceUrl'] === null || typeof s['sourceUrl'] === 'string')
  );
}

/** `text` cut to at most `max` UTF-16 units, never between the halves of a surrogate pair. */
export function capText(text: string, max: number): string {
  if (text.length <= max) return text;
  const code = text.charCodeAt(max - 1);
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max);
}

export function storeSelection(api: ExtApi, text: string, sourceUrl: string | null): Promise<void> {
  const selection: StoredSelection = { text: capText(text, SELECTION_CAP), sourceUrl };
  return api.storage.session.set({ [SELECTION_KEY]: selection });
}

export async function readSelection(api: ExtApi): Promise<StoredSelection | null> {
  const stored = await api.storage.session.get(SELECTION_KEY);
  const value = stored[SELECTION_KEY];
  return isStoredSelection(value) ? value : null;
}
