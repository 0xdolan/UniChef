// SPDX-License-Identifier: GPL-3.0-or-later
/** Links that open a recipe and input in the workbench, through the shared-URL format. */

import { useEffect, useState } from 'react';

import { encodeState } from '../../lib/share.js';
import type { RecipeDoc } from '../../worker/protocol.js';

/** The workbench link for `recipe` and `input`, or null while it is being encoded. */
export function useWorkbenchHref(recipe: RecipeDoc, input: string): string | null {
  const key = JSON.stringify([recipe, input]);
  const [href, setHref] = useState<{ key: string; href: string } | null>(null);
  useEffect(() => {
    let live = true;
    const [doc, text] = JSON.parse(key) as [RecipeDoc, string];
    void encodeState(doc, text, 'text').then(({ fragment }) => {
      if (live) setHref({ key, href: fragment });
    });
    return () => {
      live = false;
    };
  }, [key]);
  return href?.key === key ? href.href : null;
}
