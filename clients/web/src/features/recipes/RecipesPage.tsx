// SPDX-License-Identifier: GPL-3.0-or-later
/** The built-in recipe gallery (`#/recipes`). Each card opens its recipe in the workbench. */

import { getOperationInfo } from '@unichef/core';
import type { ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import styles from '../lab/Lab.module.css';
import { useWorkbenchHref } from '../lab/links.js';
import { GALLERY, type GalleryRecipe } from './gallery.js';

function Card({ entry }: { readonly entry: GalleryRecipe }): ReactNode {
  const href = useWorkbenchHref(entry.recipe, entry.input);
  return (
    <li className={styles.card}>
      <h2>{entry.name}</h2>
      <p className={styles.muted}>{entry.description}</p>
      <ol className={styles.chips} aria-label={t('recipes.steps')}>
        {entry.recipe.steps.map((step, i) => (
          <li key={i}>{getOperationInfo(step.op).name}</li>
        ))}
      </ol>
      {href !== null && (
        <a className={styles.button} href={href}>
          {t('recipes.open')}
          <span className={styles.visuallyHidden}>: {entry.name}</span>
        </a>
      )}
    </li>
  );
}

export function RecipesPage(): ReactNode {
  return (
    <main id="main" className={styles.page}>
      <h1 className={styles.title}>{t('recipes.title')}</h1>
      <p className={styles.muted}>{t('recipes.intro')}</p>
      <ul className={styles.cards}>
        {GALLERY.map((entry) => (
          <Card key={entry.id} entry={entry} />
        ))}
      </ul>
    </main>
  );
}
