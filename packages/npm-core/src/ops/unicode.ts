// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Unicode operations (PRD §3.8 Alpha, §4.4-4.6; semantics in spec/README.md).
 *
 * Every property, name, mapping and boundary comes from the pinned UCD artefacts through
 * `src/unicode`; the host's tables are never consulted.
 */

import type { Cell, Table } from '../dish/types.js';
import * as utf8 from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import * as caseMap from '../unicode/case.js';
import * as confusables from '../unicode/confusables.js';
import { ready, toCodePoints } from '../unicode/data.js';
import * as names from '../unicode/names.js';
import * as normalize from '../unicode/normalize.js';
import * as props from '../unicode/props.js';
import * as segment from '../unicode/segment.js';
import { boolArg, defineOp, enumArg, pyRepr, stringArg, type Operation } from './types.js';

const ASCII_END = 0x80;
const SPACE = 0x20;
const SUPPLEMENTARY = 0x10000;
const MAX_CODE_POINT = 0x10ffff;
const TAGS_START = 0xe0000;
const TAGS_END = 0xe0080;
const DOTTED_CIRCLE = '◌';
const ZERO_WIDTH = new Set([0x180e, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);
const HIDDEN_GC = new Set(['Cc', 'Cf', 'Cs', 'Co', 'Cn', 'Zl', 'Zp']);
const NONSPACING = new Set(['Mn', 'Me']);

const isHigh = (v: number): boolean => v >= 0xd800 && v < 0xdc00;
const isLow = (v: number): boolean => v >= 0xdc00 && v < 0xe000;
const isSurrogate = (v: number): boolean => v >= 0xd800 && v < 0xe000;

/** Upper-case hex, zero-padded to `width`. */
export const hex = (n: number, width = 4): string =>
  n.toString(16).toUpperCase().padStart(width, '0');

/** The first `n` code points of `s`, for error messages (Python `s[:n]`). */
const head = (s: string, n: number): string => Array.from(s).slice(0, n).join('');

function bad(message: string): UniChefError {
  return new UniChefError('E_DECODE', message);
}

function utf16(cp: number): number[] {
  if (cp < SUPPLEMENTARY) {
    return [cp];
  }
  const v = cp - SUPPLEMENTARY;
  return [0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff)];
}

/** A one-code-point string; lone surrogates stay lone. */
const chr = (cp: number): string => String.fromCodePoint(cp);

// ---------------------------------------------------------------------------
// escape-unicode / unescape-unicode

export const ESCAPE_FORMATS = [
  'backslash-u', // \uXXXX, UTF-16 units
  'backslash-u-braces', // \u{X}
  'backslash-big-u', // \UXXXXXXXX
  'u-plus', // U+XXXX
  'html-hex', // &#xX;
  'html-decimal', // &#D;
  'percent-u', // %uXXXX, UTF-16 units
] as const;

const ESCAPERS: Record<string, (cp: number) => string> = {
  'backslash-u': (cp) =>
    utf16(cp)
      .map((u) => `\\u${hex(u)}`)
      .join(''),
  'backslash-u-braces': (cp) => `\\u{${hex(cp, 1)}}`,
  'backslash-big-u': (cp) => `\\U${hex(cp, 8)}`,
  'u-plus': (cp) => `U+${hex(cp)}`,
  'html-hex': (cp) => `&#x${hex(cp, 1)};`,
  'html-decimal': (cp) => `&#${String(cp)};`,
  'percent-u': (cp) =>
    utf16(cp)
      .map((u) => `%u${hex(u)}`)
      .join(''),
};

// Alternatives in priority order: \u{…} must be tried before \uXXXX.
const UNESCAPE_PATTERNS: Record<string, string> = {
  'backslash-u-braces': String.raw`\\u\{([0-9A-Fa-f]{1,6})\}`,
  'backslash-u': String.raw`\\u([0-9A-Fa-f]{4})`,
  'backslash-big-u': String.raw`\\U([0-9A-Fa-f]{8})`,
  'u-plus': String.raw`U\+([0-9A-Fa-f]{4,6})`,
  'html-hex': String.raw`&#[xX]([0-9A-Fa-f]{1,6});`,
  'html-decimal': String.raw`&#([0-9]{1,7});`,
  'percent-u': String.raw`%u([0-9A-Fa-f]{4})`,
};
const UTF16_FORMATS = new Set(['backslash-u', 'percent-u']);

function nonPrintable(cp: number): boolean {
  const gc = props.gc(cp);
  return (
    props.GC_GROUPS['C']?.has(gc) === true ||
    gc === 'Zl' ||
    gc === 'Zp' ||
    (gc === 'Zs' && cp !== SPACE) ||
    props.has('Default_Ignorable_Code_Point', cp)
  );
}

const escapeUnicode = defineOp({
  id: 'escape-unicode',
  name: 'Escape Unicode',
  category: 'Unicode',
  description:
    'Write characters as escapes with upper-case hex. `scope` picks every non-ASCII ' +
    'character, every character, or only non-printable ones (categories C, Zl, Zp, Zs ' +
    'other than U+0020, and default-ignorables). `backslash-u` and `percent-u` write ' +
    'astral characters as surrogate pairs.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    { input: 'café 👋', args: {}, output: 'caf\\u00E9 \\uD83D\\uDC4B' },
    { input: 'café 👋', args: { format: 'html-hex' }, output: 'caf&#xE9; &#x1F44B;' },
  ],
  args: [
    enumArg('format', ESCAPE_FORMATS),
    enumArg('scope', ['non-ascii', 'all', 'non-printable']),
  ],
  async run(text, args, ctx) {
    ctx.check();
    await ready('core');
    const escape = ESCAPERS[args.text('format')] as (cp: number) => string;
    const scope = args.text('scope');
    const picked =
      scope === 'all'
        ? (): boolean => true
        : scope === 'non-ascii'
          ? (cp: number): boolean => cp >= ASCII_END
          : nonPrintable;
    let out = '';
    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 0;
      out += picked(cp) ? escape(cp) : ch;
    }
    return out;
  },
});

const unescapeUnicode = defineOp({
  id: 'unescape-unicode',
  name: 'Unescape Unicode',
  category: 'Unicode',
  description:
    'Replace escapes with characters; `all` recognises every format. Adjacent UTF-16 ' +
    'escapes of one format combine into a pair; a lone surrogate becomes U+FFFD, and an ' +
    'escape above 10FFFF is left as it is.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'caf\\u00e9 \\U0001F44B', args: {}, output: 'café 👋' }],
  args: [enumArg('format', ['all', ...ESCAPE_FORMATS])],
  run(text, args, ctx) {
    ctx.check();
    const chosen = args.text('format');
    const formats = Object.keys(UNESCAPE_PATTERNS).filter((f) => chosen === 'all' || chosen === f);
    const pattern = new RegExp(
      formats.map((f) => `(?:${UNESCAPE_PATTERNS[f] ?? ''})`).join('|'),
      'g',
    );
    const out: string[] = [];
    let done = 0;
    // format, value, end of a high surrogate
    let pending: [string, number, number] | null = null;
    for (const match of text.matchAll(pattern)) {
      const index = match.slice(1).findIndex((g: string | undefined) => g !== undefined);
      const fmt = formats[index] ?? '';
      const value = parseInt(match[index + 1] ?? '', fmt === 'html-decimal' ? 10 : 16);
      const start = match.index;
      const end = start + match[0].length;
      if (pending !== null && (pending[0] !== fmt || pending[2] !== start || !isLow(value))) {
        out.push(utf8.REPLACEMENT);
        pending = null;
      }
      out.push(text.slice(done, start));
      done = end;
      if (value > MAX_CODE_POINT) {
        out.push(match[0]);
      } else if (pending !== null) {
        out.push(chr(SUPPLEMENTARY + ((pending[1] - 0xd800) << 10) + (value - 0xdc00)));
        pending = null;
      } else if (isHigh(value) && UTF16_FORMATS.has(fmt)) {
        pending = [fmt, value, end];
      } else if (isSurrogate(value)) {
        out.push(utf8.REPLACEMENT);
      } else {
        out.push(chr(value));
      }
    }
    if (pending !== null) {
      out.push(utf8.REPLACEMENT);
    }
    out.push(text.slice(done));
    return out.join('');
  },
});

// ---------------------------------------------------------------------------
// normalize, case, strip-diacritics, grapheme-split

const normalizeOp = defineOp({
  id: 'normalize',
  name: 'Normalize',
  category: 'Unicode',
  description: 'Apply a Unicode normalization form (UAX #15) from the pinned UCD.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'ﬁ ① Ｘ²', args: { form: 'NFKC' }, output: 'fi 1 X2' }],
  args: [enumArg('form', normalize.FORMS)],
  async run(text, args, ctx) {
    await ready('core');
    return normalize.normalize(args.text('form') as normalize.Form, text, ctx.check);
  },
});

const unicodeCase = defineOp({
  id: 'unicode-case',
  name: 'Unicode Case',
  category: 'Unicode',
  description:
    'Full case mapping with Final_Sigma and the `tr`, `az` and `lt` tailorings. `fold` ' +
    'is full case folding, or simple folding with `simple` (ignored by other modes).',
  inputType: 'string',
  outputType: 'string',
  examples: [
    { input: 'straße', args: { mode: 'upper' }, output: 'STRASSE' },
    { input: 'İstanbul', args: { mode: 'lower', locale: 'tr' }, output: 'istanbul' },
  ],
  args: [
    enumArg('mode', ['upper', 'lower', 'title', 'fold']),
    enumArg('locale', caseMap.LOCALES),
    boolArg('simple'),
  ],
  async run(text, args, ctx) {
    ctx.check();
    await ready('core');
    const mode = args.text('mode');
    const locale = args.text('locale') as caseMap.Locale;
    if (mode === 'fold') {
      return caseMap.fold(text, { simple: args.flag('simple'), locale });
    }
    return caseMap.convert(
      text,
      mode === 'title' ? 'titlecase' : (mode as caseMap.Mapping),
      locale,
    );
  },
});

function isDiacriticMark(cp: number): boolean {
  return (
    props.gc(cp) === 'Mn' && props.sc(cp) === confusables.INHERITED && props.has('Diacritic', cp)
  );
}

const stripDiacritics = defineOp({
  id: 'strip-diacritics',
  name: 'Strip Diacritics',
  category: 'Unicode',
  description:
    'NFD, then drop nonspacing marks that are Diacritic and of the Inherited script, ' +
    'then NFC. Script-specific marks such as the Devanagari virama are kept, and letters ' +
    'with no decomposition (ø, ł) are unchanged.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Crème brûlée', args: {}, output: 'Creme brulee' }],
  async run(text, _args, ctx) {
    await ready('core');
    const decomposed = normalize.normalize('NFD', text, ctx.check);
    const kept = Array.from(decomposed)
      .filter((ch) => !isDiacriticMark(ch.codePointAt(0) ?? 0))
      .join('');
    return normalize.normalize('NFC', kept, ctx.check);
  },
});

const graphemeSplit = defineOp({
  id: 'grapheme-split',
  name: 'Grapheme Split',
  category: 'Unicode',
  description: 'Join the extended grapheme clusters (UAX #29) with `delimiter`.',
  inputType: 'string',
  outputType: 'string',
  examples: [
    { input: 'e\u0301👋\u{1f3fd}🇮🇶', args: { delimiter: ' ' }, output: 'e\u0301 👋\u{1f3fd} 🇮🇶' },
  ],
  args: [stringArg('delimiter', '\n')],
  async run(text, args, ctx) {
    await ready('core');
    return segment.graphemes(text, ctx.check).join(args.text('delimiter'));
  },
});

// ---------------------------------------------------------------------------
// Code points and counting

const CODE_POINT_FORMATS: Record<string, (cp: number) => string> = {
  'u-plus': (cp) => `U+${hex(cp)}`,
  hex: (cp) => hex(cp),
  '0x': (cp) => `0x${hex(cp)}`,
  decimal: (cp) => String(cp),
};
const CODE_POINT_DELIMITERS: Record<string, string> = { space: ' ', comma: ',', newline: '\n' };
const CODE_POINT_SEPARATORS = /[\t\n\v\f\r ,;]+/;
const CODE_POINT_TOKEN = /^(?:([Uu]\+|0[xX])([0-9A-Fa-f]{1,6})|([0-9A-Fa-f]{1,7}))$/;

const toCodePointsOp = defineOp({
  id: 'to-code-points',
  name: 'To Code Points',
  category: 'Unicode',
  description: 'Write each code point as `U+0041`, `0041`, `0x0041` or `65`.',
  inputType: 'codepoints',
  outputType: 'string',
  examples: [{ input: 'Hi 👋', args: {}, output: 'U+0048 U+0069 U+0020 U+1F44B' }],
  args: [
    enumArg('format', Object.keys(CODE_POINT_FORMATS)),
    enumArg('delimiter', Object.keys(CODE_POINT_DELIMITERS)),
  ],
  run(cps, args, ctx) {
    ctx.check();
    const fmt = CODE_POINT_FORMATS[args.text('format')] as (cp: number) => string;
    return cps.map(fmt).join(CODE_POINT_DELIMITERS[args.text('delimiter')]);
  },
});

const fromCodePointsOp = defineOp({
  id: 'from-code-points',
  name: 'From Code Points',
  category: 'Unicode',
  description:
    'Read code points separated by whitespace, commas or semicolons. A `U+` or `0x` ' +
    'prefix always means hex; bare numbers use `base`. Surrogates are kept as code points ' +
    '(they become U+FFFD if the dish is later used as text).',
  inputType: 'string',
  outputType: 'codepoints',
  examples: [
    { input: '48 69 1F44B', args: {}, output: 'U+0048 U+0069 U+1F44B' },
    { input: '72 105 128075', args: { base: 'decimal' }, output: 'U+0048 U+0069 U+1F44B' },
  ],
  args: [enumArg('base', ['hex', 'decimal'])],
  run(text, args, ctx) {
    ctx.check();
    const decimal = args.text('base') === 'decimal';
    const out: number[] = [];
    for (const token of text.split(CODE_POINT_SEPARATORS)) {
      if (token === '') {
        continue;
      }
      const match = CODE_POINT_TOKEN.exec(token);
      if (match === null) {
        throw bad(`${pyRepr(head(token, 16))} is not a code point.`);
      }
      let value: number;
      if (match[2] !== undefined) {
        value = parseInt(match[2], 16);
      } else {
        const digits = match[3] ?? '';
        if (decimal && !/^[0-9]+$/.test(digits)) {
          throw bad(`${pyRepr(head(token, 16))} is not a decimal code point.`);
        }
        value = parseInt(digits, decimal ? 10 : 16);
      }
      if (value > MAX_CODE_POINT) {
        throw bad(`${pyRepr(head(token, 16))} is above U+10FFFF.`);
      }
      out.push(value);
    }
    return out;
  },
});

export const COUNT_UNITS = ['bytes', 'utf16-units', 'code-points', 'graphemes', 'lines'] as const;

const count = defineOp({
  id: 'count',
  name: 'Count',
  category: 'Unicode',
  description:
    'Count bytes, or decode UTF-8 (U+FFFD for ill-formed input) and count UTF-16 ' +
    'units, code points, grapheme clusters or lines (LF-separated; a final LF does not ' +
    'start a new line).',
  inputType: 'bytes',
  outputType: 'integer',
  examples: [
    { input: 'e\u0301👋\u{1f3fd}', args: { unit: 'graphemes' }, output: '2' },
    { input: 'e\u0301👋\u{1f3fd}', args: { unit: 'code-points' }, output: '4' },
    { input: 'e\u0301👋\u{1f3fd}', args: { unit: 'bytes' }, output: '11' },
  ],
  args: [enumArg('unit', COUNT_UNITS, 'code-points')],
  async run(data, args, ctx) {
    const unit = args.text('unit');
    if (unit === 'bytes') {
      return BigInt(data.length);
    }
    const text = utf8.decode(data, ctx.check);
    if (unit === 'utf16-units') {
      return BigInt(text.length);
    }
    const cps = toCodePoints(text);
    if (unit === 'code-points') {
      return BigInt(cps.length);
    }
    if (unit === 'graphemes') {
      await ready('core');
      return BigInt(Math.max(0, segment.boundaries(cps, ctx.check).length - 1));
    }
    if (text === '') {
      return 0n;
    }
    const lf = text.split('\n').length - 1;
    return BigInt(lf + (text.endsWith('\n') ? 0 : 1));
  },
});

// ---------------------------------------------------------------------------
// analyse-characters (PRD §4.6)

export const ANALYSIS_COLUMNS = [
  'index', 'cp', 'char', 'name', 'gc', 'block', 'script', 'scx', 'age',
  'bidi', 'ea', 'utf8', 'utf16', 'decomposition', 'flags',
] as const; // prettier-ignore
export const FLAG_ORDER = [
  'bidi-control', 'zero-width', 'default-ignorable', 'tag', 'variation-selector',
  'private-use', 'noncharacter', 'surrogate', 'unassigned', 'confusable', 'mixed-script',
] as const; // prettier-ignore

type Column = (typeof ANALYSIS_COLUMNS)[number];

function display(cp: number, first = true): string {
  const gc = props.gc(cp);
  if (
    HIDDEN_GC.has(gc) ||
    props.has('White_Space', cp) ||
    props.has('Default_Ignorable_Code_Point', cp)
  ) {
    return `⟨${names.preferred(cp).replace(/^[<>]+|[<>]+$/g, '')}⟩`;
  }
  if (first && NONSPACING.has(gc)) {
    return DOTTED_CIRCLE + chr(cp);
  }
  return chr(cp);
}

/**
 * Mark characters outside the most frequent script of a mixed-script text (UTS #39
 * resolved script set empty). The majority counts Script values other than Common and
 * Inherited; a tie goes to the smallest script code.
 */
function foreignScripts(cps: readonly number[], text: string): (cp: number) => boolean {
  const resolved = confusables.resolvedScriptSet(text);
  if (resolved?.size !== 0) {
    return () => false;
  }
  const counts = new Map<string, number>();
  for (const cp of cps) {
    const sc = props.sc(cp);
    if (sc !== confusables.COMMON && sc !== confusables.INHERITED) {
      counts.set(sc, (counts.get(sc) ?? 0) + 1);
    }
  }
  let majority: string | null = null;
  let best = 0;
  for (const [sc, n] of counts) {
    if (n > best || (n === best && majority !== null && sc < majority)) {
      majority = sc;
      best = n;
    }
  }
  if (majority === null) {
    return () => false; // only Common/Inherited characters with disjoint Script_Extensions
  }
  const winner = majority;
  return (cp) => {
    const scripts = confusables.augmentedScripts(cp);
    return scripts !== null && !scripts.has(winner);
  };
}

function flags(cp: number, foreign: (cp: number) => boolean): string[] {
  const gc = props.gc(cp);
  const noncharacter = props.has('Noncharacter_Code_Point', cp);
  const found: Record<(typeof FLAG_ORDER)[number], boolean> = {
    'bidi-control': props.has('Bidi_Control', cp),
    'zero-width': ZERO_WIDTH.has(cp),
    'default-ignorable': props.has('Default_Ignorable_Code_Point', cp),
    tag: cp >= TAGS_START && cp < TAGS_END,
    'variation-selector': props.has('Variation_Selector', cp),
    'private-use': gc === 'Co',
    noncharacter,
    surrogate: gc === 'Cs',
    unassigned: gc === 'Cn' && !noncharacter,
    confusable: confusables.prototype(cp) !== null,
    'mixed-script': foreign(cp),
  };
  return FLAG_ORDER.filter((flag) => found[flag]);
}

function columns(cp: number, foreign: (cp: number) => boolean): Record<Column, string> {
  const decomposition = normalize.decomposition(cp);
  let decomp = '';
  if (decomposition !== null) {
    const [tag, parts] = decomposition;
    decomp = [...(tag !== '' ? [tag] : []), ...parts.map((p) => hex(p))].join(' ');
  }
  return {
    index: '',
    char: '',
    cp: `U+${hex(cp)}`,
    name: names.preferred(cp),
    gc: props.gc(cp),
    block: props.block(cp),
    script: props.sc(cp),
    scx: props.scx(cp).join(' '),
    age: String(props.get('age', cp)),
    bidi: String(props.get('bc', cp)),
    ea: String(props.get('ea', cp)),
    utf8: Array.from(utf8.encode(chr(cp)), (b) => hex(b, 2)).join(' '),
    utf16: utf16(cp)
      .map((u) => hex(u))
      .join(' '),
    decomposition: decomp,
    flags: flags(cp, foreign).join(','),
  };
}

const analyseCharacters = defineOp({
  id: 'analyse-characters',
  name: 'Analyse Characters',
  category: 'Unicode',
  description:
    'One row per code point (or grapheme cluster) with the columns of PRD §4.6. In ' +
    'grapheme mode `index` is the inclusive code-point range `start-end`, per-code-point ' +
    'values are joined with ` + `, bytes and units with a space, and flags are merged.',
  inputType: 'string',
  outputType: 'table',
  examples: [
    {
      input: 'e\u0301👋\u{1f3fd}',
      args: {},
      output:
        'index\tcp\tchar\tname\tgc\tblock\tscript\tscx\tage\tbidi\tea\tutf8\tutf16\tdecomposition\tflags\n0\tU+0065\te\tLATIN SMALL LETTER E\tLl\tBasic Latin\tLatn\tLatn\t1.1\tL\tNa\t65\t0065\t\t\n1\tU+0301\t◌\u0301\tCOMBINING ACUTE ACCENT\tMn\tCombining Diacritical Marks\tZinh\tCher Cyrl Grek Latn Osge Sunu Tale Todr\t1.1\tNSM\tA\tCC 81\t0301\t\t\n2\tU+1F44B\t👋\tWAVING HAND SIGN\tSo\tMiscellaneous Symbols and Pictographs\tZyyy\tZyyy\t6.0\tON\tW\tF0 9F 91 8B\tD83D DC4B\t\t\n3\tU+1F3FD\t\u{1f3fd}\tEMOJI MODIFIER FITZPATRICK TYPE-4\tSk\tMiscellaneous Symbols and Pictographs\tZyyy\tZyyy\t8.0\tON\tW\tF0 9F 8F BD\tD83C DFFD\t\t',
    },
  ],
  args: [enumArg('granularity', ['codepoint', 'grapheme'])],
  async run(text, args, ctx): Promise<Table> {
    await ready();
    const cps = toCodePoints(text);
    const foreign = foreignScripts(cps, text);
    const rows: Cell[][] = [];
    if (args.text('granularity') === 'codepoint') {
      cps.forEach((cp, i) => {
        if (i % 4096 === 0) {
          ctx.check();
        }
        const cols = columns(cp, foreign);
        rows.push([i, cols.cp, display(cp), ...ANALYSIS_COLUMNS.slice(3).map((c) => cols[c])]);
      });
      return { columns: ANALYSIS_COLUMNS, rows };
    }
    let start = 0;
    const edges = segment.boundaries(cps, ctx.check);
    for (let k = 1; k < edges.length; k++) {
      ctx.check();
      const cluster = cps.slice(edges[k - 1], edges[k]);
      const each = cluster.map((cp) => columns(cp, foreign));
      const merged: Partial<Record<Column, string>> = {
        index: `${String(start)}-${String(start + cluster.length - 1)}`,
        cp: each.map((c) => c.cp).join(' '),
        char: cluster.map((cp, i) => display(cp, i === 0)).join(''),
      };
      for (const column of ANALYSIS_COLUMNS.slice(3)) {
        const values = each.map((c) => c[column]);
        if (column === 'utf8' || column === 'utf16') {
          merged[column] = values.join(' ');
        } else if (column === 'flags') {
          const present = new Set(values.flatMap((v) => v.split(',')).filter((f) => f !== ''));
          merged[column] = FLAG_ORDER.filter((f) => present.has(f)).join(',');
        } else {
          // keep one slot per code point, but leave an all-empty column empty
          merged[column] = values.some((v) => v !== '') ? values.join(' + ') : '';
        }
      }
      rows.push(ANALYSIS_COLUMNS.map((c) => merged[c] ?? ''));
      start += cluster.length;
    }
    return { columns: ANALYSIS_COLUMNS, rows };
  },
});

export const UNICODE_OPS: readonly Operation[] = [
  escapeUnicode,
  unescapeUnicode,
  normalizeOp,
  unicodeCase,
  stripDiacritics,
  graphemeSplit,
  toCodePointsOp,
  fromCodePointsOp,
  count,
  analyseCharacters,
];
