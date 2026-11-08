// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * A table output, virtualised: only the rows in view are in the DOM, so 100 000 rows
 * render as fast as twenty (NFR-003). Screen readers get the full size from `aria-rowcount`.
 */

import type { Dish } from '@unichef/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode } from 'react';

import styles from './Workbench.module.css';

/** Matches `.outputTable td` (12px text, 2px padding, 1px border). */
const ROW_HEIGHT = 22;
const OVERSCAN = 10;
/** Rows rendered when there is no layout to measure. */
const INITIAL_ROWS = 30;

type Table = Extract<Dish, { type: 'table' }>['value'];

export function OutputTable({
  table,
  labelledBy,
}: {
  table: Table;
  labelledBy: string;
}): ReactNode {
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: table.rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });
  const virtual = virtualizer.getVirtualItems();
  // Without a layout (a zero-height box, or jsdom) the virtualiser offers nothing to show.
  const items =
    virtual.length > 0
      ? virtual
      : Array.from({ length: Math.min(INITIAL_ROWS, table.rows.length) }, (_, index) => ({
          index,
          start: index * ROW_HEIGHT,
          end: (index + 1) * ROW_HEIGHT,
        }));
  const before = items[0]?.start ?? 0;
  const after = Math.max(0, table.rows.length * ROW_HEIGHT - (items.at(-1)?.end ?? 0));
  const columns = table.columns.length;
  return (
    <div
      ref={scroller}
      role="region"
      className={styles.outputTable}
      tabIndex={0}
      aria-labelledby={labelledBy}
    >
      <table
        className={styles.table}
        aria-labelledby={labelledBy}
        aria-rowcount={table.rows.length + 1}
      >
        <thead>
          <tr aria-rowindex={1}>
            {table.columns.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {before > 0 && (
            <tr aria-hidden="true" style={{ height: before }}>
              <td colSpan={columns} />
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.index} aria-rowindex={item.index + 2}>
              {(table.rows[item.index] ?? []).map((cell, i) => (
                <td key={i} dir="auto">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
          {after > 0 && (
            <tr aria-hidden="true" style={{ height: after }}>
              <td colSpan={columns} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
