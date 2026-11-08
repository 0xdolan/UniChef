// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { capSelection } from '../src/extension/ExtensionApp.js';
import { extView } from '../src/extension/route.js';

describe('extView', () => {
  it.each([
    ['#/panel', { view: 'start', layout: 'panel' }],
    ['#/popup', { view: 'start', layout: 'popup' }],
    ['#/inspect', { view: 'inspect' }],
    ['#/recipe', { view: 'recipe' }],
    ['#/chars?q=dash', { view: 'chars' }],
    ['#/char/U+200B', { view: 'char', param: 'U+200B' }],
    ['#/settings', { view: 'settings' }],
    ['', { view: 'unknown' }],
    ['#/blocks', { view: 'unknown' }],
  ])('%s', (hash, view) => {
    expect(extView(hash)).toEqual(view);
  });
});

describe('capSelection', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(capSelection('😀😀😀', 2)).toEqual({ text: '😀😀', cut: true });
    expect(capSelection('abc', 3)).toEqual({ text: 'abc', cut: false });
  });
});
