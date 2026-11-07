// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * HTML character reference operations (PRD §3.8 Alpha; semantics in spec/README.md).
 *
 * Named references come from the pinned WHATWG list compiled by scripts/html/build.py.
 * Decoding follows the HTML tokenizer's character-reference state for text content.
 * A port of `unichef/core/ops/html.py`.
 */

import { loadData } from '../data/load.js';
import { REPLACEMENT } from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import { CHECK_EVERY, W1252_DECODE } from './encoding.js';
import { boolArg, defineOp, enumArg, type Operation } from './types.js';

const SPECIAL = new Set('&<>"\'');
const ASCII_END = 0x80;
const MAX_CODE_POINT = 0x10ffff;
/** 0x10FFFF has 7 hex digits; more significant digits are out of range. */
const MAX_DIGITS = 7;
const NUMERIC = /#(?:([xX])([0-9a-fA-F]+)|([0-9]+))(;?)/y;
const UNKNOWN_NAMED = /[0-9A-Za-z]+;/y;

interface EntityTable {
  /** Reference name (without `&`) to replacement text, legacy names included. */
  readonly entities: ReadonlyMap<string, string>;
  readonly longest: number;
  /** Character to its preferred name: shortest, then greatest in code-point order. */
  readonly names: ReadonlyMap<string, string>;
}

let table: Promise<EntityTable> | undefined;

async function buildTable(): Promise<EntityTable> {
  const raw = (await loadData('html-entities.json.gz')) as {
    entities: Record<string, number[]>;
  };
  const entities = new Map<string, string>();
  const names = new Map<string, string>();
  let longest = 0;
  for (const [name, cps] of Object.entries(raw.entities)) {
    const text = String.fromCodePoint(...cps);
    entities.set(name, text);
    longest = Math.max(longest, name.length);
    if (cps.length !== 1 || !name.endsWith(';')) {
      continue;
    }
    const held = names.get(text);
    if (
      held === undefined ||
      name.length < held.length ||
      (name.length === held.length && held < name)
    ) {
      names.set(text, name);
    }
  }
  return { entities, longest, names };
}

function entityTable(): Promise<EntityTable> {
  table ??= buildTable().catch((exc: unknown) => {
    table = undefined;
    throw exc;
  });
  return table;
}

const bad = (what: string): UniChefError => new UniChefError('E_DECODE', what);

function numeric(value: number, ref: string, strict: boolean): string {
  if (value === 0 || value > MAX_CODE_POINT || (value >= 0xd800 && value <= 0xdfff)) {
    if (strict) {
      throw bad(`&${ref} is not a valid character reference.`);
    }
    return REPLACEMENT;
  }
  return value >= 0x80 && value < 0xa0 ? (W1252_DECODE[value] ?? '') : String.fromCodePoint(value);
}

/** Decode the reference whose `&` is at `i`; null leaves the `&` literal. */
function reference(
  text: string,
  i: number,
  strict: boolean,
  t: EntityTable,
): [string, number] | null {
  const start = i + 1;
  NUMERIC.lastIndex = start;
  const m = NUMERIC.exec(text);
  if (m) {
    const [, hexMark, hexDigits, decDigits, semicolon] = m;
    const end = NUMERIC.lastIndex;
    const ref = text.slice(start, end);
    if (strict && !semicolon) {
      throw bad(`&${ref} is missing its semicolon.`);
    }
    const digits = (hexDigits ?? decDigits ?? '').replace(/^0+/, '');
    const value =
      digits.length > MAX_DIGITS
        ? MAX_CODE_POINT + 1
        : Number.parseInt(digits || '0', hexMark ? 16 : 10);
    return [numeric(value, ref, strict), end];
  }
  for (let length = Math.min(t.longest, text.length - start); length > 0; length -= 1) {
    const name = text.slice(start, start + length);
    const found = t.entities.get(name);
    if (found !== undefined) {
      if (strict && !name.endsWith(';')) {
        throw bad(`&${name} is missing its semicolon.`);
      }
      return [found, start + length];
    }
  }
  if (strict) {
    UNKNOWN_NAMED.lastIndex = start;
    const unknown = UNKNOWN_NAMED.exec(text);
    if (unknown) {
      throw bad(`&${unknown[0]} is not a known character reference.`);
    }
  }
  return null;
}

export const htmlEntityDecode = defineOp({
  id: 'html-entity-decode',
  name: 'HTML Entity Decode',
  category: 'Encoding',
  description:
    'Decode named and numeric character references as HTML does in text content: the ' +
    'longest known name wins, legacy names may omit the semicolon, numeric references ' +
    'may omit it, 0x80-0x9F map through windows-1252, and 0, surrogates and values ' +
    'above 10FFFF become U+FFFD. An `&` that starts no reference stays as it is. ' +
    '`strict` fails on a missing semicolon, an unknown name or an invalid code point ' +
    'instead.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    { input: '&lt;p&gt;caf&eacute; &#x1F44B;&lt;/p&gt;', args: {}, output: '<p>café 👋</p>' },
  ],
  args: [boolArg('strict')],
  async run(text, args, ctx) {
    const t = await entityTable();
    const strict = args.flag('strict');
    const out: string[] = [];
    let done = 0;
    let i = text.indexOf('&');
    let checked = 0;
    while (i !== -1) {
      if (i - checked >= CHECK_EVERY) {
        ctx.check();
        checked = i;
      }
      const decoded = reference(text, i, strict, t);
      if (decoded === null) {
        i = text.indexOf('&', i + 1);
        continue;
      }
      out.push(text.slice(done, i), decoded[0]);
      done = decoded[1];
      i = text.indexOf('&', done);
    }
    out.push(text.slice(done));
    return out.join('');
  },
});

export const htmlEntityEncode = defineOp({
  id: 'html-entity-encode',
  name: 'HTML Entity Encode',
  category: 'Encoding',
  description:
    'Replace characters with references. `scope` is the five HTML-special characters ' +
    '`& < > " \'`, those plus every non-ASCII character, or all characters. `named` ' +
    'uses the shortest name ending in `;` (hex where there is none); astral characters ' +
    'get one reference each.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '<p>café</p>', args: {}, output: '&lt;p&gt;café&lt;/p&gt;' }],
  args: [
    enumArg('scope', ['special', 'non-ascii', 'all']),
    enumArg('format', ['named', 'decimal', 'hex']),
  ],
  async run(text, args, ctx) {
    ctx.check();
    const scope = args.text('scope');
    const fmt = args.text('format');
    const names = fmt === 'named' ? (await entityTable()).names : new Map<string, string>();
    const out: string[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 0;
      if (scope === 'all' || SPECIAL.has(ch) || (scope === 'non-ascii' && cp >= ASCII_END)) {
        const name = names.get(ch);
        if (name !== undefined) {
          out.push(`&${name}`);
        } else if (fmt === 'decimal') {
          out.push(`&#${String(cp)};`);
        } else {
          out.push(`&#x${cp.toString(16).toUpperCase()};`);
        }
      } else {
        out.push(ch);
      }
    }
    return out.join('');
  },
});

export const HTML_OPS: readonly Operation[] = [htmlEntityDecode, htmlEntityEncode];
