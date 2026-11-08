// SPDX-License-Identifier: GPL-3.0-or-later
/** Extension settings, kept in `storage.sync` (PRD §7.1). */

import type { ExtApi } from './browser.js';

export const THEMES = ['system', 'dark', 'light'] as const;
export const TABS = ['inspect', 'recipe', 'chars'] as const;

export type Theme = (typeof THEMES)[number];
export type Tab = (typeof TABS)[number];

export interface ExtSettings {
  readonly theme: Theme;
  /** The tab the panel and popup open on. */
  readonly defaultTab: Tab;
  /** Characters of a selection that are inspected; the rest is cut off with a notice. */
  readonly maxSelection: number;
}

/** Bounds for `maxSelection`: a selection is pasted into the input as text. */
export const MAX_SELECTION_RANGE = [1_000, 1_000_000] as const;

export const DEFAULT_SETTINGS: ExtSettings = {
  theme: 'system',
  defaultTab: 'inspect',
  maxSelection: 100_000,
};

export const SETTINGS_KEY = 'settings';

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

export function isSettings(v: unknown): v is ExtSettings {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  const max = s['maxSelection'];
  return (
    isOneOf(THEMES, s['theme']) &&
    isOneOf(TABS, s['defaultTab']) &&
    Number.isInteger(max) &&
    (max as number) >= MAX_SELECTION_RANGE[0] &&
    (max as number) <= MAX_SELECTION_RANGE[1]
  );
}

/** Stored settings over the defaults, field by field; a bad stored field is dropped. */
export function parseSettings(stored: unknown): ExtSettings {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_SETTINGS;
  const s = stored as Record<string, unknown>;
  const pick = <K extends keyof ExtSettings>(key: K): ExtSettings[K] => {
    const candidate = { ...DEFAULT_SETTINGS, [key]: s[key] };
    return isSettings(candidate) ? candidate[key] : DEFAULT_SETTINGS[key];
  };
  return {
    theme: pick('theme'),
    defaultTab: pick('defaultTab'),
    maxSelection: pick('maxSelection'),
  };
}

export async function loadSettings(api: ExtApi): Promise<ExtSettings> {
  const stored = await api.storage.sync.get(SETTINGS_KEY);
  return parseSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(api: ExtApi, settings: ExtSettings): Promise<void> {
  if (!isSettings(settings)) throw new Error('Invalid settings.');
  await api.storage.sync.set({ [SETTINGS_KEY]: settings });
}
