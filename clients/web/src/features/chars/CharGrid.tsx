// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * A virtualised grid of characters: only the rows in view are rendered and described, so
 * a block of 65,534 code points or a search with 10,000 results scrolls smoothly.
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { charHref, cpLabel, useUcd, type UcdService } from '../../lib/ucd.js';
import type { CharCell } from '../../worker/ucd-protocol.js';
import styles from './Chars.module.css';

const CELL_WIDTH = 76;
const ROW_HEIGHT = 84;
const OVERSCAN = 4;

/** Cells already described, shared by every grid: the UCD never changes in a session. */
const cache = new Map<number, CharCell>();

/** Describes the code points not in the cache yet, re-rendering when they arrive. */
function useCells(ucd: UcdService, codePoints: readonly number[]): void {
  const [, setVersion] = useState(0);
  const missing = codePoints.filter((cp) => !cache.has(cp));
  const key = missing.join(',');
  useEffect(() => {
    if (key === '') return;
    let live = true;
    ucd.call({ kind: 'cells', codePoints: key.split(',').map(Number) }).then(
      (cells) => {
        for (const cell of cells) cache.set(cell.cp, cell);
        if (live) setVersion((v) => v + 1);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [ucd, key]);
}

export function CharGrid({
  codePoints,
  label,
}: {
  readonly codePoints: readonly number[];
  /** Accessible name of the grid, e.g. the block's name. */
  readonly label: string;
}): ReactNode {
  const ucd = useUcd();
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(CELL_WIDTH * 8);
  const columns = Math.max(1, Math.floor(width / CELL_WIDTH));
  const rows = Math.ceil(codePoints.length / columns);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    onChange: (instance) => {
      const measured = instance.scrollRect?.width;
      if (measured !== undefined && measured > 0) setWidth(measured);
    },
  });
  const items = virtualizer.getVirtualItems();
  const first = (items[0]?.index ?? 0) * columns;
  const last = ((items.at(-1)?.index ?? -1) + 1) * columns;
  useCells(ucd, codePoints.slice(first, last));

  return (
    <div ref={scroller} className={styles.scroller}>
      <div
        role="list"
        aria-label={label}
        className={styles.grid}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((row) => (
          <div
            key={row.key}
            role="none"
            className={styles.row}
            style={{ transform: `translateY(${String(row.start)}px)` }}
          >
            {codePoints.slice(row.index * columns, (row.index + 1) * columns).map((cp, i) => {
              const cell = cache.get(cp);
              const label = cpLabel(cp);
              return (
                <div
                  key={cp}
                  role="listitem"
                  aria-setsize={codePoints.length}
                  aria-posinset={row.index * columns + i + 1}
                  className={styles.cell}
                  data-gc={cell?.gc}
                >
                  {/* The name is hidden text, not an aria-label, so it starts with the visible code point (WCAG 2.5.3). */}
                  <a href={charHref(cp)} title={cell?.name}>
                    <span className={styles.glyph} dir="auto" aria-hidden="true">
                      {cell?.glyph ?? ''}
                    </span>
                    <span className="visually-hidden">U+</span>
                    <span className={styles.cp}>{label.slice(2)}</span>
                    {cell !== undefined && (
                      <>
                        {' '}
                        <span className="visually-hidden">{cell.name}</span>
                      </>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {codePoints.length === 0 && <p className={styles.muted}>{t('chars.none')}</p>}
    </div>
  );
}
