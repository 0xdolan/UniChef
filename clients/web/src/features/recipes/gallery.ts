// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The built-in recipes: one recipe document per file in `gallery/`, which `unichef bake -r`
 * also accepts, and a sample input for each in `gallery/samples.json`.
 */

import type { RecipeDoc } from '../../worker/protocol.js';
import samples from './gallery/samples.json';

export interface GalleryRecipe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly recipe: RecipeDoc & { readonly steps: readonly { readonly op: string }[] };
  readonly input: string;
}

const files = import.meta.glob<GalleryRecipe['recipe']>(['./gallery/*.json', '!**/samples.json'], {
  eager: true,
  import: 'default',
});

const inputs: Readonly<Record<string, string>> = samples;

export const GALLERY: readonly GalleryRecipe[] = Object.entries(files)
  .map(([path, recipe]) => {
    const id = path.replace(/^.*\/|\.json$/g, '');
    return {
      id,
      name: typeof recipe.name === 'string' ? recipe.name : id,
      description: typeof recipe.description === 'string' ? recipe.description : '',
      recipe,
      input: inputs[id] ?? '',
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
