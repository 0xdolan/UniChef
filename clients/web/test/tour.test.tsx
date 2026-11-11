// SPDX-License-Identifier: GPL-3.0-or-later
/** The first-run tour. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { firstVisit, Tour, TOUR_KEY, TOUR_STEPS } from '../src/app/Tour.js';
import { useApp } from '../src/state/store.js';

// jsdom has no modal dialogs; open and close just toggle the attribute.
beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.open = true;
    },
    close(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.location.hash = '';
  useApp.getState().setTourOpen(false);
});

const dialog = () => screen.getByRole<HTMLDialogElement>('dialog', { hidden: true });

describe('Tour', () => {
  it('FR-015: opens once on the first workbench visit, steps through, and About reopens it', () => {
    render(<Tour />);
    expect(dialog().open).toBe(true);
    expect(localStorage.getItem(TOUR_KEY)).toBe('1');
    expect(screen.getByText(`Step 1 of ${String(TOUR_STEPS.length)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Build a recipe' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Welcome to UniChef' })).toBeTruthy();

    for (let i = 1; i < TOUR_STEPS.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByRole('link', { name: 'Read the docs' }).getAttribute('href')).toBe('#/docs');
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(dialog().open).toBe(false);
    cleanup();

    // A second visit stays closed; About's button opens it at the first step.
    render(<Tour />);
    expect(dialog().open).toBe(false);
    act(() => {
      useApp.getState().setTourOpen(true);
    });
    expect(dialog().open).toBe(true);
    expect(screen.getByText(`Step 1 of ${String(TOUR_STEPS.length)}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip the tour' }));
    expect(dialog().open).toBe(false);
  });

  it('FR-015: never opens on a shared link or when storage is blocked', () => {
    expect(firstVisit('#/?r=abc')).toBe(false);
    expect(firstVisit('#/char/U+202E')).toBe(false);
    expect(localStorage.getItem(TOUR_KEY)).toBeNull();

    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(firstVisit('#/')).toBe(false);
    blocked.mockRestore();
    expect(firstVisit('')).toBe(true);
    expect(firstVisit('')).toBe(false);
  });
});
