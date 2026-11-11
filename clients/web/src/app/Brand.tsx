// SPDX-License-Identifier: GPL-3.0-or-later
/** The UniChef lockup, from the branding masters (docs/branding/README.md §2, §5). */
import type { ReactNode } from 'react';

import logoDark from '../../../../assets/branding/source/unichef-logo.svg';
import logoLight from '../../../../assets/branding/source/unichef-logo-light.svg';
import { t } from '../i18n/index.js';
import styles from './App.module.css';

/** Both colour sets are in the page; CSS shows the one that suits the active theme. */
export function Brand(): ReactNode {
  return (
    <a href="#/" className={styles.brand} aria-label={t('nav.brand')}>
      <img className={styles.logoDark} src={logoDark} alt="" width="101" height="28" />
      <img className={styles.logoLight} src={logoLight} alt="" width="101" height="28" />
    </a>
  );
}
