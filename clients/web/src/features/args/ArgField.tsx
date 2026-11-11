// SPDX-License-Identifier: GPL-3.0-or-later
/** Schema-driven argument inputs: one component per `ArgSpec` kind (PRD §6.4). */

import type { ArgSpec } from '@unichef/core';
import type { ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { isSteps, type BytesArg, type RawArg, type StepModel } from '../../state/recipe.js';
import styles from './ArgField.module.css';

export interface ArgFieldProps {
  readonly spec: ArgSpec;
  readonly value: RawArg | undefined;
  readonly onChange: (value: RawArg) => void;
  /** Unique id prefix for label/control pairs. */
  readonly id: string;
  /** Renders a nested step list (the `steps` kind). */
  readonly renderSteps: (
    steps: readonly StepModel[],
    onChange: (steps: readonly StepModel[]) => void,
  ) => ReactNode;
}

/** `max-length` → `Max length`. */
export const argLabel = (name: string): string => {
  const words = name.replace(/[-_]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const asString = (value: RawArg | undefined): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const isBytes = (value: RawArg | undefined): value is BytesArg =>
  typeof value === 'object' && !Array.isArray(value);

export function ArgField({ spec, value, onChange, id, renderSteps }: ArgFieldProps): ReactNode {
  const label = argLabel(spec.name);
  switch (spec.kind) {
    case 'string':
      return (
        <div className={styles.field}>
          <label htmlFor={id}>{label}</label>
          {spec.multiline === true ? (
            <textarea
              id={id}
              className={styles.control}
              rows={3}
              value={asString(value)}
              onChange={(e) => {
                onChange(e.target.value);
              }}
            />
          ) : (
            <input
              id={id}
              className={styles.control}
              value={asString(value)}
              onChange={(e) => {
                onChange(e.target.value);
              }}
            />
          )}
        </div>
      );
    case 'regex':
      return (
        <div className={styles.field}>
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            className={`${styles.control} ${styles.mono}`}
            spellCheck={false}
            value={asString(value)}
            aria-describedby={spec.flags === '' ? undefined : `${id}-flags`}
            onChange={(e) => {
              onChange(e.target.value);
            }}
          />
          {spec.flags !== '' && (
            <span id={`${id}-flags`} className={styles.hint}>
              {t('arg.flags', { flags: spec.flags })}
            </span>
          )}
        </div>
      );
    case 'integer':
      return (
        <div className={styles.field}>
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            className={styles.control}
            type="number"
            step={1}
            min={spec.min}
            max={spec.max}
            value={asString(value)}
            onChange={(e) => {
              // Anything that is not an integer goes through as text, so the
              // worker reports it with the core's own E_ARG_INVALID message.
              const text = e.target.value;
              onChange(/^-?\d+$/.test(text) ? Number(text) : text);
            }}
          />
        </div>
      );
    case 'boolean':
      return (
        <div className={`${styles.field} ${styles.inline}`}>
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => {
              onChange(e.target.checked);
            }}
          />
          <label htmlFor={id}>{label}</label>
        </div>
      );
    case 'enum':
      return (
        <div className={styles.field}>
          <label htmlFor={id}>{label}</label>
          <select
            id={id}
            className={styles.control}
            value={asString(value)}
            onChange={(e) => {
              onChange(e.target.value);
            }}
          >
            {spec.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    case 'bytes': {
      const bytes = isBytes(value) ? value : { encoding: spec.encodings[0] ?? 'hex', value: '' };
      return (
        <div className={styles.field}>
          <label htmlFor={id}>{label}</label>
          <div className={styles.row}>
            <input
              id={id}
              className={`${styles.control} ${styles.mono}`}
              spellCheck={false}
              value={bytes.value}
              onChange={(e) => {
                onChange({ ...bytes, value: e.target.value });
              }}
            />
            <select
              aria-label={t('arg.encoding', { name: label })}
              className={styles.control}
              value={bytes.encoding}
              onChange={(e) => {
                onChange({ ...bytes, encoding: e.target.value });
              }}
            >
              {spec.encodings.map((encoding) => (
                <option key={encoding} value={encoding}>
                  {encoding}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    case 'steps':
      return (
        <fieldset className={styles.nested}>
          <legend>{label}</legend>
          {renderSteps(isSteps(value) ? value : [], onChange)}
        </fieldset>
      );
  }
}
