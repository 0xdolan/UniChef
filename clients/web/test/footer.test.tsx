// SPDX-License-Identifier: GPL-3.0-or-later
/** The credit line under every page. */

import { cleanup, render, screen, within } from '@testing-library/react';
import { VERSION } from '@unichef/core';
import { afterEach, describe, expect, it } from 'vitest';

import constants from '../../../project.constants.json';
import { Footer } from '../src/app/Footer.js';

afterEach(cleanup);

describe('Footer', () => {
  it('FR-011: credits the author and links source, docs, site and the version', () => {
    render(<Footer />);
    const nav = within(screen.getByRole('navigation', { name: 'Site links' }));
    expect(screen.getByRole('contentinfo').textContent).toBe(
      `Made with  by 0xdolan·Source·Docs·Site·v${VERSION}`,
    );
    expect(nav.getByRole('img', { name: 'love' })).toBeTruthy();
    const href = (name: string) => nav.getByRole('link', { name }).getAttribute('href');
    expect(href('0xdolan')).toBe('https://github.com/0xdolan');
    expect(href('Source')).toBe(constants.REPO_URL);
    expect(href('Docs')).toBe('#/docs');
    expect(href('Site')).toBe(constants.PAGES_URL);
    expect(href(`v${VERSION}`)).toBe(`${constants.REPO_URL}/releases/tag/v${VERSION}`);
  });
});
