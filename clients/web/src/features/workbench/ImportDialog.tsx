// SPDX-License-Identifier: GPL-3.0-or-later
/** The CyberChef recipe import dialog (FR-009, PRD §5.3). */

import { importCyberChef, isUniChefError } from '@unichef/core';
import { useId, useRef, useState, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { stepsFromDoc } from '../../state/recipe.js';
import { useApp } from '../../state/store.js';
import styles from './Workbench.module.css';

export function ImportDialog(): ReactNode {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setSteps = useApp((s) => s.setSteps);
  const setNotice = useApp((s) => s.setNotice);

  const close = () => {
    dialog.current?.close();
    setError(null);
  };
  const submit = () => {
    try {
      const steps = stepsFromDoc(importCyberChef(text));
      setSteps(steps);
      setNotice({ key: 'import.done', vars: { count: steps.length }, tone: 'info' });
      setText('');
      close();
    } catch (e) {
      if (!isUniChefError(e)) throw e;
      setError(e.message);
    }
  };

  return (
    <>
      <button type="button" className={styles.button} onClick={() => dialog.current?.showModal()}>
        {t('import.open')}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setError(null);
        }}
      >
        <form
          method="dialog"
          className={styles.dialogBody}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 id={`${id}-title`} className={styles.paneTitle}>
            {t('import.title')}
          </h2>
          <label htmlFor={`${id}-text`}>{t('import.label')}</label>
          <textarea
            id={`${id}-text`}
            className={styles.dialogText}
            value={text}
            spellCheck={false}
            rows={8}
            aria-invalid={error !== null}
            aria-describedby={error === null ? undefined : `${id}-error`}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
          {error !== null && (
            <p id={`${id}-error`} role="alert" className={styles.dialogError}>
              {error}
            </p>
          )}
          <div className={styles.paneFoot}>
            <button type="button" className={styles.button} onClick={close}>
              {t('import.cancel')}
            </button>
            <button type="submit" className={styles.primary} disabled={text.trim() === ''}>
              {t('import.submit')}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
