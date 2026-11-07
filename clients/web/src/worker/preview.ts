// SPDX-License-Identifier: GPL-3.0-or-later
/** Bounded copies of step outputs, so streaming snapshots stays cheap for large dishes. */

import { makeDish, type Dish } from '@unichef/core';

/** Characters, bytes, code points or table rows kept in a step preview. */
export const PREVIEW_LIMIT = 64 * 1024;

export function preview(dish: Dish, limit = PREVIEW_LIMIT): Dish {
  switch (dish.type) {
    case 'bytes':
      // A copy, never a view: the preview's buffer is transferred to the main thread.
      return makeDish('bytes', dish.value.slice(0, limit));
    case 'string':
      return dish.value.length > limit ? makeDish('string', dish.value.slice(0, limit)) : dish;
    case 'codepoints':
      return dish.value.length > limit ? makeDish('codepoints', dish.value.slice(0, limit)) : dish;
    case 'table':
      return dish.value.rows.length > limit
        ? makeDish('table', { columns: dish.value.columns, rows: dish.value.rows.slice(0, limit) })
        : dish;
    case 'integer':
    case 'float':
    case 'json':
      return dish;
  }
}
