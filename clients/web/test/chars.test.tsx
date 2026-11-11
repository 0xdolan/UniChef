// SPDX-License-Identifier: GPL-3.0-or-later
/** The character pages against in-process lookups: search, detail, blocks and scripts. */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App.js';
import { parseCodePoint } from '../src/features/chars/CharPage.js';
import { EXAMPLES, SEARCH_MS } from '../src/features/chars/CharsPage.js';
import { UcdContext } from '../src/lib/ucd.js';
import { handle } from '../src/worker/ucd.js';
import { inProcessUcd, useDiskData } from './ucd-data.js';

beforeAll(() => {
  useDiskData();
  // jsdom has no layout; give the grid's scroller a size so rows render.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(760);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(420);
});
afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function open(hash: string) {
  window.location.hash = hash;
  render(
    <UcdContext.Provider value={inProcessUcd}>
      <App />
    </UcdContext.Provider>,
  );
}

const cells = async () => within(await screen.findByRole('list')).findAllByRole('listitem');

describe('character pages', () => {
  it('parses code point routes', () => {
    expect(parseCodePoint('U+0645')).toBe(0x645);
    expect(parseCodePoint('u+10ffff')).toBe(0x10ffff);
    expect(parseCodePoint('U+110000')).toBeNull();
    expect(parseCodePoint('0645')).toBeNull();
  });

  it('accepts every example query', async () => {
    for (const query of EXAMPLES) {
      const found = await handle({ kind: 'search', query });
      expect(found.total, query).toBeGreaterThan(0);
    }
  });

  it('searches from the hash and shows a described, virtualised grid', async () => {
    open('#/chars?q=gc%3DLu');
    expect(await screen.findByText(/characters · \d+ ms/)).toBeTruthy();
    const items = await cells();
    // 10 columns of 76 px; only the rows in view plus overscan are rendered.
    expect(items.length).toBeLessThan(200);
    expect(items[0]?.getAttribute('aria-posinset')).toBe('1');
    expect(Number(items[0]?.getAttribute('aria-setsize'))).toBeGreaterThan(1000);
    expect(
      await screen.findByRole('link', { name: 'U+0041 LATIN CAPITAL LETTER A' }),
    ).toHaveProperty('hash', '#/char/U+0041');
  });

  it('debounces typing into the hash and reports a bad query', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      open('#/chars');
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'gc=' } });
      expect(window.location.hash).toBe('#/chars');
      act(() => {
        vi.advanceTimersByTime(SEARCH_MS);
      });
      expect(window.location.hash).toBe('#/chars?q=gc%3D');
    } finally {
      vi.useRealTimers();
    }
    const status = document.querySelector('[data-status]');
    await vi.waitFor(() => {
      expect(status?.textContent).toMatch(/\S/);
      expect(status?.querySelector('p')?.className).toMatch(/error/);
    });
  });

  it('shows every field, the aliases and copyable escapes of a character (FR-005)', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    open('#/char/U+0645');
    expect(
      await screen.findByRole('heading', { level: 1, name: /ARABIC LETTER MEEM/ }),
    ).toBeTruthy();
    expect(screen.getByText('General category').nextSibling?.textContent).toBe('Lo');
    expect(screen.getByRole('link', { name: 'Arabic' })).toHaveProperty('hash', '#/blocks/Arabic');
    expect(screen.getByRole('link', { name: 'Arab' })).toHaveProperty('hash', '#/scripts/Arab');
    fireEvent.click(screen.getByRole('button', { name: 'Copy the html-hex escape' }));
    expect(writeText).toHaveBeenCalledWith('&#x645;');
    expect(screen.getByRole('link', { name: '← U+0644' })).toBeTruthy();
  });

  it('links straight to a character whose name matches the words', async () => {
    open('#/chars?q=arabic%20letter%20meem');
    expect(await screen.findByRole('link', { name: 'U+0645' })).toHaveProperty(
      'hash',
      '#/char/U+0645',
    );
  });

  it('says when a route is not a code point', async () => {
    open('#/char/nope');
    expect(await screen.findByText('“nope” is not a code point.')).toBeTruthy();
  });

  it('lists and filters blocks, and opens one by its loose name', async () => {
    open('#/blocks');
    expect(await screen.findByRole('link', { name: 'Basic Latin' })).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'greek-and' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    cleanup();
    open('#/blocks/basic_latin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Basic Latin' })).toBeTruthy();
    expect((await cells()).at(-1)?.getAttribute('aria-setsize')).toBe('128');
  });

  it('lists scripts and switches a script between Script and Script_Extensions', async () => {
    open('#/scripts');
    expect(await screen.findByRole('link', { name: 'Arab' })).toBeTruthy();
    cleanup();
    open('#/scripts/Arab');
    const count = async () => (await screen.findByText(/^[\d,]+ characters$/)).textContent;
    const sc = await count();
    fireEvent.click(screen.getByRole('checkbox'));
    await vi.waitFor(async () => {
      expect(await count()).not.toBe(sc);
    });
    cleanup();
    open('#/scripts/Nope');
    expect(await screen.findByText('There is no script named “Nope”.')).toBeTruthy();
  });

  it('marks the current section in the navigation', async () => {
    open('#/char/U+0041');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Characters' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await screen.findByRole('heading', { level: 1 });
  });
});
