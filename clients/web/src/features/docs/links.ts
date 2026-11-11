// SPDX-License-Identifier: GPL-3.0-or-later
/** Links into the docs reader (FR-014). */

import constants from '../../../../../project.constants.json';

/** The extensions have no docs route, so their links open the reader on the Pages site. */
export const DOCS_ELSEWHERE = import.meta.env.MODE === 'extension';

/** The reference page of operation `id`. */
export function opDocsHref(id: string): string {
  const path = `#/docs/reference/ops/${encodeURIComponent(id)}`;
  return DOCS_ELSEWHERE ? `${constants.PAGES_URL}${path}` : path;
}
