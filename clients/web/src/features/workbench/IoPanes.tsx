// SPDX-License-Identifier: GPL-3.0-or-later
/** Input and output panes, and the bake status line (an ARIA live region). */

import { dishSize, type PathItem } from '@unichef/core';
import { useMemo, useState, type ReactNode } from 'react';

import { t, type MessageKey } from '../../i18n/index.js';
import { INPUT_FORMATS, dishText, sizeLabel, type InputFormat } from '../../lib/format.js';
import { useApp } from '../../state/store.js';
import { OutputTable } from './OutputTable.js';
import styles from './Workbench.module.css';

/** A step path as shown to people: 1-based, dotted (`3.1`). */
export const stepLabel = (path: readonly PathItem[]): string =>
  path.map((p) => (typeof p === 'number' ? String(p + 1) : p)).join('.');

export function InputPane(): ReactNode {
  const input = useApp((s) => s.input);
  const format = useApp((s) => s.inputFormat);
  const setInput = useApp((s) => s.setInput);
  const setFormat = useApp((s) => s.setInputFormat);
  return (
    <section className={styles.pane} aria-labelledby="input-title">
      <div className={styles.paneHead}>
        <h2 id="input-title" className={styles.paneTitle}>
          {t('input.title')}
        </h2>
        <select
          aria-label={t('input.format')}
          className={styles.control}
          value={format}
          onChange={(e) => {
            setFormat(e.target.value as InputFormat);
          }}
        >
          {INPUT_FORMATS.map((f) => (
            <option key={f} value={f}>
              {t(`input.format.${f}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        aria-labelledby="input-title"
        className={styles.text}
        spellCheck={false}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
        }}
      />
    </section>
  );
}

function BakeStatus(): ReactNode {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const ms = useApp((s) => s.ms);
  const warnings = useApp((s) => s.warnings);
  let text: string;
  switch (status) {
    case 'idle':
      text = t('bake.idle');
      break;
    case 'baking':
      text = t('bake.baking');
      break;
    case 'done':
      text = t('bake.done', { ms: Math.round(ms) });
      if (warnings.length > 0) text += ` ${t('bake.warnings', { count: warnings.length })}`;
      break;
    case 'error':
      text =
        error === null || error.path.length === 0
          ? t('bake.errorNoStep', { message: error?.message ?? '' })
          : t('bake.error', { step: stepLabel(error.path), message: error.message });
      break;
  }
  return (
    <p className={styles.status} data-status={status} role="status" aria-live="polite">
      {text}
    </p>
  );
}

export function OutputPane(): ReactNode {
  const output = useApp((s) => s.output);
  const warnings = useApp((s) => s.warnings);
  const [copied, setCopied] = useState(false);
  // A table shows as rows; its text (TSV) is built only when it is copied.
  const text = useMemo(
    () => (output === null || output.type === 'table' ? '' : dishText(output)),
    [output],
  );
  const size = output === null ? '' : sizeLabel(output.type, dishSize(output));
  return (
    <section className={styles.pane} aria-labelledby="output-title">
      <div className={styles.paneHead}>
        <h2 id="output-title" className={styles.paneTitle}>
          {t('output.title')}
        </h2>
        {output !== null && (
          <span className={styles.badge}>
            {output.type}
            {size === '' ? '' : ` · ${size}`}
          </span>
        )}
        <button
          type="button"
          className={styles.button}
          disabled={output === null}
          onClick={() => {
            void navigator.clipboard
              .writeText(output?.type === 'table' ? dishText(output) : text)
              .then(() => {
                setCopied(true);
                setTimeout(() => {
                  setCopied(false);
                }, 1500);
              });
          }}
        >
          {copied ? t('output.copied') : t('output.copy')}
        </button>
      </div>
      {output?.type === 'table' ? (
        <OutputTable table={output.value} labelledBy="output-title" />
      ) : (
        <textarea aria-labelledby="output-title" className={styles.text} readOnly value={text} />
      )}
      {warnings.length > 0 && (
        <ul className={styles.warnings}>
          {warnings.map((w, i) => (
            <li key={i}>
              <code>{w.code}</code> {w.message}
            </li>
          ))}
        </ul>
      )}
      <BakeStatus />
    </section>
  );
}
