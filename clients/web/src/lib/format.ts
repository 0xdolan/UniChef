// SPDX-License-Identifier: GPL-3.0-or-later
/** Text renderings of dishes and inputs for the workbench. */

import { formatFloat, jsonDumps, makeDish, tableToTsv, type Dish } from '@unichef/core';

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export function codePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

// Control, format, separator, private-use, unassigned and default-ignorable code points, and
// white space other than U+0020. The core labels the same classes in its tables.
const INVISIBLE =
  /[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]|(?! )\p{White_Space}|\p{Cs}/gu;

/**
 * `text` with invisible and control characters replaced by `⟨U+XXXX⟩` labels, for table
 * cells, so a raw bidi control cannot reorder what is around it (NFR-041).
 */
export function visible(text: string): string {
  return text.replace(INVISIBLE, (ch) => `⟨${codePoint(ch.codePointAt(0) ?? 0)}⟩`);
}

/** The dish as text: bytes as UTF-8 when valid, otherwise hex. */
export function dishText(dish: Dish): string {
  switch (dish.type) {
    case 'bytes':
      try {
        return strictUtf8.decode(dish.value);
      } catch {
        return hex(dish.value);
      }
    case 'string':
      return dish.value;
    case 'integer':
      return dish.value.toString();
    case 'float':
      return formatFloat(dish.value);
    case 'json':
      return jsonDumps(dish.value);
    case 'codepoints':
      return dish.value.map(codePoint).join(' ');
    case 'table':
      return tableToTsv(dish.value);
  }
}

/** How the input text box is read (`f` in the shared URL, PRD §6.4). */
export type InputFormat = 'text' | 'hex' | 'base64';
export const INPUT_FORMATS: readonly InputFormat[] = ['text', 'hex', 'base64'];

export class InputError extends Error {}

/** The input dish: text stays a string; hex and Base64 become bytes. */
export function inputDish(text: string, format: InputFormat): Dish {
  switch (format) {
    case 'text':
      return makeDish('string', text);
    case 'hex': {
      const digits = text.replace(/\s+/g, '');
      if (!/^(?:[0-9a-fA-F]{2})*$/.test(digits)) {
        throw new InputError('Hex input must be pairs of hex digits.');
      }
      return makeDish(
        'bytes',
        Uint8Array.from(digits.match(/../g) ?? [], (h) => parseInt(h, 16)),
      );
    }
    case 'base64': {
      const clean = text.replace(/\s+/g, '');
      try {
        return makeDish(
          'bytes',
          Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)),
        );
      } catch {
        throw new InputError('The input is not valid Base64.');
      }
    }
  }
}

/** Human-readable size of a dish, from `dishSize`. */
export function sizeLabel(type: Dish['type'], size: number): string {
  switch (type) {
    case 'bytes':
      return `${size} B`;
    case 'string':
    case 'codepoints':
      return `${size} ch`;
    case 'table':
      return `${size} cells`;
    case 'integer':
    case 'float':
    case 'json':
      return '';
  }
}
