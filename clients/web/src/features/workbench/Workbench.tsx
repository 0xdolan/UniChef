// SPDX-License-Identifier: GPL-3.0-or-later
/** `#/`: Operations · Recipe · Input/Output/Inspector (PRD §6.4). */

import type { ReactNode } from 'react';

import { useBaker } from '../../lib/baker.js';
import { useUrlState } from '../../lib/url-state.js';
import type { WorkerLike } from '../../worker/client.js';
import { Inspector } from './Inspector.js';
import { InputPane, OutputPane } from './IoPanes.js';
import { NoticeBar } from './NoticeBar.js';
import { OperationList } from './OperationList.js';
import { RecipePane } from './RecipePane.js';
import styles from './Workbench.module.css';

export function Workbench({
  createWorker,
}: {
  readonly createWorker?: () => WorkerLike;
}): ReactNode {
  const bakeNow = useBaker(createWorker);
  useUrlState();
  return (
    <main id="main" className={styles.workbench}>
      <NoticeBar />
      <OperationList />
      <RecipePane onBake={bakeNow} />
      <div className={styles.io}>
        <InputPane />
        <OutputPane />
        <Inspector />
      </div>
    </main>
  );
}
