// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { createHandlers, MENU_ID } from '../src/handlers.js';
import { SELECTION_KEY } from '../src/selection.js';
import { fakeApi, settle } from './fake.js';

const click = { menuItemId: MENU_ID, selectionText: 'a​b', pageUrl: 'https://example.org/' };

describe('onInstalled', () => {
  it('replaces the context menu', () => {
    const fake = fakeApi();
    createHandlers(fake.api).onInstalled();
    expect(fake.calls).toEqual(['menus.removeAll', `menus.create:${MENU_ID}`]);
  });
});

describe('onMenuClick (FR-007)', () => {
  it('opens the side panel before storing the selection (Chrome, Edge)', async () => {
    const fake = fakeApi({ sidePanel: true });
    createHandlers(fake.api).onMenuClick(click, { id: 7, windowId: 1 });
    expect(fake.calls[0]).toBe('sidePanel.open:7');
    await settle();
    expect(fake.calls).toEqual(['sidePanel.open:7', 'session.set']);
    expect(fake.session.get(SELECTION_KEY)).toEqual({
      text: 'a​b',
      sourceUrl: 'https://example.org/',
    });
  });

  it('opens the sidebar before storing the selection (Firefox)', () => {
    const fake = fakeApi({ sidebar: true });
    createHandlers(fake.api).onMenuClick(click, { id: 7, windowId: 1 });
    expect(fake.calls).toEqual(['sidebar.open', 'session.set']);
  });

  it('opens the popup where it can (Safari)', async () => {
    const fake = fakeApi({ openPopup: 'ok' });
    createHandlers(fake.api).onMenuClick(click, undefined);
    await settle();
    expect(fake.calls).toEqual(['session.set', 'openPopup']);
  });

  it('falls back to a badge when the popup cannot open', async () => {
    const fake = fakeApi({ openPopup: 'fail' });
    createHandlers(fake.api).onMenuClick(click, undefined);
    await settle();
    expect(fake.calls).toEqual(['session.set', 'openPopup', 'badge:1']);
  });

  it('shows a badge without openPopup', () => {
    const fake = fakeApi();
    createHandlers(fake.api).onMenuClick(click, undefined);
    expect(fake.calls).toEqual(['session.set', 'badge:1']);
  });

  it('ignores other menus and empty selections', () => {
    const fake = fakeApi({ sidePanel: true });
    const { onMenuClick } = createHandlers(fake.api);
    onMenuClick({ ...click, menuItemId: 'other' }, { id: 1, windowId: 1 });
    onMenuClick({ ...click, selectionText: '' }, { id: 1, windowId: 1 });
    expect(fake.calls).toEqual([]);
  });
});

describe('onMessage', () => {
  it('answers selection/get and clears the badge', async () => {
    const fake = fakeApi();
    fake.session.set(SELECTION_KEY, { text: 'hi', sourceUrl: null });
    const replies: unknown[] = [];
    const async = createHandlers(fake.api).onMessage(
      { type: 'selection/get' },
      { id: 'self' },
      (r) => replies.push(r),
    );
    expect(async).toBe(true);
    await settle();
    expect(replies).toEqual([{ text: 'hi' }]);
    expect(fake.calls).toContain('badge:');
  });

  it('stores selection/set', async () => {
    const fake = fakeApi();
    const replies: unknown[] = [];
    createHandlers(fake.api).onMessage(
      { type: 'selection/set', text: 'x', sourceUrl: null },
      { id: 'self' },
      (r) => replies.push(r),
    );
    await settle();
    expect(replies).toEqual([{ ok: true }]);
    expect(fake.session.get(SELECTION_KEY)).toEqual({ text: 'x', sourceUrl: null });
  });

  it('ignores other senders and malformed messages', () => {
    const fake = fakeApi();
    const { onMessage } = createHandlers(fake.api);
    const reply = (): void => {
      throw new Error('must not reply');
    };
    expect(onMessage({ type: 'selection/get' }, { id: 'other' }, reply)).toBe(false);
    expect(onMessage({ type: 'selection/get' }, {}, reply)).toBe(false);
    expect(onMessage({ type: 'nope' }, { id: 'self' }, reply)).toBe(false);
    expect(fake.calls).toEqual([]);
  });
});
