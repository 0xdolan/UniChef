// SPDX-License-Identifier: GPL-3.0-or-later
/** One dismissible notice about the workbench state, such as a shared link's review prompt. */

import type { ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { useApp } from '../../state/store.js';
import styles from './Workbench.module.css';

export function NoticeBar(): ReactNode {
  const notice = useApp((s) => s.notice);
  const setNotice = useApp((s) => s.setNotice);
  if (notice === null) return null;
  return (
    <div
      className={styles.notice}
      data-tone={notice.tone}
      role={notice.tone === 'info' ? 'status' : 'alert'}
    >
      <p>{t(notice.key, notice.vars)}</p>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          setNotice(null);
        }}
      >
        {t('notice.dismiss')}
      </button>
    </div>
  );
}
