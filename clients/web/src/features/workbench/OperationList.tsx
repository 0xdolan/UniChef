// SPDX-License-Identifier: GPL-3.0-or-later
/** Searchable operation list, grouped by category. Clicking an operation appends it. */

import { allOperationInfo, type OperationInfo } from '@unichef/core';
import { useMemo, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { useApp } from '../../state/store.js';
import styles from './Workbench.module.css';

export function matchOps(
  ops: readonly OperationInfo[],
  query: string,
): Map<string, OperationInfo[]> {
  const q = query.trim().toLowerCase();
  const groups = new Map<string, OperationInfo[]>();
  for (const op of ops) {
    if (q !== '' && ![op.id, op.name, op.description].some((s) => s.toLowerCase().includes(q))) {
      continue;
    }
    const group = groups.get(op.category);
    if (group === undefined) groups.set(op.category, [op]);
    else group.push(op);
  }
  // Names that start with the query come first, so "to hex" puts To Hex above PEM to Hex.
  // Array.prototype.sort is stable, so each part keeps the catalogue order.
  if (q !== '') {
    const rank = (op: OperationInfo): number => (op.name.toLowerCase().startsWith(q) ? 0 : 1);
    for (const group of groups.values()) group.sort((a, b) => rank(a) - rank(b));
  }
  return groups;
}

export function OperationList(): ReactNode {
  const query = useApp((s) => s.opQuery);
  const setQuery = useApp((s) => s.setOpQuery);
  const addStep = useApp((s) => s.addStep);
  const groups = useMemo(() => matchOps(allOperationInfo(), query), [query]);
  return (
    <section className={styles.pane} aria-labelledby="ops-title">
      <h2 id="ops-title" className={styles.paneTitle}>
        {t('ops.title')}
      </h2>
      <input
        type="search"
        className={styles.control}
        aria-label={t('ops.search')}
        placeholder={t('ops.search')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
      />
      <div className={styles.scroll}>
        {groups.size === 0 && <p className={styles.empty}>{t('ops.none', { query })}</p>}
        {[...groups].map(([category, ops]) => (
          <div key={category}>
            <h3 className={styles.category}>{category}</h3>
            <ul className={styles.ops}>
              {ops.map((op) => (
                <li key={op.id}>
                  <button
                    type="button"
                    className={styles.op}
                    title={op.description}
                    aria-label={t('ops.add', { name: op.name })}
                    onClick={() => {
                      addStep(op.id);
                    }}
                  >
                    {op.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
