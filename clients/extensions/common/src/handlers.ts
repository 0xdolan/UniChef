// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The background script's listeners (PRD §7.4), written against an injected API so tests
 * can drive them. The background does no computation: bakes run in the page's worker.
 */

import type { ExtApi } from './browser.js';
import { isExtMessage, type ExtMessage, type ExtResponse } from './messages.js';
import { readSelection, storeSelection } from './selection.js';

export const MENU_ID = 'unichef-inspect';

type MenuInfo = Pick<chrome.contextMenus.OnClickData, 'menuItemId' | 'selectionText' | 'pageUrl'>;
type Tab = Pick<chrome.tabs.Tab, 'id' | 'windowId'> | undefined;
type Sender = Pick<chrome.runtime.MessageSender, 'id'>;

const ignore = (): void => undefined;

export function createHandlers(api: ExtApi) {
  function onInstalled(): void {
    api.contextMenus.removeAll(() => {
      api.contextMenus.create({
        id: MENU_ID,
        title: api.i18n.getMessage('menuInspect') || 'Inspect with UniChef',
        contexts: ['selection'],
      });
    });
  }

  /**
   * Opens the panel before anything is awaited, while the click still counts as a user
   * gesture; only then is the selection stored. The panel picks it up from storage.
   */
  function onMenuClick(info: MenuInfo, tab: Tab): void {
    if (info.menuItemId !== MENU_ID) return;
    const text = info.selectionText ?? '';
    if (text === '') return;
    const sourceUrl = info.pageUrl ?? null;
    if (api.sidePanel !== undefined && tab?.id !== undefined) {
      api.sidePanel.open({ tabId: tab.id }).catch(ignore);
      storeSelection(api, text, sourceUrl).catch(ignore);
      return;
    }
    if (api.sidebarAction !== undefined) {
      api.sidebarAction.open().catch(ignore);
      storeSelection(api, text, sourceUrl).catch(ignore);
      return;
    }
    // Safari: popup only. Without openPopup, a badge says a selection is waiting.
    storeSelection(api, text, sourceUrl).catch(ignore);
    const badge = (): void => {
      api.action.setBadgeBackgroundColor({ color: '#7C6CF0' }).catch(ignore);
      api.action.setBadgeText({ text: '1' }).catch(ignore);
    };
    if (api.action.openPopup === undefined) badge();
    else api.action.openPopup().catch(badge);
  }

  async function answer(msg: ExtMessage): Promise<ExtResponse<ExtMessage>> {
    switch (msg.type) {
      case 'selection/set':
        await storeSelection(api, msg.text, msg.sourceUrl);
        return { ok: true };
      case 'selection/get': {
        const selection = await readSelection(api);
        await api.action.setBadgeText({ text: '' });
        return { text: selection?.text ?? null };
      }
      case 'settings/changed':
        return { ok: true };
    }
  }

  /** Only well-formed messages from this extension are answered; the rest are ignored. */
  function onMessage(
    msg: unknown,
    sender: Sender,
    sendResponse: (response: ExtResponse<ExtMessage>) => void,
  ): boolean {
    if (sender.id !== api.runtime.id || !isExtMessage(msg)) return false;
    answer(msg).then(sendResponse, ignore);
    return true;
  }

  return { onInstalled, onMenuClick, onMessage };
}
