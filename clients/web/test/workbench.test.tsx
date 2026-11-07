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
    expect(screen.getByRole('status').textContent).toBe('Baked in 2 ms.');
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
    expect(screen.getByRole('status').textContent).toBe('Step 3.1 failed: bad flags');
  });

  it('reports bad hex input without baking', () => {
    const { worker } = renderWorkbench();
    fireEvent.change(screen.getByRole('combobox', { name: 'Input format' }), {
      target: { value: 'hex' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Input' }), { target: { value: 'abc' } });
    settle();
    expect(worker().sent.filter((m) => m.kind === 'bake')).toEqual([]);
    expect(screen.getByRole('status').textContent).toContain('pairs of hex digits');
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
});
