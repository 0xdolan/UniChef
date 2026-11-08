// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Quick Recipe (PRD §7.1): the workbench's own panes, stacked for a narrow panel. The
 * recipe is not written to the URL; the extension page has no shareable address.
 */

import type { ReactNode } from 'react';

import { InputPane, OutputPane } from '../features/workbench/IoPanes.js';
import { NoticeBar } from '../features/workbench/NoticeBar.js';
import { OperationList } from '../features/workbench/OperationList.js';
import { RecipePane } from '../features/workbench/RecipePane.js';
import { useBaker } from '../lib/baker.js';
import styles from './Extension.module.css';

export function RecipeTab(): ReactNode {
  const bakeNow = useBaker();
  return (
    <div className={styles.recipe}>
      <NoticeBar />
      <InputPane />
      <RecipePane onBake={bakeNow} />
      <OutputPane />
      <OperationList />
    </div>
  );
}
