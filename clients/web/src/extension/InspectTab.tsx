// SPDX-License-Identifier: GPL-3.0-or-later
/** Inspect (PRD §7.1): invisible characters first, then one row per code point. */

import { useId, useState, type ReactNode } from 'react';

import { OutputTable } from '../features/workbench/OutputTable.js';
import wb from '../features/workbench/Workbench.module.css';
import { t } from '../i18n/index.js';
import styles from './Extension.module.css';
import { useInspection, type Table } from './inspection.js';

export function InspectTab({
  text,
  onText,
}: {
  readonly text: string;
  readonly onText: (text: string) => void;
}): ReactNode {
  const id = useId();
  const inspection = useInspection(text);
  const [showAll, setShowAll] = useState(false);
  return (
    <div className={styles.stack}>
      <label htmlFor={`${id}-text`} className={styles.label}>
        {t('ext.inspect.text')}
      </label>
      <textarea
        id={`${id}-text`}
        className={`${wb.text} ${styles.input}`}
        spellCheck={false}
        value={text}
        placeholder={t('ext.inspect.placeholder')}
        onChange={(e) => {
          onText(e.target.value);
        }}
      />
      {inspection.state === 'running' && <p className={styles.muted}>{t('nav.loading')}</p>}
      {inspection.state === 'error' && (
        <p role="alert" className={styles.error}>
          {inspection.error.code}: {inspection.error.message}
        </p>
      )}
      {inspection.state === 'done' && (
        <>
          <h2 id={`${id}-inv`} className={styles.heading}>
            {t('ext.inspect.invisible', { n: inspection.invisible.rows.length })}
          </h2>
          {inspection.invisible.rows.length === 0 ? (
            <p className={styles.ok}>{t('ext.inspect.none')}</p>
          ) : (
            <div className={styles.tableBox}>
              <OutputTable table={inspection.invisible} labelledBy={`${id}-inv`} />
            </div>
          )}
          <h2 id={`${id}-chars`} className={styles.heading}>
            {t('ext.inspect.chars', { n: inspection.chars.rows.length })}
          </h2>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => {
                setShowAll(e.target.checked);
              }}
            />
            {t('ext.inspect.allColumns')}
          </label>
          <div className={styles.tableBox}>
            <OutputTable
              table={showAll ? inspection.chars : brief(inspection.chars)}
              labelledBy={`${id}-chars`}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** The columns that fit a 360 px panel. */
const BRIEF = ['cp', 'char', 'name', 'gc', 'script', 'flags'];

function brief(table: Table): Table {
  const keep = BRIEF.map((c) => table.columns.indexOf(c)).filter((i) => i >= 0);
  return {
    columns: keep.map((i) => table.columns[i] ?? ''),
    rows: table.rows.map((row) => keep.map((i) => row[i] ?? null)),
  };
}
