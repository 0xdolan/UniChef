// SPDX-License-Identifier: GPL-3.0-or-later
/** The recipe's steps, with nested step lists for flow operations. */

import { allOperations, getOperation } from '@unichef/core';
import { useId, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { newStep, type StepModel } from '../../state/recipe.js';
import { useApp } from '../../state/store.js';
import { ArgField } from '../args/ArgField.js';
import styles from './Workbench.module.css';

/** Adds an operation to a nested step list. */
function NestedAdd({ onAdd }: { readonly onAdd: (op: string) => void }): ReactNode {
  return (
    <select
      aria-label={t('recipe.nestedAdd')}
      className={styles.control}
      value=""
      onChange={(e) => {
        if (e.target.value !== '') onAdd(e.target.value);
      }}
    >
      <option value="">{t('recipe.nestedAdd')}</option>
      {allOperations().map((op) => (
        <option key={op.id} value={op.id}>
          {op.name}
        </option>
      ))}
    </select>
  );
}

function StepCard({
  step,
  index,
}: {
  readonly step: StepModel;
  readonly index: number;
}): ReactNode {
  const id = useId();
  const op = getOperation(step.op);
  const setArg = useApp((s) => s.setArg);
  const remove = useApp((s) => s.removeStep);
  const move = useApp((s) => s.moveStep);
  const toggle = useApp((s) => s.toggleDisabled);
  return (
    <li className={styles.step} data-disabled={step.disabled || undefined}>
      <div className={styles.stepHead}>
        <span className={styles.stepIndex}>{index + 1}</span>
        <span className={styles.stepName} id={`${id}-name`}>
          {op.name}
        </span>
        <span className={styles.stepActions}>
          <button
            type="button"
            className={styles.icon}
            aria-label={t('recipe.up')}
            title={t('recipe.up')}
            onClick={() => {
              move(step.uid, -1);
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={t('recipe.down')}
            title={t('recipe.down')}
            onClick={() => {
              move(step.uid, 1);
            }}
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-pressed={step.disabled}
            aria-label={step.disabled ? t('recipe.enable') : t('recipe.disable')}
            title={step.disabled ? t('recipe.enable') : t('recipe.disable')}
            onClick={() => {
              toggle(step.uid);
            }}
          >
            ⏻
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={t('recipe.remove')}
            title={t('recipe.remove')}
            onClick={() => {
              remove(step.uid);
            }}
          >
            ✕
          </button>
        </span>
      </div>
      {op.args.length > 0 && (
        <div className={styles.args} role="group" aria-labelledby={`${id}-name`}>
          {op.args.map((spec) => (
            <ArgField
              key={spec.name}
              id={`${id}-${spec.name}`}
              spec={spec}
              value={step.args[spec.name]}
              onChange={(value) => {
                setArg(step.uid, spec.name, value);
              }}
              renderSteps={(steps, onChange) => (
                <>
                  {steps.length === 0 ? (
                    <p className={styles.empty}>{t('recipe.nestedEmpty')}</p>
                  ) : (
                    <StepList steps={steps} />
                  )}
                  <NestedAdd
                    onAdd={(opId) => {
                      onChange([...steps, newStep(opId)]);
                    }}
                  />
                </>
              )}
            />
          ))}
        </div>
      )}
    </li>
  );
}

export function StepList({ steps }: { readonly steps: readonly StepModel[] }): ReactNode {
  return (
    <ol className={styles.steps}>
      {steps.map((step, i) => (
        <StepCard key={step.uid} step={step} index={i} />
      ))}
    </ol>
  );
}
