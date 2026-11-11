// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The first-run introduction (FR-015). On a first visit to the bare workbench it opens a short
 * modal tour of what UniChef does; a shared link (`#/?...`, `#/char/...`) never triggers it, so a
 * recipient lands straight on what was shared. "Seen" is kept in localStorage, a per-browser
 * convenience: when storage is blocked the tour stays closed rather than opening every visit.
 * About has a button that opens it again.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { t, type MessageKey } from '../i18n/index.js';
import { useApp } from '../state/store.js';
import styles from './Tour.module.css';

export const TOUR_KEY = 'unichef.tour';

const WELCOME = ['tour.welcome.title', 'tour.welcome.text'] as const;

export const TOUR_STEPS: readonly (readonly [MessageKey, MessageKey])[] = [
  WELCOME,
  ['tour.recipe.title', 'tour.recipe.text'],
  ['tour.inspect.title', 'tour.inspect.text'],
  ['tour.unicode.title', 'tour.unicode.text'],
  ['tour.share.title', 'tour.share.text'],
];

/** True once per browser, on the bare workbench URL; records the visit. */
export function firstVisit(hash: string): boolean {
  if (hash !== '' && hash !== '#' && hash !== '#/') return false;
  try {
    if (localStorage.getItem(TOUR_KEY) !== null) return false;
    localStorage.setItem(TOUR_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function Tour(): ReactNode {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const open = useApp((s) => s.tourOpen);
  const setOpen = useApp((s) => s.setTourOpen);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (firstVisit(window.location.hash)) setOpen(true);
  }, [setOpen]);

  useEffect(() => {
    const d = dialog.current;
    if (d === null) return;
    if (open && !d.open) {
      setStep(0);
      d.showModal();
      // Focus the primary action, so Enter walks through the tour.
      primary.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const [titleKey, textKey] = TOUR_STEPS[step] ?? WELCOME;
  const last = step === TOUR_STEPS.length - 1;
  const close = () => {
    setOpen(false);
  };

  return (
    <dialog
      ref={dialog}
      className={styles.tour}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onClose={close}
    >
      <div className={styles.body}>
        <p className={styles.count}>
          {t('tour.count', { step: step + 1, total: TOUR_STEPS.length })}
        </p>
        <h2 id={`${id}-title`} className={styles.title}>
          {t(titleKey)}
        </h2>
        <p id={`${id}-text`}>{t(textKey)}</p>
        <div className={styles.foot}>
          {last ? (
            <a href="#/docs" className={styles.link} onClick={close}>
              {t('tour.docs')}
            </a>
          ) : (
            <button type="button" className={styles.link} onClick={close}>
              {t('tour.skip')}
            </button>
          )}
          <span className={styles.spacer} />
          {step > 0 && (
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setStep(step - 1);
              }}
            >
              {t('tour.back')}
            </button>
          )}
          <button
            type="button"
            ref={primary}
            className={styles.primary}
            onClick={() => {
              if (last) close();
              else setStep(step + 1);
            }}
          >
            {t(last ? 'tour.done' : 'tour.next')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
