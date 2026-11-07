// SPDX-License-Identifier: GPL-3.0-or-later

import { isUniChefError, parseRecipe } from '@unichef/core';
import { describe, expect, it } from 'vitest';

import {
  moveStep,
  moveTo,
  newStep,
  recipeDoc,
  removeStep,
  stepsFromDoc,
  updateStep,
  type StepModel,
} from '../src/state/recipe.js';

function nested(): { outer: StepModel; inner: StepModel; steps: readonly StepModel[] } {
  const inner = newStep('reverse');
  const outer = { ...newStep('fork'), args: { ...newStep('fork').args, steps: [inner] } };
  return { outer, inner, steps: [newStep('to-hex'), outer] };
}

describe('recipe model', () => {
  it('fills every argument with its default', () => {
    expect(newStep('to-base64').args).toEqual({
      alphabet: 'standard',
      custom: '',
      padding: true,
    });
  });

  it('produces a document parseRecipe accepts, nested steps included', () => {
    const { steps, outer } = nested();
    const disabled = updateStep(steps, outer.uid, (s) => ({ ...s, disabled: true }));
    const recipe = parseRecipe(recipeDoc(disabled));
    expect(recipe.steps.map((s) => s.op)).toEqual(['to-hex', 'fork']);
    expect(recipe.steps[1]?.disabled).toBe(true);
    expect(recipe.steps[1]?.args.get('steps')).toHaveLength(1);
  });

  it('updates and removes steps at any depth, keeping untouched steps', () => {
    const { steps, inner } = nested();
    const updated = updateStep(steps, inner.uid, (s) => ({ ...s, args: { unit: 'bytes' } }));
    expect(updated[0]).toBe(steps[0]);
    expect(recipeDoc(updated).steps).toMatchObject([
      {},
      { args: { steps: [{ args: { unit: 'bytes' } }] } },
    ]);
    expect(recipeDoc(removeStep(steps, inner.uid)).steps).toMatchObject([
      {},
      { args: { steps: [] } },
    ]);
  });

  it('moves a step within its list and ignores moves past the ends', () => {
    const { steps, outer } = nested();
    expect(moveStep(steps, outer.uid, -1).map((s) => s.op)).toEqual(['fork', 'to-hex']);
    expect(moveStep(steps, outer.uid, 1)).toBe(steps);
  });

  it('returns the same list when the uid is unknown', () => {
    const { steps } = nested();
    expect(removeStep(steps, 'nope')).toBe(steps);
  });

  it('moves a step to the place of a drop target in the same list', () => {
    const steps = [newStep('to-hex'), newStep('reverse'), newStep('normalize')];
    const [a, b, c] = steps.map((s) => s.uid) as [string, string, string];
    expect(moveTo(steps, a, c).map((s) => s.uid)).toEqual([b, c, a]);
    expect(moveTo(steps, c, a).map((s) => s.uid)).toEqual([c, a, b]);
    expect(moveTo(steps, a, 'elsewhere')).toBe(steps);
  });

  it('rebuilds editable steps from a document, nested steps included', () => {
    const { steps } = nested();
    const doc = recipeDoc(updateStep(steps, steps[0]?.uid ?? '', (s) => ({ ...s, label: 'go' })));
    const back = stepsFromDoc(doc);
    expect(recipeDoc(back)).toEqual(doc);
    expect(back[0]?.uid).not.toBe(steps[0]?.uid);
  });

  it('rejects an invalid document with a UniChefError', () => {
    expect(() => stepsFromDoc({ version: 1, steps: [{ op: 'no-such-op' }] })).toThrow(
      expect.objectContaining({ code: 'E_OP_UNKNOWN' }),
    );
    let caught: unknown;
    try {
      stepsFromDoc({ version: 1, steps: 'nope' });
    } catch (exc) {
      caught = exc;
    }
    expect(isUniChefError(caught)).toBe(true);
  });
});
