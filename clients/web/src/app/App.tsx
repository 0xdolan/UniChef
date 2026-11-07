// SPDX-License-Identifier: GPL-3.0-or-later

import type { ReactNode } from 'react';

import { Workbench } from '../features/workbench/Workbench.js';
import { t } from '../i18n/index.js';
import styles from './App.module.css';
import { useRoute } from './router.js';

export function App(): ReactNode {
  const route = useRoute();
  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#main">
        {t('app.skip')}
      </a>
      <header className={styles.header}>
        <span className={styles.logo}>{t('app.title')}</span>
        <nav aria-label="Main">
          <a href="#/" aria-current={route === '/' ? 'page' : undefined}>
            {t('nav.workbench')}
          </a>
        </nav>
      </header>
      {route === '/' ? (
        <Workbench />
      ) : (
        <main id="main" className={styles.notFound}>
          <p>{t('nav.notFound')}</p>
          <a href="#/">{t('nav.home')}</a>
        </main>
      )}
    </div>
  );
}
