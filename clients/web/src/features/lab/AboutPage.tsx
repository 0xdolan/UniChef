// SPDX-License-Identifier: GPL-3.0-or-later
/** About (`#/about`): versions, UniChef's licence, data notices and every shipped package. */

import { VERSION } from '@unichef/core';
import { UCD_VERSION } from '@unichef/core/unicode/index.js';
import type { ReactNode } from 'react';
import licences from 'virtual:licenses';

import constants from '../../../../../project.constants.json';

import { t } from '../../i18n/index.js';
import { useApp } from '../../state/store.js';
import styles from './Lab.module.css';

/** Data the app ships, as listed in THIRD_PARTY_NOTICES.md. */
export const DATA_NOTICES = [
  {
    name: `Unicode Character Database ${UCD_VERSION} and UTS #39 data`,
    copyright: 'Copyright © 1991-2026 Unicode, Inc.',
    license: 'Unicode License v3',
    url: 'https://www.unicode.org/license.txt',
  },
  {
    name: 'WHATWG HTML named character references',
    copyright: 'Copyright © WHATWG (Apple, Google, Mozilla, Microsoft)',
    license: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
  },
] as const;

const REPO = constants.REPO_URL;

export function AboutPage(): ReactNode {
  const openTour = useApp((s) => s.setTourOpen);
  return (
    <main id="main" className={styles.page}>
      <h1 className={styles.title}>{t('about.title')}</h1>
      <p>{t('about.intro')}</p>
      <dl className={styles.facts}>
        <dt>{t('about.version')}</dt>
        <dd className={styles.mono}>{VERSION}</dd>
        <dt>{t('about.ucd')}</dt>
        <dd className={styles.mono}>{UCD_VERSION}</dd>
        <dt>{t('about.licence')}</dt>
        <dd>
          <a href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noreferrer">
            GPL-3.0-or-later
          </a>
        </dd>
        <dt>{t('about.source')}</dt>
        <dd>
          <a href={REPO} rel="noreferrer">
            {REPO}
          </a>
        </dd>
      </dl>
      <p className={styles.muted}>{t('about.offline')}</p>
      <p>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            openTour(true);
          }}
        >
          {t('about.tour')}
        </button>
      </p>

      <h2 className={styles.subtitle}>{t('about.data')}</h2>
      <ul>
        {DATA_NOTICES.map((notice) => (
          <li key={notice.name}>
            {notice.name}. {notice.copyright}.{' '}
            <a href={notice.url} rel="noreferrer">
              {notice.license}
            </a>
          </li>
        ))}
      </ul>

      <h2 className={styles.subtitle}>{t('about.packages', { count: licences.length })}</h2>
      {licences.map((pkg) => (
        <details
          key={`${pkg.name}@${pkg.version}`}
          className={`${styles.details} ${styles.licence}`}
        >
          <summary>
            <span className={styles.mono}>
              {pkg.name} {pkg.version}
            </span>{' '}
            · {pkg.license}
          </summary>
          <pre className={styles.code}>{pkg.text === '' ? t('about.noText') : pkg.text}</pre>
        </details>
      ))}
    </main>
  );
}
