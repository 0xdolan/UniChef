// SPDX-License-Identifier: GPL-3.0-or-later
/** Messages between the extension pages and the background script (PRD §7.3). */

import type { ExtApi } from './browser.js';
import { isSettings, type ExtSettings } from './settings.js';

export type ExtMessage =
  | { type: 'selection/set'; text: string; sourceUrl: string | null }
  | { type: 'selection/get' }
  | { type: 'settings/changed'; settings: ExtSettings };

export type ExtResponse<M extends ExtMessage> = M extends { type: 'selection/get' }
  ? { text: string | null }
  : { ok: true };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** True when `v` is a well-formed message; anything else is ignored by the receiver. */
export function isExtMessage(v: unknown): v is ExtMessage {
  if (!isRecord(v)) return false;
  switch (v['type']) {
    case 'selection/set':
      return (
        typeof v['text'] === 'string' &&
        (v['sourceUrl'] === null || typeof v['sourceUrl'] === 'string')
      );
    case 'selection/get':
      return true;
    case 'settings/changed':
      return isSettings(v['settings']);
    default:
      return false;
  }
}

/** Sends `msg` to the background script. */
export function send<M extends ExtMessage>(api: ExtApi, msg: M): Promise<ExtResponse<M>> {
  return api.runtime.sendMessage(msg);
}
