// SPDX-License-Identifier: GPL-3.0-or-later
/** App state (PRD §6.4): recipe, input, bake result, UI and settings slices. */

import type { Dish, DishType, PathItem, RunWarning } from '@unichef/core';
import { create } from 'zustand';

import type { MessageKey } from '../i18n/index.js';
import type { InputFormat } from '../lib/format.js';
import type { WorkerError } from '../worker/protocol.js';
import {
  moveStep,
  moveTo,
  newStep,
  removeStep,
  updateStep,
  type RawArg,
  type StepModel,
} from './recipe.js';

export type BakeStatus = 'idle' | 'baking' | 'done' | 'error';

/** What the inspector knows about one executed step (FR-002). */
export interface StepSnapshot {
  readonly type: DishType;
  /** Full size of the step's output, from `dishSize`. */
  readonly byteLength: number;
  /** The first 4 KiB. */
  readonly preview: Dish;
  readonly ms: number;
}

/** Snapshot key for a step path: `2`, or `2/0` inside a sub-recipe. */
export const pathKey = (path: readonly PathItem[]): string => path.join('/');

export interface Notice {
  readonly key: MessageKey;
  readonly vars?: Readonly<Record<string, string | number>>;
  readonly tone: 'info' | 'warn' | 'error';
}

interface RecipeSlice {
  steps: readonly StepModel[];
  addStep: (op: string) => void;
  removeStep: (uid: string) => void;
  moveStep: (uid: string, delta: number) => void;
  /** Drag and drop: move `uid` to the place of `over` in the same list. */
  moveTo: (uid: string, over: string) => void;
  setSteps: (steps: readonly StepModel[]) => void;
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
  /** Step outputs by `pathKey`, from the latest bake that reported any. */
  snapshots: Readonly<Record<string, StepSnapshot>>;
  /** True until the running bake reports, so old badges stay up instead of flickering. */
  snapshotsStale: boolean;
  bakeStarted: () => void;
  stepDone: (path: readonly PathItem[], snapshot: StepSnapshot) => void;
  bakeDone: (output: Dish, warnings: readonly RunWarning[], ms: number) => void;
  bakeFailed: (error: WorkerError) => void;
}

interface UiSlice {
  opQuery: string;
  setOpQuery: (query: string) => void;
  /** `pathKey` of the step shown in the inspector. */
  selected: string | null;
  select: (key: string | null) => void;
  notice: Notice | null;
  setNotice: (notice: Notice | null) => void;
  /** The first-run tour dialog (FR-015). */
  tourOpen: boolean;
  setTourOpen: (open: boolean) => void;
}

interface SettingsSlice {
  autoBake: boolean;
  setAutoBake: (on: boolean) => void;
  /** Keep keys and IVs in the URL; off by default and never remembered (SEC-007). */
  shareSecrets: boolean;
  setShareSecrets: (on: boolean) => void;
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
  moveTo: (uid, over) => {
    set((s) => ({ steps: moveTo(s.steps, uid, over) }));
  },
  setSteps: (steps) => {
    set({ steps, selected: null });
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
    set({ steps: [], selected: null });
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
  snapshots: {},
  snapshotsStale: false,
  bakeStarted: () => {
    set({ status: 'baking', snapshotsStale: true });
  },
  stepDone: (path, snapshot) => {
    set((s) => ({
      snapshots: { ...(s.snapshotsStale ? {} : s.snapshots), [pathKey(path)]: snapshot },
      snapshotsStale: false,
    }));
  },
  bakeDone: (output, warnings, ms) => {
    set((s) => ({
      status: 'done',
      output,
      warnings,
      ms,
      error: null,
      ...(s.snapshotsStale ? { snapshots: {}, snapshotsStale: false } : {}),
    }));
  },
  bakeFailed: (error) => {
    set((s) => ({
      status: 'error',
      error,
      output: null,
      warnings: [],
      ...(s.snapshotsStale ? { snapshots: {}, snapshotsStale: false } : {}),
    }));
  },

  opQuery: '',
  setOpQuery: (opQuery) => {
    set({ opQuery });
  },
  selected: null,
  select: (selected) => {
    set({ selected });
  },
  notice: null,
  setNotice: (notice) => {
    set({ notice });
  },
  tourOpen: false,
  setTourOpen: (tourOpen) => {
    set({ tourOpen });
  },

  autoBake: true,
  setAutoBake: (autoBake) => {
    set({ autoBake });
  },
  shareSecrets: false,
  setShareSecrets: (shareSecrets) => {
    set({ shareSecrets });
  },
}));
