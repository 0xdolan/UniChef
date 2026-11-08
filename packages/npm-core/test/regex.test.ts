// SPDX-License-Identifier: GPL-3.0-or-later
/** The portable regex profile: parsing, serialisation and matching (PRD §4.9). */

import { beforeAll, describe, expect, it } from 'vitest';

import { UniChefError } from '../src/errors.js';
import * as profile from '../src/regex/profile.js';
import * as run from '../src/regex/run.js';
import { lru, translate } from '../src/regex/translate.js';
import { ready } from '../src/unicode/data.js';

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

function matches(pattern: string, text: string, flags = ''): string[] {
  const compiled = run.compileRegex(pattern, flags);
  return [...run.finditer(compiled, text, 2000)].map((m) => text.slice(m.start, m.end));
}

const error = (pattern: string, flags = ''): string => code(() => translate(pattern, flags));

beforeAll(async () => {
  await ready('core');
});

describe('parsing', () => {
  it.each([
    '(',
    ')',
    'a)',
    '*a',
    'a|+',
    '[a',
    '[z-a]',
    '[\\d-z]',
    'a{2,1}',
    'a{70000}',
    '{',
    '}',
    ']',
    'a{',
    'a{1',
    '(?<1x>a)',
    '(?<n>a)(?<n>b)',
    '\\k',
    '\\k<zz>',
    '\\2',
    '(a)\\2',
    '[\\1]',
    '\\p',
    '\\p{',
    '\\p{Greek}',
    '\\p{Nope}',
    '\\p{gc=Nope}',
    '\\p{WSpace=maybe}',
    '\\x',
    '\\xZZ',
    '\\u12',
    '\\u{}',
    '\\u{110000}',
    '\\u{1234567}',
    '\\',
    '^*',
    '(?=a)+',
    '\\b+',
  ])('rejects %j', (pattern) => {
    expect(error(pattern)).toBe('E_ARG_INVALID');
  });

  it.each([
    'a++',
    'a*+',
    '(?>a)',
    '(?(1)a|b)',
    '(?P<n>a)',
    '(?|a)',
    '(?#c)',
    '(?i)a',
    '(?R)',
    '(?1)',
    '[[:alpha:]]',
    '[[a]]',
    '[a&&b]',
    '[a--b]',
    '\\01',
    '\\X',
    '\\G',
    '\\N',
    '\\p{bc=L}',
  ])('does not support %j', (pattern) => {
    expect(error(pattern)).toBe('E_REGEX_UNSUPPORTED');
  });

  it('checks flags', () => {
    expect(error('a', 'g')).toBe('E_ARG_INVALID');
    expect(error('a', 'ii')).toBe('E_ARG_INVALID');
    expect(translate('a', 'smi').flags).toBe('ims');
    expect(error('(a)\\1', 'i')).toBe('E_REGEX_UNSUPPORTED');
  });
});

describe('serialisation', () => {
  it.each([
    ['abc', 'abc'],
    ['a.b', 'a[^\\u{A}\\u{D}\\u{2028}-\\u{2029}]b'],
    ['a|b', 'a|b'],
    ['x(?:a|b)', 'x(?:a|b)'],
    ['(a)\\1', '(a)(?:\\1)'],
    ['(?<n>a)\\k<n>', '(?<n>a)(?:\\k<n>)'],
    ['a+?b{2}c{1,}d{0,3}', 'a+?b{2}c+d{0,3}'],
    ['(?:ab)*', '(?:ab)*'],
    ['^a$', '^a$'],
    ['[^]', '[\\u{0}-\\u{10FFFF}]'],
    ['[]', '(?!)'],
    ['[]*', '(?:(?!))*'],
    ['a{2,}b{3,5}', 'a{2,}b{3,5}'],
    ['\\u{1F600}', '\\u{1F600}'],
    ['\\uD83D\\uDE00', '\\u{1F600}'],
    ['a-b', 'a\\u{2D}b'],
    ['(?<=a)b(?!c)', '(?<=a)b(?!c)'],
  ])('%j → %j', (pattern, js) => {
    expect(translate(pattern).js).toBe(js);
  });

  it('records the group layout', () => {
    const translation = translate('\\u{1F600}-(a)\\1');
    expect(translation.groups).toBe(1);
    expect(translate('(?<y>a)(b)').names).toEqual(['y']);
  });

  it('spells out anchors', () => {
    expect(translate('^', 'm').js.startsWith('(?<![^')).toBe(true);
    expect(translate('$', 'm').js.startsWith('(?![^')).toBe(true);
    expect(translate('\\b').js).toContain('(?<=');
    expect(translate('\\B').js).not.toBe(translate('\\b').js);
  });

  it('uses the shorter class form', () => {
    expect(translate('[^a]').js).toBe('[^a]');
    expect(translate('[a-c]').js).toBe('[a-c]');
    expect(translate('\\D').js.startsWith('[^')).toBe(true);
  });

  it('caches least recently used entries', () => {
    let calls = 0;
    const square = lru(2, (key: string) => {
      calls += 1;
      return key.repeat(2);
    });
    expect([square('a'), square('b'), square('a'), square('c'), square('a')]).toEqual([
      'aa',
      'bb',
      'aa',
      'cc',
      'aa',
    ]);
    expect(calls).toBe(3);
    square('b');
    expect(calls).toBe(4);
  });
});

describe('matching', () => {
  it.each<[string, string, string, string[]]>([
    ['a*', '', 'baaa', ['', 'aaa', '']],
    ['.', '', 'a\nb', ['a', 'b']],
    ['.', 's', 'a\nb', ['a', '\n', 'b']],
    ['^\\w', 'm', 'ab\ncd ef', ['a', 'c', 'e']],
    ['\\w$', 'm', 'ab\r\ncd', ['b', 'd']],
    ['\\bx', '', 'x ax xé', ['x', 'x']],
    ['\\Bx', '', 'x ax', ['x']],
    ['k', 'i', 'kKK', ['k', 'K', 'K']],
    ['[a-c]+', 'i', 'xABCx', ['ABC']],
    ['\\d+', '', '1١१x', ['1١१']],
    ['\\s', '', 'a　b​c', ['　']],
    ['\\p{Lu}', '', 'aBcÉ', ['B', 'É']],
    ['\\P{L}', '', 'a1', ['1']],
    ['\\p{scx=Grek}', '', 'aα', ['α']],
    ['\\p{blk=Basic_Latin}+', '', 'abé', ['ab']],
    ['\\p{Emoji=no}', '', '\u{1f600}a', ['a']],
    ['\\p{White_Space}', '', 'a b', [' ']],
    ['a # comment\n b', 'x', 'ab', ['ab']],
    ['[ ]', 'x', 'a b', [' ']],
    ['\\x41\\u0042\\t\\n\\0', '', 'AB\t\n\x00', ['AB\t\n\x00']],
    ['[\\x41-\\x43\\-]+', '', 'ABC-D', ['ABC-']],
    ['[\\b]', '', 'a\bb', ['\b']],
    ['\\$\\.', '', '$.', ['$.']],
    ['\\/', '', 'a/b', ['/']],
    ['(?<=\\$)\\d', '', '$1 2', ['1']],
    ['[^\\d\\s]', '', '1 a', ['a']],
    ['\u{1f600}+', '', '\u{1f600}\u{1f600}', ['\u{1f600}\u{1f600}']],
    ['', '', '\u{1f600}a', ['', '', '']],
    ['[\\s\\S]', '', 'a\u{1f600}', ['a', '\u{1f600}']],
  ])('%j /%s on %j', (pattern, flags, text, found) => {
    expect(matches(pattern, text, flags)).toEqual(found);
  });

  it('searches from a position and reports groups', () => {
    const compiled = run.compileRegex('(a)|(b)');
    const match = run.search(compiled, 'xb', 2000);
    expect(match?.span).toEqual([1, 2]);
    expect(match?.spans).toEqual([[1, 2], null, [1, 2]]);
    expect(match?.group('xb', 1)).toBeNull();
    expect(match?.group('xb')).toBe('b');
    expect(run.search(compiled, 'xb', 2000, 2)).toBeNull();
    expect(compiled.index('nope')).toBeNull();
    expect(run.compileRegex('(?<n>a)').index('n')).toBe(1);
    expect(code(() => new run.Match([null]).span)).toBe('E_INTERNAL');
  });

  it('expands templates like JavaScript', () => {
    const compiled = run.compileRegex('(?<m>\\d\\d)/(?<y>\\d{4})');
    const text = '05/2024';
    const match = run.search(compiled, text, 2000);
    expect(match).not.toBeNull();
    if (match === null) {
      return;
    }
    const template = '$<y>-$<m> [$2$1] $& $$ $3 $9 $<zz> $x $';
    expect(run.expand(template, match, text, compiled)).toBe(
      '2024-05 [202405] 05/2024 $ $3 $9  $x $',
    );
    const many = run.compileRegex('(a)'.repeat(11));
    const all = 'a'.repeat(11);
    const found = run.search(many, all, 2000);
    expect(found && run.expand('$11|$1|$01', found, all, many)).toBe('a|a|a');
    const plain = run.compileRegex('a');
    const hit = run.search(plain, 'a', 2000);
    expect(hit && run.expand('$<x>', hit, 'a', plain)).toBe('$<x>');
  });

  it('builds a predicate', () => {
    const test = run.predicate(run.compileRegex('LATIN', 'i'), 2000);
    expect(test('Latin small letter a')).toBe(true);
    expect(test('GREEK')).toBe(false);
  });

  it('times a predicate per batch from its first call', async () => {
    const test = run.predicate(run.compileRegex('a'), 5);
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Idle time before the first call does not count against the bound.
    for (let i = 0; i < 3 * run.CLOCK_EVERY; i++) expect(test('a')).toBe(true);
  });

  it('raises E_REGEX_TIMEOUT once a search has overrun', () => {
    // A JavaScript search cannot be stopped, so the input is only moderately catastrophic.
    const slow = run.compileRegex('(a|aa)+b');
    const text = 'a'.repeat(30);
    for (const call of [
      () => run.search(slow, text, 1),
      () => {
        // The predicate reads the clock once per batch of calls.
        const test = run.predicate(slow, 1);
        for (let i = 0; i < run.CLOCK_EVERY; i++) test(text);
      },
      () => [...run.finditer(slow, text, 1)],
    ]) {
      expect(code(call)).toBe('E_REGEX_TIMEOUT');
    }
    expect(code(() => [...run.finditer(run.compileRegex('a'), 'aaa', -1)])).toBe('E_REGEX_TIMEOUT');
  });

  it('checks cancellation in finditer', () => {
    const cancel = (): never => {
      throw new UniChefError('E_CANCELLED', 'stop');
    };
    expect(code(() => [...run.finditer(run.compileRegex('a'), 'aaa', 2000, cancel)])).toBe(
      'E_CANCELLED',
    );
  });
});

describe('class sets', () => {
  it('builds word, case and property sets', () => {
    expect(profile.word().some(([a, b]) => a <= 0x5f && 0x5f <= b)).toBe(true);
    expect(profile.closeCase([[0x6b, 0x6b]])).toEqual([
      [0x4b, 0x4b],
      [0x6b, 0x6b],
      [0x212a, 0x212a],
    ]);
    expect(profile.propertyRanges('WSpace=n')).not.toEqual(profile.propertyRanges('WSpace'));
  });
});
