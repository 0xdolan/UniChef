// SPDX-License-Identifier: GPL-3.0-or-later
/** App state (PRD §6.4): recipe, input, bake result, UI and settings slices. */

import type { Dish, RunWarning } from '@unichef/core';
import { create } from 'zustand';

import type { InputFormat } from '../lib/format.js';
import type { WorkerError } from '../worker/protocol.js';
import {
  moveStep,
  newStep,
  removeStep,
  updateStep,
  type RawArg,
  type StepModel,
} from './recipe.js';

export type BakeStatus = 'idle' | 'baking' | 'done' | 'error';

interface RecipeSlice {
  steps: readonly StepModel[];
  addStep: (op: string) => void;
  removeStep: (uid: string) => void;
  moveStep: (uid: string, delta: number) => void;
  setArg: (uid: string, name: string, value: RawArg) => void;
  toggleDisabled: (uid: string) => void;
  clearRecipe: () => void;
}

interface InputSlice {
  input: string;
  inputFormat: InputFormat;
  setInput: (text: string) => void;
  setInputFormat: (format: InputFormat) => void;
}

interface BakeSlice {
  status: BakeStatus;
  output: Dish | null;
  warnings: readonly RunWarning[];
  error: WorkerError | null;
  ms: number;
  bakeStarted: () => void;
  bakeDone: (output: Dish, warnings: readonly RunWarning[], ms: number) => void;
  bakeFailed: (error: WorkerError) => void;
}

interface UiSlice {
  opQuery: string;
  setOpQuery: (query: string) => void;
}

interface SettingsSlice {
  autoBake: boolean;
  setAutoBake: (on: boolean) => void;
}

export type AppState = RecipeSlice & InputSlice & BakeSlice & UiSlice & SettingsSlice;

export const useApp = create<AppState>()((set) => ({
  steps: [],
  addStep: (op) => {
    set((s) => ({ steps: [...s.steps, newStep(op)] }));
  },
  removeStep: (uid) => {
    set((s) => ({ steps: removeStep(s.steps, uid) }));
  },
  moveStep: (uid, delta) => {
    set((s) => ({ steps: moveStep(s.steps, uid, delta) }));
  },
  setArg: (uid, name, value) => {
    set((s) => ({
      steps: updateStep(s.steps, uid, (step) => ({
        ...step,
        args: { ...step.args, [name]: value },
      })),
    }));
  },
  toggleDisabled: (uid) => {
    set((s) => ({
      steps: updateStep(s.steps, uid, (step) => ({ ...step, disabled: !step.disabled })),
    }));
  },
  clearRecipe: () => {
    set({ steps: [] });
  },

  input: '',
  inputFormat: 'text',
  setInput: (input) => {
    set({ input });
  },
  setInputFormat: (inputFormat) => {
    set({ inputFormat });
  },

  status: 'idle',
  output: null,
  warnings: [],
  error: null,
  ms: 0,
  bakeStarted: () => {
    set({ status: 'baking' });
  },
  bakeDone: (output, warnings, ms) => {
    set({ status: 'done', output, warnings, ms, error: null });
  },
  bakeFailed: (error) => {
    set({ status: 'error', error, output: null, warnings: [] });
  },

  opQuery: '',
  setOpQuery: (opQuery) => {
    set({ opQuery });
  },

  autoBake: true,
  setAutoBake: (autoBake) => {
    set({ autoBake });
  },
}));
