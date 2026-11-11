// SPDX-License-Identifier: GPL-3.0-or-later
/** The Unicode engine: properties, names, case, normalization, segmentation, UTS #39, queries. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { UniChefError } from '../src/errors.js';
import {
  caseMap as kase,
  confusables,
  data,
  names,
  normalize,
  props,
  query as q,
  ready,
  segment,
} from '../src/unicode/index.js';

const UCD = fileURLToPath(new URL('../../../data/ucd/18.0.0/', import.meta.url));

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof UniChefError) {
      return e.code;
    }
    throw e;
  }
  return 'no error';
}

const hex = (field: string): number[] =>
  field
    .trim()
    .split(/\s+/)
    .filter((h) => h !== '')
    .map((h) => parseInt(h, 16));

const str = (cps: readonly number[]): string => String.fromCodePoint(...cps);

beforeAll(async () => {
  await ready('core', 'names', 'security');
});

describe('data', () => {
  it('does range set algebra', () => {
    const a: data.Ranges = [
      [0, 9],
      [20, 29],
    ];
    expect(data.intersect(a, [[5, 24]])).toEqual([
      [5, 9],
      [20, 24],
    ]);
    expect(data.union(a, [[5, 24]])).toEqual([[0, 29]]);
    expect(
      data.merge([
        [3, 4],
        [0, 2],
        [10, 10],
      ]),
    ).toEqual([
      [0, 4],
      [10, 10],
    ]);
    expect(
      data.complement([
        [0, 9],
        [0x10ffff, 0x10ffff],
      ]),
    ).toEqual([[10, 0x10fffe]]);
    expect(data.complement([])).toEqual([[0, data.MAX_CODE_POINT]]);
    expect([...data.codePoints([[1, 3]])]).toEqual([1, 2, 3]);
    expect(data.contains(a, 25)).toBe(true);
    expect(data.contains(a, 15)).toBe(false);
    expect(data.contains([], 0)).toBe(false);
  });

  it('includes default gaps in rangesWhere', () => {
    const table = new data.RangeTable({ default: 'x', values: ['a'], ranges: [10, 5, 0] });
    expect(table.get(9)).toBe('x');
    expect(table.get(12)).toBe('a');
    expect(table.rangesWhere(new Set(['x']))).toEqual([
      [0, 9],
      [15, 0x10ffff],
    ]);
    expect(table.rangesWhere(new Set(['a']))).toEqual([[10, 14]]);
    const set = new data.RangeSet([5, 3]);
    expect(set.has(7)).toBe(true);
    expect(set.has(8)).toBe(false);
    expect(set.ranges()).toEqual([[5, 7]]);
  });

  it('converts code points, lone surrogates included', () => {
    expect(data.toCodePoints('a\u{1F600}\ud800')).toEqual([0x61, 0x1f600, 0xd800]);
    expect(data.fromCodePoints([0x61, 0x1f600, 0xd800])).toBe('a\u{1F600}\ud800');
    const long = Array.from({ length: 20_000 }, () => 0x1f600);
    expect(data.fromCodePoints(long)).toBe('\u{1F600}'.repeat(20_000));
  });

  it('memoises', () => {
    let calls = 0;
    const sq = data.memo((n: number) => {
      calls++;
      return n * n;
    });
    expect(sq(3) + sq(3)).toBe(18);
    expect(calls).toBe(1);
    expect(data.floorIndex([1, 3, 5], 0)).toBe(-1);
    expect(data.floorIndex([1, 3, 5], 4)).toBe(1);
    expect(data.lowerBound([1, 3, 5], 3)).toBe(1);
  });
});

describe('props', () => {
  it.each([
    [0x41, 'Lu', 'Latn', 'Basic Latin', '1.1'],
    [0x0627, 'Lo', 'Arab', 'Arabic', '1.1'],
    [0x1f600, 'So', 'Zyyy', 'Emoticons', '6.1'],
    [0x0378, 'Cn', 'Zzzz', 'Greek and Coptic', 'NA'],
    [0xe000, 'Co', 'Zzzz', 'Private Use Area', '1.1'],
    [0xd800, 'Cs', 'Zzzz', 'High Surrogates', '2.0'],
    [0xe0080, 'Cn', 'Zzzz', 'No_Block', 'NA'],
  ])('U+%s basics', (cp, gc, sc, block, age) => {
    expect(props.gc(cp)).toBe(gc);
    expect(props.sc(cp)).toBe(sc);
    expect(props.block(cp)).toBe(block);
    expect(props.get('age', cp)).toBe(age);
  });

  it('reads other properties', () => {
    expect(props.ccc(0x0301)).toBe(230);
    expect(props.ccc(0x41)).toBe(0);
    expect(props.get('bc', 0x05d0)).toBe('R');
    expect(props.get('bc', 0x05ff)).toBe('R');
    expect(props.get('ea', 0x4e00)).toBe('W');
    expect(props.has('ExtPict', 0x1f600)).toBe(true);
    expect(props.has('White_Space', 0x20)).toBe(true);
    expect(props.has('White_Space', 0x41)).toBe(false);
    expect(props.scx(0x0660)).toEqual(['Arab', 'Thaa', 'Yezi']);
    expect(props.scx(0x41)).toEqual(['Latn']);
    expect(props.binaryNames()).toContain('Alphabetic');
    expect(code(() => props.table('nope'))).toBe('E_INTERNAL');
  });

  it('resolves aliases', () => {
    expect(props.loose(' Is_General-Category ')).toBe('generalcategory');
    expect(props.loose('is')).toBe('is');
    expect(props.resolveProperty('General_Category')).toBe('gc');
    expect(props.resolveProperty('script')).toBe('sc');
    expect(props.resolveProperty('WSpace')).toBe('White_Space');
    expect(props.resolveProperty('Extended_Pictographic')).toBe('ExtPict');
    expect(props.resolveValue('gc', 'uppercase letter')).toBe('Lu');
    expect(props.resolveValue('sc', 'arabic')).toBe('Arab');
    expect(props.resolveValue('blk', 'basic latin')).toBe('Basic_Latin');
    expect(props.resolveValue('ccc', '230')).toBe('230');
    expect(props.isBinary('ExtPict')).toBe(true);
    expect(props.isBinary('gc')).toBe(false);
    expect(code(() => props.resolveProperty('nope'))).toBe('E_ARG_INVALID');
    expect(code(() => props.resolveValue('gc', 'Q'))).toBe('E_ARG_INVALID');
  });

  it('computes ranges', () => {
    const letters = props.rangesFor('gc', 'L');
    expect(data.contains(letters, 0x41)).toBe(true);
    expect(data.contains(letters, 0x01c5)).toBe(true);
    expect(data.contains(letters, 0x30)).toBe(false);
    expect(props.rangesFor('gc', 'Nd')[0]).toEqual([0x30, 0x39]);
    expect(data.contains(props.rangesFor('ccc', '230'), 0x0301)).toBe(true);
    expect(data.contains(props.rangesFor('sc', 'Grek'), 0x03b1)).toBe(true);
    const unassigned = props.rangesFor('gc', 'Cn');
    expect(data.contains(unassigned, 0x0378)).toBe(true);
    expect(data.contains(unassigned, 0x10ffff)).toBe(true);
    const yezi = props.rangesFor('scx', 'Yezi');
    expect(data.contains(yezi, 0x0660)).toBe(true);
    expect(data.contains(yezi, 0x10e80)).toBe(true);
    expect(data.contains(yezi, 0x41)).toBe(false);
    expect(data.contains(props.binaryRanges('Emoji'), 0x1f600)).toBe(true);
  });
});

describe('names', () => {
  it('matches DerivedName.txt and round-trips', () => {
    const lines = readFileSync(`${UCD}extracted/DerivedName.txt`, 'utf8').split('\n');
    let checked = 0;
    for (const line of lines) {
      const body = (line.split('#')[0] ?? '').trim();
      if (body === '') {
        continue;
      }
      const [span = '', name = ''] = body.split(';').map((p) => p.trim());
      const [first = '', last] = span.split('..');
      for (const cp of new Set([parseInt(first, 16), parseInt(last ?? first, 16)])) {
        const want = name.replace('*', cp.toString(16).toUpperCase().padStart(4, '0'));
        expect(names.name(cp)).toBe(want);
        expect(names.lookup(want)).toBe(cp);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30_000);
  });

  it.each([
    [0x07, '<control-0007>'],
    [0xe000, '<private-use-E000>'],
    [0xd800, '<surrogate-D800>'],
    [0xffff, '<noncharacter-FFFF>'],
    [0x0378, '<reserved-0378>'],
    [0x41, 'LATIN CAPITAL LETTER A'],
  ])('labels U+%s', (cp, label) => {
    expect(names.label(cp)).toBe(label);
  });

  it('has aliases and preferred names', () => {
    expect(names.aliases(0x07)).toContainEqual({ alias: 'ALERT', type: 'control' });
    expect(names.preferred(0x07)).toBe('ALERT');
    expect(names.preferred(0x01a2)).toBe('LATIN CAPITAL LETTER GHA');
    expect(names.preferred(0x41)).toBe('LATIN CAPITAL LETTER A');
    expect(names.preferred(0x0378)).toBe('<reserved-0378>');
    expect(names.aliases(0x41)).toEqual([]);
  });

  it.each([
    ['latin small letter a', 0x61],
    ['LATIN_SMALL_LETTER_A', 0x61],
    ['Latin-Small-Letter-A', 0x61],
    ['hangul jungseong o-e', 0x1180],
    ['hangul jungseong oe', 0x116c],
    ['NULL', 0x00],
    ['BEL', 0x07],
    ['hangul syllable gag', 0xac01],
    ['cjk unified ideograph-4e00', 0x4e00],
    ['CJK UNIFIED IDEOGRAPH 4E00', 0x4e00],
    ['tibetan letter -a', 0x0f60],
  ])('looks up %s', (text, cp) => {
    expect(names.lookup(text)).toBe(cp);
  });

  it.each([
    'no such name',
    'CJK UNIFIED IDEOGRAPH-0041',
    'CJK UNIFIED IDEOGRAPH-4E0',
    'CJK UNIFIED IDEOGRAPH-04E00',
  ])('misses %s', (text) => {
    expect(names.lookup(text)).toBeNull();
  });

  it('iterates names and aliases', () => {
    const found = new Map(
      names.iterNames([
        [0x41, 0x42],
        [0xac00, 0xac00],
        [0x4e00, 0x4e00],
      ]),
    );
    expect(found).toEqual(
      new Map([
        [0x41, 'LATIN CAPITAL LETTER A'],
        [0x42, 'LATIN CAPITAL LETTER B'],
        [0xac00, 'HANGUL SYLLABLE GA'],
        [0x4e00, 'CJK UNIFIED IDEOGRAPH-4E00'],
      ]),
    );
    expect([...names.iterNames([[0x378, 0x378]])]).toEqual([]);
    const aliases = [...names.iterAliases([[0x1a2, 0x1a2]])].map(([cp, a]) => [cp, a.alias]);
    expect(aliases).toContainEqual([0x1a2, 'LATIN CAPITAL LETTER GHA']);
  });
});

describe('case', () => {
  it.each([
    ['straße', 'STRASSE', 'straße', 'Straße'],
    ['ﬁx', 'FIX', 'ﬁx', 'Fix'],
    ['ΌΣΟΣ Σ', 'ΌΣΟΣ Σ', 'όσος σ', 'Όσος Σ'],
    ['ǆemal', 'ǄEMAL', 'ǆemal', 'ǅemal'],
    ["o'neil 1st", "O'NEIL 1ST", "o'neil 1st", "O'neil 1st"],
    ['ŉ', 'ʼN', 'ŉ', 'ʼN'],
  ])('maps %s', (text, upper, lower, title) => {
    expect(kase.upper(text)).toBe(upper);
    expect(kase.lower(text)).toBe(lower);
    expect(kase.title(text)).toBe(title);
  });

  it('handles final sigma contexts', () => {
    expect(kase.lower('ΑΣ.')).toBe('ας.');
    expect(kase.lower('Σ')).toBe('σ');
    expect(kase.lower('ΑΣΑ')).toBe('ασα');
    expect(kase.lower("Α'Σ'")).toBe("α'ς'");
  });

  it('applies language-sensitive mappings', () => {
    expect(kase.upper('i', 'tr')).toBe('İ');
    expect(kase.lower('I', 'tr')).toBe('ı');
    expect(kase.lower('İ', 'az')).toBe('i');
    expect(kase.lower('İ', 'tr')).toBe('i');
    expect(kase.lower('İ')).toBe('i̇');
    expect(kase.lower('Ì', 'lt')).toBe('i̇̀');
    expect(kase.lower('Ì', 'lt')).toBe('i̇̀');
    expect(kase.upper('i̇', 'lt')).toBe('I');
    expect(kase.upper('i̇')).toBe('İ');
    expect(kase.lower('I', 'lt')).toBe('i');
    expect(kase.convert('ab cd', 'titlecase')).toBe('Ab Cd');
  });

  it('folds', () => {
    expect(kase.fold('Straße')).toBe('strasse');
    expect(kase.fold('Straße', { simple: true })).toBe('straße');
    expect(kase.fold('ẞ', { simple: true })).toBe('ß');
    expect(kase.fold('ΣΑΣ')).toBe('σασ');
    expect(kase.fold('I')).toBe('i');
    expect(kase.fold('Iİ', { locale: 'tr' })).toBe('ıi');
    expect(kase.fold('ﬁ')).toBe('fi');
    expect(kase.fold('ﬁ', { simple: true })).toBe('ﬁ');
    expect(kase.foldCodePoint(0x41)).toEqual([0x61]);
  });

  it('builds simple fold orbits', () => {
    const orbits = kase.simpleFoldOrbits();
    expect(orbits.get(0x4b)).toEqual([0x4b, 0x6b, 0x212a]);
    expect(orbits.get(0x212a)).toEqual([0x4b, 0x6b, 0x212a]);
    expect(orbits.get(0x3c3)).toEqual([0x3a3, 0x3c2, 0x3c3]);
    expect(orbits.has(0x30)).toBe(false);
  });

  it('agrees with the host for ASCII and Latin-1 letters', () => {
    for (let cp = 0x20; cp < 0x250; cp++) {
      const ch = String.fromCodePoint(cp);
      if (props.gc(cp) === 'Cn' || ch === 'ŉ' || ch === 'İ') {
        continue;
      }
      expect(kase.upper(ch)).toBe(ch.toUpperCase());
      expect(kase.lower(ch)).toBe(ch.toLowerCase());
    }
  });
});

describe('normalize', () => {
  it('decomposes', () => {
    expect(normalize.decomposition(0xac00)).toEqual(['', [0x1100, 0x1161]]);
    expect(normalize.decomposition(0xac01)).toEqual(['', [0xac00, 0x11a8]]);
    expect(normalize.decomposition(0x00bd)).toEqual(['<fraction>', [0x31, 0x2044, 0x32]]);
    expect(normalize.decomposition(0x41)).toBeNull();
    expect(normalize.normalize('NFC', 'abc')).toBe('abc');
    expect(normalize.normalize('NFD', '\ud800é')).toBe('\ud800é');
  });

  it('passes NormalizationTest.txt', () => {
    const text = readFileSync(`${UCD}NormalizationTest.txt`, 'utf8');
    let checked = 0;
    for (const line of text.split('\n')) {
      const body = (line.split('#')[0] ?? '').trim();
      if (body === '' || body.startsWith('@')) {
        continue;
      }
      const [c1, c2, c3, c4, c5] = body.split(';').map((f) => str(hex(f)));
      const nfc = (s: string | undefined): string => normalize.normalize('NFC', s ?? '');
      const nfd = (s: string | undefined): string => normalize.normalize('NFD', s ?? '');
      const nfkc = (s: string | undefined): string => normalize.normalize('NFKC', s ?? '');
      const nfkd = (s: string | undefined): string => normalize.normalize('NFKD', s ?? '');
      for (const s of [c1, c2, c3]) {
        expect(nfc(s)).toBe(c2);
        expect(nfd(s)).toBe(c3);
      }
      for (const s of [c4, c5]) {
        expect(nfc(s)).toBe(c4);
        expect(nfd(s)).toBe(c5);
      }
      for (const s of [c1, c2, c3, c4, c5]) {
        expect(nfkc(s)).toBe(c4);
        expect(nfkd(s)).toBe(c5);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(15_000);
  });
});

describe('segment', () => {
  it('passes GraphemeBreakTest.txt', () => {
    const text = readFileSync(`${UCD}auxiliary/GraphemeBreakTest.txt`, 'utf8');
    let checked = 0;
    for (const line of text.split('\n')) {
      const body = (line.split('#')[0] ?? '').trim();
      if (body === '') {
        continue;
      }
      const cps: number[] = [];
      const want: number[] = [];
      for (const token of body.split(/\s+/)) {
        if (token === '÷') {
          want.push(cps.length);
        } else if (token !== '×') {
          cps.push(parseInt(token, 16));
        }
      }
      expect(segment.boundaries(cps), body).toEqual(want);
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('splits and counts', () => {
    expect(segment.graphemes('éa\u{1F1FA}\u{1F1F8}')).toEqual(['é', 'a', '\u{1F1FA}\u{1F1F8}']);
    expect(segment.count('')).toBe(0);
    expect(segment.boundaries([])).toEqual([]);
    let checks = 0;
    segment.boundaries(new Array<number>(70_000).fill(0x61), () => checks++);
    expect(checks).toBeGreaterThan(0);
  });
});

describe('confusables', () => {
  it('computes skeletons', () => {
    expect(confusables.skeleton('paypal')).toBe(confusables.skeleton('рауpal'));
    expect(confusables.isConfusable('ℌ', 'H')).toBe(true);
    expect(confusables.isConfusable('a', 'b')).toBe(false);
    expect(confusables.prototype(0x210c)).toEqual([0x48]);
    expect(confusables.prototype(0x61)).toBeNull();
    expect(confusables.skeleton('')).toBe('');
  });

  it('reads identifier status and type', () => {
    expect(confusables.identifierStatus(0x61)).toBe('Allowed');
    expect(confusables.identifierStatus(0x07)).toBe('Restricted');
    expect(confusables.identifierTypes(0x61)).toEqual(['Recommended']);
    const coptic = confusables.identifierTypes(0x2c80);
    expect(coptic.includes('Exclusion') || coptic.includes('Obsolete')).toBe(true);
    expect(confusables.identifierTypes(0x0378)).toEqual(['Not_Character']);
  });

  it('resolves script sets', () => {
    expect(confusables.augmentedScripts(0x20)).toBeNull();
    expect(confusables.augmentedScripts(0x4e00)).toEqual(new Set(['Hani', 'Hanb', 'Jpan', 'Kore']));
    expect(confusables.augmentedScripts(0x3042)).toEqual(new Set(['Hira', 'Jpan']));
    expect(confusables.augmentedScripts(0xac00)).toEqual(new Set(['Hang', 'Kore']));
    expect(confusables.augmentedScripts(0x3105)).toEqual(new Set(['Bopo', 'Hanb']));
    expect(confusables.resolvedScriptSet('abc 1')).toEqual(new Set(['Latn']));
    expect(confusables.resolvedScriptSet('aа')).toEqual(new Set());
    expect(confusables.resolvedScriptSet('123')).toBeNull();
    expect(confusables.resolvedScriptSet('漢あ')).toEqual(new Set(['Jpan']));
  });
});

describe('query', () => {
  const range = (lo: number, hi: number): number[] =>
    Array.from({ length: hi - lo }, (_, i) => lo + i);
  const cps = (text: string, limit = 10_000): readonly number[] =>
    q.query(text, { limit }).codePoints;

  it.each<[string, number[] | null]>([
    ['gc=Lu & blk=Basic_Latin', range(0x41, 0x5b)],
    ['gc=Nd & blk=ASCII', range(0x30, 0x3a)],
    ['sc="Greek" & name~/^GREEK CAPITAL LETTER ALPHA$/', [0x391]],
    ['name~/^latin small letter a$/i', [0x61]],
    ['name~/HANGUL SYLLABLE GAG$/', [0xac01]],
    ['name~/^LATIN SMALL LETTER GHA$/', [0x1a3]],
    ['WSpace & blk=ASCII & !(gc=Cc)', [0x20]],
    ['White_Space=No & ccc>=230 & ccc<=230 & blk=Combining_Diacritical_Marks', null],
    ['(gc=Lu | gc=Ll) & blk=ASCII & !Hex_Digit', null],
    ['scx=Grek & sc!=Grek & blk=Combining_Diacritical_Marks', null],
    ['age=1.1 & blk=ASCII', range(0, 0x80)],
    ['age>16.0 & age<=17.0 & blk=Basic_Latin', []],
    ['ExtPict=yes & blk=ASCII', []],
    ['ccc<1 & ccc>0', []],
    ['Emoji=No & Emoji!=Yes & blk=ASCII & gc=Lu', range(0x41, 0x5b)],
    ['gc!=Cn & blk=Basic_Latin & age<2.0 & gc=Zs', [0x20]],
  ])('%s', (text, expected) => {
    const result = cps(text);
    if (expected === null) {
      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual([...new Set(result)].sort((a, b) => a - b));
    } else {
      expect(result).toEqual(expected);
    }
  });

  it('narrows left to right', () => {
    const combining = new Set(cps('ccc=230 & blk=Combining_Diacritical_Marks'));
    expect(combining.size).toBeGreaterThan(0);
    expect([...combining].every((cp) => cp >= 0x300 && cp <= 0x36f)).toBe(true);
    const rest = cps('blk=Combining_Diacritical_Marks & !(ccc=230)');
    expect(rest.some((cp) => combining.has(cp))).toBe(false);
  });

  it('limits and truncates', () => {
    const result = q.query('gc=L', { limit: 5 });
    expect(result.codePoints).toEqual([0x41, 0x42, 0x43, 0x44, 0x45]);
    expect(result.truncated).toBe(true);
    expect(result.total).toBeGreaterThan(100_000);
    const exact = q.query('blk=ASCII & gc=Nd', { limit: 10 });
    expect(exact.total).toBe(10);
    expect(exact.truncated).toBe(false);
  });

  it.each([
    '',
    '   ',
    'gc=',
    'gc=Lu &',
    '(gc=Lu',
    'gc=Lu)',
    'gc',
    'Nope=1',
    'gc=Nope',
    '=Lu',
    'name~',
    'name~gc',
    'name~/a',
    'name~/a/g',
    'sc="Greek',
    'gc=Lu $',
    'gc<Lu',
    'Alphabetic<Yes',
    'Alphabetic=maybe',
    'na=A',
    'age<NA',
    'ccc=x',
    '|',
  ])('rejects %j', (text) => {
    expect(code(() => q.query(text))).toBe('E_ARG_INVALID');
  });

  it('handles escapes', () => {
    expect(cps('name~/^SOLIDUS\\/?$/')).toEqual([0x2f]);
    expect(cps('blk="Basic\\ Latin" & gc=Lu', 1)).toEqual([0x41]);
  });

  it('uses the UniChef regex engine by default', () => {
    expect(q.query('blk=ASCII & name~/^digit (?:zero|one)$/i').codePoints).toEqual([0x30, 0x31]);
    expect(code(() => q.query('name~/a++/'))).toBe('E_REGEX_UNSUPPORTED');
    // JavaScript cannot stop a search early, so the pattern is only moderately catastrophic:
    // about 2^20 steps per Basic Latin name, far above the 1 ms bound.
    const slow = 'blk=Basic_Latin & name~/^(?:[A-Z ]|[A-Z ])*!/';
    expect(code(() => q.query(slow, { timeoutMs: 1 }))).toBe('E_REGEX_TIMEOUT');
  });

  it('runs name regexes after the rest of an & chain', () => {
    const seen: string[] = [];
    const matcher = (pattern: string) => (name: string) => {
      seen.push(name);
      return new RegExp(pattern).test(name);
    };
    const found = q.query('name~/ARROW$/ & gc=Sm & age<=6.0', { matcher }).codePoints;
    expect(found).toContain(0x2190);
    expect(seen.length).toBeLessThan(1000);
    expect(q.query('!name~/DIGIT/ & blk=ASCII & gc=Nd', { matcher }).codePoints).toEqual([]);
    expect(q.query('gc=Nd & (name~/ZERO/ | name~/ONE$/) & blk=ASCII').codePoints).toEqual([
      0x30, 0x31,
    ]);
    expect(code(() => q.query('name~ARROW & gc=Sm'))).toBe('E_ARG_INVALID');
  });
});
