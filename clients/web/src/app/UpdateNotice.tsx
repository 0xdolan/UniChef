// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Says so when the app has reloaded into a new release (FR-012). The service worker swaps
 * the cached copy for the new one on the first visit after a deploy; this line tells the user
 * which version they are now on. The last seen version is kept in localStorage, a per-browser
 * convenience: when storage is blocked the notice simply never shows.
 */
import { VERSION } from '@unichef/core';
import { useState, type ReactNode } from 'react';

import { t } from '../i18n/index.js';
import styles from './App.module.css';

export const SEEN_KEY = 'unichef.version';

/** The version this browser last ran, then records the current one. */
function previousVersion(): string | null {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    localStorage.setItem(SEEN_KEY, VERSION);
    return seen;
  } catch {
    return null;
  }
}

export function UpdateNotice(): ReactNode {
  const [show, setShow] = useState(() => {
    const seen = previousVersion();
    return seen !== null && seen !== VERSION;
  });
  if (!show) return null;
  return (
    <div role="status" className={styles.update}>
      <span>{t('update.done', { version: VERSION })}</span>
      <button
        type="button"
        onClick={() => {
          setShow(false);
        }}
      >
        {t('update.dismiss')}
      </button>
    </div>
  );
}
