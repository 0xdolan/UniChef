// SPDX-License-Identifier: GPL-3.0-or-later
/** Routes of the extension page (PRD §7.5): `#/panel` or `#/popup` on open, then the tabs. */

import type { Tab } from '@ext/settings.js';

import { routePath } from '../app/router.js';

export type Layout = 'panel' | 'popup';

export type ExtView =
  | { readonly view: 'start'; readonly layout: Layout }
  | { readonly view: Tab | 'settings' }
  | { readonly view: 'char'; readonly param: string }
  | { readonly view: 'unknown' };

export const tabHref = (tab: Tab | 'settings'): string => `#/${tab}`;

export function extView(hash: string): ExtView {
  const [, section = '', ...rest] = routePath(hash).split('/');
  switch (section) {
    case 'panel':
    case 'popup':
      return { view: 'start', layout: section };
    case 'inspect':
    case 'recipe':
    case 'chars':
    case 'settings':
      return { view: section };
    case 'char':
      return { view: 'char', param: rest.join('/') };
    default:
      return { view: 'unknown' };
  }
}
