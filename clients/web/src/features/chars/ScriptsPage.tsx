// SPDX-License-Identifier: GPL-3.0-or-later
/** ISO 15924 scripts (`#/scripts`) and one script's characters (`#/scripts/Arab`). */

import { useId, useState, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import type { ScriptInfo } from '../../worker/ucd-protocol.js';
import { CharGrid } from './CharGrid.js';
import styles from './Chars.module.css';
import { looseName, useLookup } from './lookup.js';

function ScriptList({ scripts }: { readonly scripts: readonly ScriptInfo[] }): ReactNode {
  const id = useId();
  const [filter, setFilter] = useState('');
  const loose = looseName(filter);
  const shown = scripts.filter(
    (s) => looseName(s.name).includes(loose) || looseName(s.code).includes(loose),
  );
  return (
    <>
      <label className={styles.searchLabel} htmlFor={`${id}-filter`}>
        {t('scripts.filter')}
      </label>
      <input
        id={`${id}-filter`}
        className={styles.search}
        type="search"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
        }}
      />
      <p className={styles.muted} role="status" data-status>
        {t('scripts.count', { shown: shown.length, total: scripts.length })}
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('scripts.code')}</th>
            <th scope="col">{t('scripts.name')}</th>
            <th scope="col">{t('scripts.chars')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.code}>
              <td className={styles.cpText}>
                <a href={`#/scripts/${s.code}`}>{s.code}</a>
              </td>
              <td>{s.name.replace(/_/g, ' ')}</td>
              <td className={styles.number}>{s.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Script({ code }: { readonly code: string }): ReactNode {
  const id = useId();
  const [extensions, setExtensions] = useState(false);
  const lookup = useLookup({ kind: 'script', code, extensions });
  if (lookup?.state === 'error') return <p>{t('scripts.unknown', { name: code })}</p>;
  const value = lookup?.state === 'done' ? lookup.value : null;
  return (
    <>
      <h1 className={styles.title}>
        {value === null ? code : `${value.name.replace(/_/g, ' ')} (${value.code})`}
      </h1>
      <p className={styles.toolbar}>
        <input
          id={`${id}-scx`}
          type="checkbox"
          checked={extensions}
          onChange={(e) => {
            setExtensions(e.target.checked);
          }}
        />
        <label htmlFor={`${id}-scx`}>{t('scripts.extensions')}</label>
        <span className={styles.muted} role="status" data-status>
          {value === null
            ? t('chars.searching')
            : t('scripts.countChars', { count: value.codePoints.length.toLocaleString() })}
        </span>
      </p>
      {value !== null && <CharGrid codePoints={value.codePoints} label={value.name} />}
    </>
  );
}

export function ScriptsPage({ param }: { readonly param: string }): ReactNode {
  const lookup = useLookup(param === '' ? { kind: 'scripts' } : null);
  return (
    <main id="main" className={styles.page}>
      {param === '' ? (
        <>
          <h1 className={styles.title}>{t('scripts.title')}</h1>
          {lookup?.state === 'error' && <p className={styles.error}>{lookup.error.message}</p>}
          {lookup?.state === 'loading' && <p className={styles.muted}>{t('chars.searching')}</p>}
          {lookup?.state === 'done' && <ScriptList scripts={lookup.value} />}
        </>
      ) : (
        <>
          <nav className={styles.pager} aria-label={t('nav.breadcrumb')}>
            <a href="#/scripts">← {t('scripts.title')}</a>
          </nav>
          <Script key={param} code={param} />
        </>
      )}
    </main>
  );
}
