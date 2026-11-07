// SPDX-License-Identifier: GPL-3.0-or-later

import { parseRecipe } from '@unichef/core';
import { describe, expect, it } from 'vitest';

import {
  moveStep,
  newStep,
  recipeDoc,
  removeStep,
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
});
