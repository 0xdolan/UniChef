// SPDX-License-Identifier: GPL-3.0-or-later
/** The notice after the app reloads into a new release. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VERSION } from '@unichef/core';
import { afterEach, describe, expect, it } from 'vitest';

import { SEEN_KEY, UpdateNotice } from '../src/app/UpdateNotice.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('UpdateNotice', () => {
  it('FR-012: names the new version once after an update, and stays quiet otherwise', () => {
    render(<UpdateNotice />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(localStorage.getItem(SEEN_KEY)).toBe(VERSION);
    cleanup();

    render(<UpdateNotice />);
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();

    localStorage.setItem(SEEN_KEY, '0.0.1');
    render(<UpdateNotice />);
    expect(screen.getByRole('status').textContent).toContain(`UniChef updated to v${VERSION}.`);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
