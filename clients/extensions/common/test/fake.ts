// SPDX-License-Identifier: GPL-3.0-or-later
/** An in-memory stand-in for the extension namespace, recording the calls made on it. */

import type { ExtApi } from '../src/browser.js';

export interface Fake {
  readonly api: ExtApi;
  readonly calls: string[];
  readonly session: Map<string, unknown>;
  readonly sync: Map<string, unknown>;
}

function area(name: string, store: Map<string, unknown>, calls: string[]) {
  return {
    get: (key: string) => {
      calls.push(`${name}.get`);
      return Promise.resolve(store.has(key) ? { [key]: store.get(key) } : {});
    },
    set: (items: Record<string, unknown>) => {
      calls.push(`${name}.set`);
      for (const [k, v] of Object.entries(items)) store.set(k, v);
      return Promise.resolve();
    },
  };
}

export function fakeApi(
  options: { sidePanel?: boolean; sidebar?: boolean; openPopup?: 'ok' | 'fail' } = {},
): Fake {
  const calls: string[] = [];
  const session = new Map<string, unknown>();
  const sync = new Map<string, unknown>();
  const api = {
    runtime: { id: 'self', sendMessage: () => Promise.resolve() },
    contextMenus: {
      removeAll: (done: () => void) => {
        calls.push('menus.removeAll');
        done();
      },
      create: (props: { id: string }) => {
        calls.push(`menus.create:${props.id}`);
      },
    },
    storage: { session: area('session', session, calls), sync: area('sync', sync, calls) },
    action: {
      setBadgeText: ({ text }: { text: string }) => {
        calls.push(`badge:${text}`);
        return Promise.resolve();
      },
      setBadgeBackgroundColor: () => Promise.resolve(),
      ...(options.openPopup === undefined
        ? {}
        : {
            openPopup: () => {
              calls.push('openPopup');
              return options.openPopup === 'ok'
                ? Promise.resolve()
                : Promise.reject(new Error('no'));
            },
          }),
    },
    i18n: { getMessage: () => '' },
    ...(options.sidePanel === true
      ? {
          sidePanel: {
            open: ({ tabId }: { tabId: number }) => {
              calls.push(`sidePanel.open:${String(tabId)}`);
              return Promise.resolve();
            },
          },
        }
      : {}),
    ...(options.sidebar === true
      ? {
          sidebarAction: {
            open: () => {
              calls.push('sidebar.open');
              return Promise.resolve();
            },
          },
        }
      : {}),
  };
  return { api: api as unknown as ExtApi, calls, session, sync };
}

/** Lets pending promise callbacks run. */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
