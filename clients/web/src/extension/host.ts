// SPDX-License-Identifier: GPL-3.0-or-later
/** The extension page's view of the browser: the pending selection and the settings. */

import { extApi, type ExtApi } from '@ext/browser.js';
import { send } from '@ext/messages.js';
import { SELECTION_KEY, isStoredSelection } from '@ext/selection.js';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  parseSettings,
  type ExtSettings,
} from '@ext/settings.js';
import { useEffect, useState } from 'react';

export const api: ExtApi | undefined = extApi();

/**
 * The latest selection sent from a page: asked for once on load, then followed through
 * `storage.onChanged`, since the panel may open before the selection is stored.
 */
export function useSelection(host: ExtApi | undefined = api): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (host === undefined) return;
    let live = true;
    send(host, { type: 'selection/get' }).then(
      (response) => {
        if (live && response.text !== null) setText(response.text);
      },
      () => undefined,
    );
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const value: unknown = changes[SELECTION_KEY]?.newValue;
      if (area === 'session' && isStoredSelection(value)) setText(value.text);
    };
    host.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      host.storage.onChanged.removeListener(onChanged);
    };
  }, [host]);
  return text;
}

/** The stored settings, live; `null` until they are read. */
export function useSettings(host: ExtApi | undefined = api): ExtSettings | null {
  const [settings, setSettings] = useState<ExtSettings | null>(
    host === undefined ? DEFAULT_SETTINGS : null,
  );
  useEffect(() => {
    if (host === undefined) return;
    let live = true;
    loadSettings(host).then(
      (s) => {
        if (live) setSettings(s);
      },
      () => {
        if (live) setSettings(DEFAULT_SETTINGS);
      },
    );
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const change = changes[SETTINGS_KEY];
      if (area === 'sync' && change !== undefined) setSettings(parseSettings(change.newValue));
    };
    host.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      host.storage.onChanged.removeListener(onChanged);
    };
  }, [host]);
  return settings;
}
