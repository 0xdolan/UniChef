// SPDX-License-Identifier: GPL-3.0-or-later
/** The background service worker (Chrome, Edge, Safari) or event page (Firefox). */

import { extApi } from './browser.js';
import { createHandlers } from './handlers.js';

const api = extApi();
if (api === undefined) throw new Error('UniChef: no extension API in the background context.');
const { onInstalled, onMenuClick, onMessage } = createHandlers(api);

// Registered synchronously at the top level, so a restarted worker hears the event that
// woke it (PRD §7.4).
api.runtime.onInstalled.addListener(onInstalled);
api.contextMenus.onClicked.addListener(onMenuClick);
api.runtime.onMessage.addListener(onMessage);
