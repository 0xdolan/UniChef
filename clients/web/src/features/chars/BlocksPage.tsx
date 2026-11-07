// SPDX-License-Identifier: GPL-3.0-or-later
/** Unicode blocks (`#/blocks`) and one block's characters (`#/blocks/Basic_Latin`). */

import { useId, useMemo, useState, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import type { BlockInfo } from '../../worker/ucd-protocol.js';
import { CharGrid } from './CharGrid.js';
import styles from './Chars.module.css';
import { blockSlug, hexRange, looseName, useLookup } from './lookup.js';

function BlockList({ blocks }: { readonly blocks: readonly BlockInfo[] }): ReactNode {
  const id = useId();
  const [filter, setFilter] = useState('');
  const shown = blocks.filter((b) => looseName(b.name).includes(looseName(filter)));
  return (
    <>
      <label className={styles.searchLabel} htmlFor={`${id}-filter`}>
        {t('blocks.filter')}
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
        {t('blocks.count', { shown: shown.length, total: blocks.length })}
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('blocks.range')}</th>
            <th scope="col">{t('blocks.name')}</th>
            <th scope="col">{t('blocks.assigned')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((b) => (
            <tr key={b.start}>
              <td className={styles.cpText}>{hexRange(b.start, b.end)}</td>
              <td>
                <a href={`#/blocks/${blockSlug(b.name)}`}>{b.name}</a>
              </td>
              <td className={styles.number}>
                {b.assigned.toLocaleString()} / {(b.end - b.start + 1).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Block({ block }: { readonly block: BlockInfo }): ReactNode {
  const codePoints = useMemo(
    () => Array.from({ length: block.end - block.start + 1 }, (_, i) => block.start + i),
    [block],
  );
  return (
    <>
      <p className={styles.muted}>
        <span className={styles.cpText}>{hexRange(block.start, block.end)}</span> ·{' '}
        {t('blocks.assignedOf', {
          assigned: block.assigned.toLocaleString(),
          size: codePoints.length.toLocaleString(),
        })}
      </p>
      <CharGrid codePoints={codePoints} label={block.name} />
    </>
  );
}

export function BlocksPage({ param }: { readonly param: string }): ReactNode {
  const lookup = useLookup({ kind: 'blocks' });
  const blocks = lookup?.state === 'done' ? lookup.value : null;
  const block = param === '' ? null : blocks?.find((b) => looseName(b.name) === looseName(param));

  return (
    <main id="main" className={styles.page}>
      {param !== '' && (
        <nav className={styles.pager} aria-label={t('nav.breadcrumb')}>
          <a href="#/blocks">← {t('blocks.title')}</a>
        </nav>
      )}
      <h1 className={styles.title}>{block?.name ?? t('blocks.title')}</h1>
      {lookup?.state === 'error' && <p className={styles.error}>{lookup.error.message}</p>}
      {blocks === null && lookup?.state !== 'error' && (
        <p className={styles.muted}>{t('chars.searching')}</p>
      )}
      {blocks !== null && param === '' && <BlockList blocks={blocks} />}
      {blocks !== null && param !== '' && block === undefined && (
        <p>{t('blocks.unknown', { name: param })}</p>
      )}
      {block !== null && block !== undefined && <Block block={block} />}
    </main>
  );
}
