// SPDX-License-Identifier: GPL-3.0-or-later
/** The credit line under every page (FR-011): author, source, docs, site and version. */
import { VERSION } from '@unichef/core';
import type { ReactNode } from 'react';

import constants from '../../../../project.constants.json';
import { t } from '../i18n/index.js';
import styles from './App.module.css';

const AUTHOR = new URL(constants.REPO_URL).pathname.split('/')[1] ?? '';

export const FOOTER_LINKS = {
  author: `https://github.com/${AUTHOR}`,
  source: constants.REPO_URL,
  docs: `${constants.REPO_URL}/blob/HEAD/INTRODUCTION.md`,
  site: constants.PAGES_URL,
  version: `${constants.REPO_URL}/releases/tag/v${VERSION}`,
} as const;

/** A visual separator only: kept out of the link names that screen readers announce. */
function Sep(): ReactNode {
  return <span aria-hidden="true">·</span>;
}

export function Footer(): ReactNode {
  return (
    <footer className={styles.footer}>
      <nav aria-label={t('footer.label')}>
        <span>
          {t('footer.madeWith')}{' '}
          <svg
            className={styles.heart}
            viewBox="0 0 16 16"
            role="img"
            aria-label={t('footer.love')}
          >
            <path d="M8 14.5 1.6 8.3A3.9 3.9 0 0 1 8 3.4a3.9 3.9 0 0 1 6.4 4.9Z" />
          </svg>{' '}
          {t('footer.by')}{' '}
          <a href={FOOTER_LINKS.author} rel="noreferrer">
            {AUTHOR}
          </a>
        </span>
        <Sep />
        <a href={FOOTER_LINKS.source} rel="noreferrer">
          {t('footer.source')}
        </a>
        <Sep />
        <a href={FOOTER_LINKS.docs} rel="noreferrer">
          {t('footer.docs')}
        </a>
        <Sep />
        <a href={FOOTER_LINKS.site}>{t('footer.site')}</a>
        <Sep />
        <a href={FOOTER_LINKS.version} rel="noreferrer">
          v{VERSION}
        </a>
      </nav>
    </footer>
  );
}
