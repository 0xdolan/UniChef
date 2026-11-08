// SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { isExtMessage } from '../src/messages.js';
import { capText, readSelection, SELECTION_KEY } from '../src/selection.js';
import {
  DEFAULT_SETTINGS,
  isSettings,
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_KEY,
} from '../src/settings.js';
import { fakeApi } from './fake.js';

describe('isExtMessage', () => {
  it.each([
    [{ type: 'selection/get' }, true],
    [{ type: 'selection/set', text: 'a', sourceUrl: null }, true],
    [{ type: 'selection/set', text: 'a', sourceUrl: 'https://x/' }, true],
    [{ type: 'settings/changed', settings: DEFAULT_SETTINGS }, true],
    [{ type: 'selection/set', text: 1, sourceUrl: null }, false],
    [{ type: 'selection/set', text: 'a' }, false],
    [{ type: 'settings/changed', settings: { ...DEFAULT_SETTINGS, theme: 'neon' } }, false],
    [{ type: 'other' }, false],
    [['selection/get'], false],
    [null, false],
    ['selection/get', false],
  ])('%j → %s', (msg, ok) => {
    expect(isExtMessage(msg)).toBe(ok);
  });
});

describe('settings', () => {
  it('keeps good fields and drops bad ones', () => {
    expect(parseSettings({ theme: 'light', defaultTab: 'nope', maxSelection: 5000 })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      maxSelection: 5000,
    });
    expect(parseSettings({ maxSelection: 10 })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ maxSelection: 1500.5 })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through storage.sync and refuses bad values', async () => {
    const fake = fakeApi();
    expect(await loadSettings(fake.api)).toEqual(DEFAULT_SETTINGS);
    const next = { theme: 'dark', defaultTab: 'chars', maxSelection: 2000 } as const;
    await saveSettings(fake.api, next);
    expect(fake.sync.get(SETTINGS_KEY)).toEqual(next);
    expect(await loadSettings(fake.api)).toEqual(next);
    await expect(saveSettings(fake.api, { ...next, maxSelection: 2_000_000 })).rejects.toThrow();
    expect(isSettings(fake.sync.get(SETTINGS_KEY))).toBe(true);
  });
});

describe('selection', () => {
  it('never cuts a surrogate pair', () => {
    expect(capText('ab😀', 3)).toBe('ab');
    expect(capText('ab😀', 4)).toBe('ab😀');
    expect(capText('abc', 2)).toBe('ab');
  });

  it('reads only well-formed stored selections', async () => {
    const fake = fakeApi();
    expect(await readSelection(fake.api)).toBeNull();
    fake.session.set(SELECTION_KEY, { text: 5 });
    expect(await readSelection(fake.api)).toBeNull();
    fake.session.set(SELECTION_KEY, { text: 't', sourceUrl: null });
    expect(await readSelection(fake.api)).toEqual({ text: 't', sourceUrl: null });
  });
});
