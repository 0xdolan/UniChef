// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The extension API namespace (PRD §7.3). Chrome MV3, Firefox and Safari all return
 * promises, so no polyfill is needed: Firefox and Safari expose `browser`, Chrome only
 * `chrome`.
 */
/// <reference types="chrome" />

/** Firefox's sidebar (`sidebar_action`), which `@types/chrome` does not describe. */
export interface SidebarAction {
  open(): Promise<void>;
}

/** The parts of the namespace UniChef uses; Chrome-only and Firefox-only APIs are optional. */
export interface ExtApi {
  readonly runtime: Pick<typeof chrome.runtime, 'id' | 'onInstalled' | 'onMessage' | 'sendMessage'>;
  readonly contextMenus: Pick<typeof chrome.contextMenus, 'create' | 'onClicked' | 'removeAll'>;
  readonly storage: Pick<typeof chrome.storage, 'session' | 'sync' | 'onChanged'>;
  readonly action: Pick<typeof chrome.action, 'setBadgeText' | 'setBadgeBackgroundColor'> & {
    openPopup?: () => Promise<void>;
  };
  readonly i18n: Pick<typeof chrome.i18n, 'getMessage'>;
  readonly sidePanel?: Pick<typeof chrome.sidePanel, 'open'>;
  readonly sidebarAction?: SidebarAction;
}

/** The host's namespace, or `undefined` outside an extension (the web app, tests). */
export function extApi(): ExtApi | undefined {
  const g = globalThis as { browser?: ExtApi; chrome?: Partial<ExtApi> };
  if (g.browser?.runtime.id !== undefined) return g.browser;
  if (g.chrome?.runtime?.id !== undefined) return g.chrome as ExtApi;
  return undefined;
}
