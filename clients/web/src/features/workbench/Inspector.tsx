// SPDX-License-Identifier: GPL-3.0-or-later
/** The step inspector (FR-002): the selected step's output preview as text, hex or table. */

import { dishSize, getOperationInfo, makeDish, type Dish } from '@unichef/core';
import { useId, useState, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { dishText, inputDish, sizeLabel } from '../../lib/format.js';
import {
  TABLE_ROWS,
  bytesOf,
  hexDump,
  inputKey,
  stepAt,
  utf8Prefix,
  viewsFor,
  type InspectView,
} from '../../lib/inspect.js';
import { useApp } from '../../state/store.js';
import { PREVIEW_LIMIT } from '../../worker/preview.js';
import { stepLabel } from './IoPanes.js';
import styles from './Workbench.module.css';

function render(dish: Dish, view: InspectView): ReactNode {
  if (view === 'table' && dish.type === 'table') {
    const rows = dish.value.rows.slice(0, TABLE_ROWS);
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {dish.value.columns.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} dir="auto">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {dish.value.rows.length > TABLE_ROWS && (
          <p className={styles.note}>{t('inspector.rowsCapped', { shown: TABLE_ROWS })}</p>
        )}
      </div>
    );
  }
  const bytes = view === 'hex' ? bytesOf(dish) : null;
  const text =
    bytes !== null
      ? hexDump(bytes)
      : dish.type === 'bytes'
        ? dishText(makeDish('bytes', utf8Prefix(dish.value)))
        : dishText(dish);
  return (
    <pre className={styles.dump} data-view={view}>
      {text}
    </pre>
  );
}

export function Inspector(): ReactNode {
  const id = useId();
  const selected = useApp((s) => s.selected);
  const steps = useApp((s) => s.steps);
  const snapshots = useApp((s) => s.snapshots);
  const input = useApp((s) => s.input);
  const format = useApp((s) => s.inputFormat);
  const [chosen, setView] = useState<InspectView>('text');
  const [diff, setDiff] = useState(false);

  const path = selected === null ? [] : selected.split('/').map(Number);
  const step = selected === null ? null : stepAt(steps, path);
  const snapshot = selected === null ? undefined : snapshots[selected];

  let body: ReactNode;
  if (step === null) {
    body = <p className={styles.empty}>{t('inspector.empty')}</p>;
  } else if (snapshot === undefined) {
    body = <p className={styles.empty}>{t('inspector.notRun')}</p>;
  } else {
    const views = viewsFor(snapshot.type);
    const view = views.includes(chosen) ? chosen : (views[0] ?? 'text');
    const shown = dishSize(snapshot.preview);
    let before: Dish | null = null;
    if (diff) {
      const key = inputKey(path, (k) => k in snapshots);
      if (key !== null) {
        before = snapshots[key]?.preview ?? null;
      } else {
        try {
          before = inputDish(input.slice(0, PREVIEW_LIMIT), format);
        } catch {
          before = null;
        }
      }
    }
    body = (
      <>
        <div className={styles.paneHead}>
          <div role="radiogroup" aria-label={t('inspector.views')} className={styles.segmented}>
            {views.map((v) => (
              <label key={v}>
                <input
                  type="radio"
                  name={`${id}-view`}
                  checked={v === view}
                  onChange={() => {
                    setView(v);
                  }}
                />
                {t(`inspector.${v}`)}
              </label>
            ))}
          </div>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={diff}
              onChange={(e) => {
                setDiff(e.target.checked);
              }}
            />
            {t('inspector.diff')}
          </label>
        </div>
        {snapshot.byteLength > shown && (
          <p className={styles.note}>
            {t('inspector.truncated', {
              shown: sizeLabel(snapshot.type, shown),
              total: sizeLabel(snapshot.type, snapshot.byteLength),
            })}
          </p>
        )}
        {diff ? (
          <div className={styles.diff}>
            <div>
              <h3 className={styles.diffTitle}>{t('inspector.before')}</h3>
              {before === null
                ? null
                : render(before, viewsFor(before.type).includes(view) ? view : 'text')}
            </div>
            <div>
              <h3 className={styles.diffTitle}>{t('inspector.after')}</h3>
              {render(snapshot.preview, view)}
            </div>
          </div>
        ) : (
          render(snapshot.preview, view)
        )}
      </>
    );
  }

  return (
    <section className={styles.pane} aria-labelledby={`${id}-title`}>
      <div className={styles.paneHead}>
        <h2 id={`${id}-title`} className={styles.paneTitle}>
          {step === null
            ? t('inspector.title')
            : t('inspector.step', { step: stepLabel(path), name: getOperationInfo(step.op).name })}
        </h2>
      </div>
      <div className={styles.scroll}>{body}</div>
    </section>
  );
}
