// SPDX-License-Identifier: GPL-3.0-or-later

import type { ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { useApp } from '../../state/store.js';
import { StepList } from './StepList.js';
import styles from './Workbench.module.css';

export function RecipePane({ onBake }: { readonly onBake: () => void }): ReactNode {
  const steps = useApp((s) => s.steps);
  const clear = useApp((s) => s.clearRecipe);
  const autoBake = useApp((s) => s.autoBake);
  const setAutoBake = useApp((s) => s.setAutoBake);
  return (
    <section className={styles.pane} aria-labelledby="recipe-title">
      <div className={styles.paneHead}>
        <h2 id="recipe-title" className={styles.paneTitle}>
          {t('recipe.title')}
        </h2>
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
