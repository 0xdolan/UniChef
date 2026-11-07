// SPDX-License-Identifier: GPL-3.0-or-later
/** Character search (`#/chars?q=…`) with the §4.8 query language (FR-006). */

import { useEffect, useId, useState, type ReactNode } from 'react';

import { routeQuery, useHash } from '../../app/router.js';
import { t } from '../../i18n/index.js';
import { charHref, cpLabel } from '../../lib/ucd.js';
import { CharGrid } from './CharGrid.js';
import styles from './Chars.module.css';
import { useLookup } from './lookup.js';

export const SEARCH_MS = 300;

export const EXAMPLES = [
  'arrow',
  'name~/ARROW$/ & gc=Sm & age<=6.0',
  'scx=Arab & gc=Nd',
  'blk=Emoticons',
] as const;

const searchHref = (query: string): string => `#/chars?q=${encodeURIComponent(query)}`;

export function CharsPage(): ReactNode {
  const id = useId();
  const fromHash = routeQuery(useHash()).get('q') ?? '';
  const [text, setText] = useState(fromHash);
  const [query, setQuery] = useState(fromHash);

  // A link or the back button changed the query.
  useEffect(() => {
    setText(fromHash);
    setQuery(fromHash);
  }, [fromHash]);

  useEffect(() => {
    if (text === query) return;
    const timer = setTimeout(() => {
      setQuery(text);
      window.history.replaceState(null, '', text.trim() === '' ? '#/chars' : searchHref(text));
    }, SEARCH_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, query]);

  const lookup = useLookup(query.trim() === '' ? null : { kind: 'search', query });

  return (
    <main id="main" className={styles.page}>
      <h1 className={styles.title}>{t('chars.title')}</h1>
      <label className={styles.searchLabel} htmlFor={`${id}-q`}>
        {t('chars.search')}
      </label>
      <input
        id={`${id}-q`}
        className={styles.search}
        type="search"
        spellCheck={false}
        autoComplete="off"
        aria-describedby={`${id}-status`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <div id={`${id}-status`} className={styles.status} role="status" data-status>
        {lookup === null && (
          <p className={styles.muted}>
            {t('chars.hint')}{' '}
            {EXAMPLES.map((example) => (
              <a key={example} className={styles.example} href={searchHref(example)}>
                {example}
              </a>
            ))}
          </p>
        )}
        {lookup?.state === 'loading' && <p className={styles.muted}>{t('chars.searching')}</p>}
        {lookup?.state === 'error' && <p className={styles.error}>{lookup.error.message}</p>}
        {lookup?.state === 'done' && (
          <p className={styles.muted}>
            {t('chars.count', {
              total: lookup.value.total.toLocaleString(),
              ms: Math.round(lookup.ms),
            })}
            {lookup.value.truncated &&
              ` ${t('chars.truncated', { shown: lookup.value.codePoints.length.toLocaleString() })}`}
          </p>
        )}
        {lookup?.state === 'done' && lookup.value.exact !== null && (
          <p>
            {t('chars.exact')}{' '}
            <a href={charHref(lookup.value.exact)}>{cpLabel(lookup.value.exact)}</a>
          </p>
        )}
      </div>
      {lookup?.state === 'done' && (
        <CharGrid codePoints={lookup.value.codePoints} label={t('chars.results')} />
      )}
    </main>
  );
}
