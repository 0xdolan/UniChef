// SPDX-License-Identifier: GPL-3.0-or-later
/** URL state (FR-008): the fragment codec and loading shared links (SEC-010). */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_FRAGMENT,
  ShareError,
  decodeState,
  encodeState,
  toBase64Url,
} from '../src/lib/share.js';
import { REVIEW_STEPS, currentFragment, loadFromHash } from '../src/lib/url-state.js';
import { newStep, recipeDoc } from '../src/state/recipe.js';
import { useApp } from '../src/state/store.js';

const initial = useApp.getState();
beforeEach(() => {
  useApp.setState(initial, true);
});

const recipe = recipeDoc([newStep('to-hex'), newStep('reverse')]);

/** Random-looking text that deflate cannot shrink much. */
function noise(length: number): string {
  let seed = 2463534242;
  return Array.from({ length }, () => {
    // xorshift32
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return String.fromCharCode(0x21 + ((seed >>> 0) % 90));
  }).join('');
}

describe('share codec', () => {
  it('round-trips the recipe, input and format', async () => {
    const { fragment, inputOmitted } = await encodeState(recipe, 'héllo 👋', 'base64');
    expect(inputOmitted).toBe(false);
    expect(fragment).toMatch(/^#\/\?r=[\w-]+&i=[\w-]+&f=base64$/);
    expect(await decodeState(fragment)).toEqual({ recipe, input: 'héllo 👋', format: 'base64' });
  });

  it('leaves out the text format and an empty input', async () => {
    const withInput = await encodeState(recipe, 'x', 'text');
    expect(withInput.fragment).not.toContain('f=');
    expect((await encodeState(recipe, '', 'hex')).fragment).toMatch(/^#\/\?r=[\w-]+$/);
  });

  it(`drops the input when the fragment would exceed ${MAX_FRAGMENT} bytes`, async () => {
    const { fragment, inputOmitted } = await encodeState(recipe, noise(40_000), 'text');
    expect(inputOmitted).toBe(true);
    expect(await decodeState(fragment)).toEqual({ recipe });
  });

  it('returns null for fragments without state', async () => {
    expect(await decodeState('')).toBeNull();
    expect(await decodeState('#/')).toBeNull();
    expect(await decodeState('#/chars?q=a')).toBeNull();
  });

  it('throws ShareError for damaged links and unknown formats', async () => {
    await expect(decodeState('#/?r=***')).rejects.toBeInstanceOf(ShareError);
    await expect(decodeState('#/?r=AAAA')).rejects.toBeInstanceOf(ShareError);
    const bytes = new TextEncoder().encode('not deflate');
    await expect(decodeState(`#/?r=${toBase64Url(bytes)}`)).rejects.toBeInstanceOf(ShareError);
    const { fragment } = await encodeState(recipe, 'x', 'text');
    await expect(decodeState(`${fragment}&f=ebcdic`)).rejects.toThrow(/Unknown input format/);
  });
});

describe('shared links', () => {
  it('restores the recipe, input and format', async () => {
    const { fragment } = await encodeState(recipe, '00ff', 'hex');
    await loadFromHash(fragment);
    const s = useApp.getState();
    expect(recipeDoc(s.steps)).toEqual(recipe);
    expect([s.input, s.inputFormat, s.autoBake, s.notice]).toEqual(['00ff', 'hex', true, null]);
  });

  it(`turns auto-bake off for more than ${REVIEW_STEPS} steps (SEC-010)`, async () => {
    const big = recipeDoc(Array.from({ length: REVIEW_STEPS + 1 }, () => newStep('reverse')));
    await loadFromHash((await encodeState(big, '', 'text')).fragment);
    const s = useApp.getState();
    expect(s.steps).toHaveLength(REVIEW_STEPS + 1);
    expect(s.autoBake).toBe(false);
    expect(s.notice).toMatchObject({ key: 'share.review', tone: 'warn' });
  });

  it('keeps the current state and shows a notice for a bad link', async () => {
    useApp.getState().addStep('reverse');
    const { fragment } = await encodeState({ version: 1, steps: [{ op: 'nope' }] }, '', 'text');
    await loadFromHash(fragment);
    const s = useApp.getState();
    expect(s.steps.map((st) => st.op)).toEqual(['reverse']);
    expect(s.notice).toMatchObject({ key: 'share.bad', tone: 'error' });
  });

  it('builds the current fragment and warns when the input is left out', async () => {
    expect(await currentFragment()).toBe('#/');
    useApp.getState().addStep('reverse');
    useApp.getState().setInput(noise(40_000));
    expect(await currentFragment()).toMatch(/^#\/\?r=[\w-]+$/);
    expect(useApp.getState().notice?.key).toBe('share.inputOmitted');
    useApp.getState().setInput('short');
    expect(await currentFragment()).toContain('&i=');
    expect(useApp.getState().notice).toBeNull();
  });
});
