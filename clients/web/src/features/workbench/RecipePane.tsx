// SPDX-License-Identifier: GPL-3.0-or-later

import { useState, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { currentFragment } from '../../lib/url-state.js';
import { hasSecrets } from '../../state/recipe.js';
import { useApp } from '../../state/store.js';
import { ImportDialog } from './ImportDialog.js';
import { StepList } from './StepList.js';
import styles from './Workbench.module.css';

export function RecipePane({ onBake }: { readonly onBake: () => void }): ReactNode {
  const steps = useApp((s) => s.steps);
  const clear = useApp((s) => s.clearRecipe);
  const autoBake = useApp((s) => s.autoBake);
  const setAutoBake = useApp((s) => s.setAutoBake);
  const shareSecrets = useApp((s) => s.shareSecrets);
  const setShareSecrets = useApp((s) => s.setShareSecrets);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.hash = await currentFragment();
    await navigator.clipboard.writeText(url.href);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };
  return (
    <section className={styles.pane} aria-labelledby="recipe-title">
      <div className={styles.paneHead}>
        <h2 id="recipe-title" className={styles.paneTitle}>
          {t('recipe.title')}
        </h2>
        <ImportDialog />
        <button
          type="button"
          className={styles.button}
          onClick={() => void copyLink()}
          disabled={steps.length === 0}
        >
          {copied ? t('recipe.linkCopied') : t('recipe.copyLink')}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={clear}
          disabled={steps.length === 0}
        >
          {t('recipe.clear')}
        </button>
      </div>
      <div className={styles.scroll}>
        {steps.length === 0 ? (
          <p className={styles.empty}>{t('recipe.empty')}</p>
        ) : (
          <StepList steps={steps} />
        )}
      </div>
      {(shareSecrets || hasSecrets(steps)) && (
        <label className={styles.inline}>
          <input
            type="checkbox"
            checked={shareSecrets}
            onChange={(e) => {
              setShareSecrets(e.target.checked);
            }}
          />
          {t('recipe.shareSecrets')}
        </label>
      )}
      <div className={styles.paneFoot}>
        <label className={styles.inline}>
          <input
            type="checkbox"
            checked={autoBake}
            onChange={(e) => {
              setAutoBake(e.target.checked);
            }}
          />
          {t('bake.auto')}
        </label>
        <button type="button" className={styles.primary} onClick={onBake}>
          {t('bake.run')}
        </button>
      </div>
    </section>
  );
}
