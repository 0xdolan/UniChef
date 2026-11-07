// SPDX-License-Identifier: GPL-3.0-or-later
/** Keeps the workbench state in the URL fragment and restores it from shared links (FR-008). */

import { isUniChefError } from '@unichef/core';
import { useEffect } from 'react';

import { recipeDoc, stepsFromDoc } from '../state/recipe.js';
import { useApp } from '../state/store.js';
import { ShareError, decodeState, encodeState } from './share.js';

export const URL_WRITE_MS = 300;
/** Links with more steps open with auto-bake off, so the recipe can be reviewed (SEC-010). */
export const REVIEW_STEPS = 20;

/** Restore the state carried by `hash`, if any. */
export async function loadFromHash(hash: string): Promise<void> {
  const { setSteps, setInput, setInputFormat, setAutoBake, setNotice } = useApp.getState();
  try {
    const state = await decodeState(hash);
    if (state === null) return;
    if (state.recipe !== undefined) {
      const steps = stepsFromDoc(state.recipe);
      setSteps(steps);
      if (steps.length > REVIEW_STEPS) {
        setAutoBake(false);
        setNotice({ key: 'share.review', vars: { count: steps.length }, tone: 'warn' });
      }
    }
    if (state.input !== undefined) {
      setInput(state.input);
      setInputFormat(state.format ?? 'text');
    }
  } catch (exc) {
    if (!(exc instanceof ShareError) && !isUniChefError(exc)) throw exc;
    setNotice({ key: 'share.bad', vars: { message: exc.message }, tone: 'error' });
  }
}

/** The fragment for the current state: `#/` when there is nothing to share. */
export async function currentFragment(): Promise<string> {
  const { steps, input, inputFormat, notice, setNotice } = useApp.getState();
  if (steps.length === 0 && input === '') return '#/';
  const { fragment, inputOmitted } = await encodeState(recipeDoc(steps), input, inputFormat);
  if (inputOmitted) setNotice({ key: 'share.inputOmitted', tone: 'warn' });
  else if (notice?.key === 'share.inputOmitted') setNotice(null);
  return fragment;
}

async function writeFragment(): Promise<void> {
  const fragment = await currentFragment();
  if (fragment !== window.location.hash && !(fragment === '#/' && window.location.hash === '')) {
    // replaceState: typing must not flood the history, and it fires no hashchange.
    window.history.replaceState(null, '', fragment);
  }
}

export function useUrlState(): void {
  useEffect(() => {
    let loaded = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void loadFromHash(window.location.hash).finally(() => {
      loaded = true;
    });
    const onHash = () => {
      void loadFromHash(window.location.hash);
    };
    window.addEventListener('hashchange', onHash);
    const unsubscribe = useApp.subscribe((state, prev) => {
      if (!loaded) return;
      if (
        state.steps === prev.steps &&
        state.input === prev.input &&
        state.inputFormat === prev.inputFormat
      ) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => void writeFragment(), URL_WRITE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
}
