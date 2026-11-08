// SPDX-License-Identifier: GPL-3.0-or-later
/** Where screenshots go: assets/docs/screenshots/<surface>/<theme>/<scale>x/<name>.png. */
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const THEMES = ['dark', 'light'] as const;
export const SCALES = [1, 2] as const;

export const shotPath = (surface: string, theme: string, scale: number, name: string): string =>
  `${ROOT}assets/docs/screenshots/${surface}/${theme}/${String(scale)}x/${name}.png`;
