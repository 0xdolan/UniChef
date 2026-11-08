// SPDX-License-Identifier: GPL-3.0-or-later
/** The workbench end to end against a fake worker: add steps, edit args, auto-bake. */

import { makeDish } from '@unichef/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Workbench } from '../src/features/workbench/Workbench.js';
import { AUTO_BAKE_MS } from '../src/lib/baker.js';
import { useApp } from '../src/state/store.js';
import { fakeWorkers } from './fake-worker.js';

const initial = useApp.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useApp.setState(initial, true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderWorkbench() {
  const workers = fakeWorkers();
  render(<Workbench createWorker={workers.create} />);
  const worker = () => {
    const last = workers.all.at(-1);
    if (last === undefined) throw new Error('no worker');
    return last;
  };
  return { worker };
}

/** The bake status line; dnd-kit adds its own `status` live region for announcements. */
const bakeStatus = () => document.querySelector('[data-status]')?.textContent;

const settle = () => {
  act(() => {
    vi.advanceTimersByTime(AUTO_BAKE_MS);
  });
};

describe('Workbench', () => {
  it('renders a form for each argument kind of an added step', () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Add To Base64 to the recipe' }));
    expect(screen.getByLabelText('Alphabet')).toHaveProperty('tagName', 'SELECT');
    expect(screen.getByLabelText('Custom')).toHaveProperty('tagName', 'INPUT');
    expect(screen.getByLabelText('Padding')).toHaveProperty('checked', true);
  });

  it('auto-bakes the recipe and input after the debounce and shows the output', () => {
    const { worker } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Add To Hex to the recipe' }));
    fireEvent.change(screen.getByLabelText('Case'), { target: { value: 'upper' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Input' }), { target: { value: 'hi' } });
    expect(worker().sent).toEqual([]);
    settle();
    const bake = worker().lastBake();
    expect(bake.recipe).toEqual({
      version: 1,
      steps: [{ op: 'to-hex', args: { delimiter: 'space', case: 'upper' } }],
    });
    expect(bake.input).toEqual(makeDish('string', 'hi'));
    act(() => {
      worker().emit({
        kind: 'done',
        id: bake.id,
        output: makeDish('string', '68 69'),
        warnings: [],
        ms: 2,
      });
    });
    expect(screen.getByRole('textbox', { name: 'Output' })).toHaveProperty('value', '68 69');
    expect(bakeStatus()).toBe('Baked in 2 ms.');
  });

  it('reports the failing step from a worker error', () => {
    const { worker } = renderWorkbench();
    settle();
    act(() => {
      worker().emit({
        kind: 'error',
        id: worker().lastBake().id,
        error: { code: 'E_ARG_INVALID', message: 'bad flags', path: [2, 0] },
      });
    });
    expect(bakeStatus()).toBe('Step 3.1 failed: bad flags');
  });

  it('reports bad hex input without baking', () => {
    const { worker } = renderWorkbench();
    fireEvent.change(screen.getByRole('combobox', { name: 'Input format' }), {
      target: { value: 'hex' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Input' }), { target: { value: 'abc' } });
    settle();
    expect(worker().sent.filter((m) => m.kind === 'bake')).toEqual([]);
    expect(bakeStatus()).toContain('pairs of hex digits');
  });

  it('adds steps inside a nested step list', () => {
    renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Add Fork to the recipe' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Add a step' }), {
      target: { value: 'reverse' },
    });
    expect(screen.getByLabelText('Unit')).toBeDefined();
    const [fork] = useApp.getState().steps;
    expect(fork?.args.steps).toMatchObject([{ op: 'reverse' }]);
  });

  it('shows step badges and the selected step in the inspector', () => {
    const { worker } = renderWorkbench();
    fireEvent.click(screen.getByRole('button', { name: 'Add To Hex to the recipe' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Input' }), { target: { value: 'hi' } });
    settle();
    const { id } = worker().lastBake();
    const preview = makeDish('string', '68 69');
    act(() => {
      worker().emit({
        kind: 'step',
        id,
        path: [0],
        type: 'string',
        byteLength: 9000,
        preview,
        ms: 3.4,
      });
    });
    expect(screen.getByText('string · 9000 ch · 3 ms')).toBeDefined();
    expect(screen.getByText('Select a step to see its output.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect step 1, To Hex' }));
    expect(screen.getByRole('heading', { name: 'Step 1: To Hex' })).toBeDefined();
    expect(screen.getByText('68 69')).toBeDefined();
    expect(screen.getByText('Showing the first 5 ch of 9000 ch.')).toBeDefined();

    fireEvent.click(screen.getByRole('radio', { name: 'Hex' }));
    expect(screen.getByText(/^00000000 36 38 20 36 39 \|68 69\|$/)).toBeDefined();

    fireEvent.click(screen.getByRole('radio', { name: 'Text' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Compare with the step input' }));
    expect(screen.getByRole('heading', { name: 'Input', level: 3 })).toBeDefined();
    expect(screen.getByText('hi', { selector: 'pre' })).toBeDefined();
  });

  it('outlines the failing step and marks later steps as not run', () => {
    const { worker } = renderWorkbench();
    for (const name of ['To Hex', 'Reverse', 'Normalize']) {
      fireEvent.click(screen.getByRole('button', { name: `Add ${name} to the recipe` }));
    }
    settle();
    act(() => {
      worker().emit({
        kind: 'error',
        id: worker().lastBake().id,
        error: { code: 'E_ARG_INVALID', message: 'bad unit', path: [1] },
      });
    });
    const cards = document.querySelectorAll('ol > li');
    expect(
      [...cards].map((li) => [li.hasAttribute('data-failed'), li.hasAttribute('data-skipped')]),
    ).toEqual([
      [false, false],
      [true, false],
      [false, true],
    ]);
    expect(screen.getByText('bad unit')).toBeDefined();
    expect(screen.getByText('Not run: an earlier step failed.')).toBeDefined();
  });

  it('shows a table output as virtualised rows and copies it as TSV (NFR-003)', async () => {
    renderWorkbench();
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const rows = Array.from({ length: 5000 }, (_, i) => [i, `U+${i.toString(16)}`]);
    act(() => {
      useApp.setState({ output: makeDish('table', { columns: ['index', 'cp'], rows }) });
    });
    const table = screen.getByRole('table', { name: 'Output' });
    expect(table.getAttribute('aria-rowcount')).toBe('5001');
    const shown = table.querySelectorAll('tr[aria-rowindex]');
    expect(shown.length).toBeGreaterThan(1);
    expect(shown.length).toBeLessThan(100);
    expect(shown[1]?.textContent).toBe('0U+0');
    expect(screen.queryByRole('textbox', { name: 'Output' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy output' }));
    await act(() => Promise.resolve());
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^index\tcp\n0\tU\+0\n/));
  });

  it('shows a dismissible notice', () => {
    renderWorkbench();
    act(() => {
      useApp.getState().setNotice({ key: 'share.review', vars: { count: 25 }, tone: 'warn' });
    });
    expect(screen.getByRole('alert').textContent).toContain('This link holds 25 steps');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('share options (SEC-007)', () => {
  it('offers to include keys and IVs only once the recipe has one', () => {
    renderWorkbench();
    const option = () =>
      screen.queryByRole('checkbox', { name: 'Include keys and IVs in the link' });
    act(() => {
      useApp.getState().addStep('hmac');
    });
    expect(option()).toBeNull();
    act(() => {
      const [step] = useApp.getState().steps;
      if (step === undefined) throw new Error('no step');
      useApp
        .getState()
        .setSteps([{ ...step, args: { ...step.args, key: { encoding: 'utf8', value: 'k' } } }]);
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include keys and IVs in the link' }));
    expect(useApp.getState().shareSecrets).toBe(true);
  });
});

describe('CyberChef import (FR-009)', () => {
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

  const paste = (text: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.change(
      screen.getByLabelText('Paste a CyberChef recipe, as JSON or in chef format.'),
      {
        target: { value: text },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import recipe', hidden: true }));
  };

  it('replaces the recipe with the imported steps', () => {
    renderWorkbench();
    paste("To_Hex('Space',0)\nReverse('Character')");
    expect(useApp.getState().steps.map((s) => s.op)).toEqual(['to-hex', 'reverse']);
    expect(screen.getByText('Imported the CyberChef recipe (2 steps).')).toBeDefined();
    expect(document.querySelector('dialog')?.open).toBe(false);
  });

  it('names the operations it cannot map and keeps the recipe', () => {
    renderWorkbench();
    paste('[{"op":"Magic","args":[]}]');
    const field = screen.getByLabelText('Paste a CyberChef recipe, as JSON or in chef format.');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert', { hidden: true }).textContent).toContain('Magic');
    expect(useApp.getState().steps).toEqual([]);
    expect(document.querySelector('dialog')?.open).toBe(true);
  });
});
