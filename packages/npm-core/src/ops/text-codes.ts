// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Letter codes: Morse, NATO, Braille, A1Z26, Bacon, leet speak and ROT8000 (PRD §3.8, 1.1).
 *
 * Behaviour follows CyberChef v11.5.0 (Apache-2.0), with the deviations listed in
 * spec/README.md: only ASCII letters are case-mapped, and text is handled per code point
 * rather than per UTF-16 code unit.
 */

import { UniChefError } from '../errors.js';
import { boolArg, defineOp, enumArg, type Operation } from './types.js';

const CHECK_EVERY = 4096;
const ASCII_SPACE = new Set([' ', '\t', '\n', '\v', '\f', '\r']);

const DELIMITERS: Readonly<Record<string, string>> = {
  space: ' ',
  newline: '\n',
  crlf: '\r\n',
  slash: '/',
  backslash: '\\',
  comma: ',',
  semicolon: ';',
  colon: ':',
};
const LETTER_DELIMITERS = [
  'space',
  'newline',
  'crlf',
  'slash',
  'backslash',
  'comma',
  'semicolon',
  'colon',
] as const;
const WORD_DELIMITERS = [
  'newline',
  'crlf',
  'slash',
  'backslash',
  'comma',
  'semicolon',
  'colon',
] as const;
const A1Z26_DELIMITERS = ['space', 'comma', 'semicolon', 'colon', 'newline', 'crlf'] as const;

const delimiter = (name: string): string => DELIMITERS[name] ?? ' ';
const asciiUpper = (ch: string): string =>
  ch >= 'a' && ch <= 'z' ? String.fromCharCode(ch.charCodeAt(0) - 32) : ch;
const isAsciiLetter = (ch: string): boolean => (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');

// ---------------------------------------------------------------------------
// Morse code

// "-" is a dash and "." a dot; the format arg picks the symbols written.
const MORSE: Readonly<Record<string, string>> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
  H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
  O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
  '.': '.-.-.-', ',': '--..--', ':': '---...', ';': '-.-.-.', '!': '-.-.--',
  '?': '..--..', "'": '.----.', '"': '.-..-.', '/': '-..-.', '-': '-....-',
  '+': '.-.-.', '(': '-.--.', ')': '-.--.-', '@': '.--.-.', '=': '-...-',
  '&': '.-...', _: '..--.-', $: '...-..-', ' ': '.......',
}; // prettier-ignore
const MORSE_REVERSE = new Map(Object.entries(MORSE).map(([letter, code]) => [code, letter]));
const MORSE_FORMATS = ['-/.', '_/.', 'Dash/Dot', 'DASH/DOT', 'dash/dot'] as const;
const MORSE_DASH = /-|‐|−|_|–|—|dash/gi;
const MORSE_DOT = /\.|·|dot/gi;

export const toMorseCode = defineOp({
  id: 'to-morse-code',
  name: 'To Morse code',
  category: 'Encoding',
  description:
    'Write each character as International Morse code. Letters are joined by ' +
    '`letter_delimiter` and words (split on runs of spaces) by `word_delimiter`; lines stay ' +
    'on their own lines. A character with no code is written as nothing but still gets ' +
    'its delimiters.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'SOS', args: {}, output: '... --- ...' }],
  args: [
    enumArg('format', MORSE_FORMATS),
    enumArg('letter_delimiter', LETTER_DELIMITERS),
    enumArg('word_delimiter', WORD_DELIMITERS),
  ],
  run(text, args, ctx) {
    const [dash = '-', dot = '.'] = args.text('format').split('/');
    const letterDelim = delimiter(args.text('letter_delimiter'));
    const wordDelim = delimiter(args.text('word_delimiter'));
    const symbol = (s: string): string => (s === '-' ? dash : dot);
    return text
      .split(/\r?\n/)
      .map((line) =>
        line
          .split(/ +/)
          .map((word) => {
            ctx.check();
            return Array.from(word, (ch) =>
              Array.from(MORSE[asciiUpper(ch)] ?? '', symbol).join(''),
            ).join(letterDelim);
          })
          .join(wordDelim),
      )
      .join('\n');
  },
});

export const fromMorseCode = defineOp({
  id: 'from-morse-code',
  name: 'From Morse code',
  category: 'Encoding',
  description:
    'Read International Morse code. Dashes may be `-`, `_`, hyphens, en or em dashes or ' +
    'the word `dash`; dots may be `.`, `·` or the word `dot`. Words are split on ' +
    '`word_delimiter` and joined with a space; a code that is not in the table is dropped.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '... --- ...', args: {}, output: 'SOS' }],
  args: [
    enumArg('letter_delimiter', LETTER_DELIMITERS),
    enumArg('word_delimiter', WORD_DELIMITERS),
  ],
  run(text, args, ctx) {
    ctx.check();
    const normal = text.replace(MORSE_DASH, '-').replace(MORSE_DOT, '.');
    const letterDelim = delimiter(args.text('letter_delimiter'));
    const wordDelim = delimiter(args.text('word_delimiter'));
    return normal
      .split(wordDelim)
      .map((word) =>
        word
          .split(letterDelim)
          .map((code) => MORSE_REVERSE.get(code) ?? '')
          .join(''),
      )
      .join(' ');
  },
});

// ---------------------------------------------------------------------------
// NATO phonetic alphabet

const NATO: Readonly<Record<string, string>> = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot',
  G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima',
  M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo',
  S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray',
  Y: 'Yankee', Z: 'Zulu', '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three',
  '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
  ',': 'Comma', '/': 'Fraction bar', '.': 'Full stop',
}; // prettier-ignore

export const toNatoAlphabet = defineOp({
  id: 'to-nato-alphabet',
  name: 'To NATO alphabet',
  category: 'Encoding',
  description:
    'Replace each ASCII letter, digit, `,`, `/` and `.` with its NATO spelling word and ' +
    'a space. Other characters are copied.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hi 5', args: {}, output: 'Hotel India  Five ' }],
  args: [],
  run: (text) => text.replace(/[A-Za-z0-9,/.]/g, (ch) => `${NATO[asciiUpper(ch)] ?? ch} `),
});

// ---------------------------------------------------------------------------
// Braille

const BRAILLE_ASCII = ' A1B\'K2L@CIF/MSP"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=';
const BRAILLE_BASE = 0x2800;

export const toBraille = defineOp({
  id: 'to-braille',
  name: 'To Braille',
  category: 'Encoding',
  description:
    'Replace each character of North American Braille ASCII (space, ASCII letters in ' +
    'either case, digits and `!"#$%&\'()*+,-./:;<=>?@[\\]^_`) with its six-dot Braille ' +
    'pattern, U+2800 to U+283F. Other characters are copied.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hi!', args: {}, output: '⠓⠊⠮' }],
  args: [],
  run(text, _args, ctx) {
    const out: string[] = [];
    let i = 0;
    for (const ch of text) {
      if (i++ % CHECK_EVERY === 0) ctx.check();
      const idx = BRAILLE_ASCII.indexOf(asciiUpper(ch));
      out.push(idx >= 0 ? String.fromCharCode(BRAILLE_BASE + idx) : ch);
    }
    return out.join('');
  },
});

export const fromBraille = defineOp({
  id: 'from-braille',
  name: 'From Braille',
  category: 'Encoding',
  description:
    'Replace each six-dot Braille pattern (U+2800 to U+283F) with its North American ' +
    'Braille ASCII character; letters come out in upper case. Other characters are ' +
    'copied.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '⠓⠊⠮', args: {}, output: 'HI!' }],
  args: [],
  run(text, _args, ctx) {
    const out: string[] = [];
    let i = 0;
    for (const ch of text) {
      if (i++ % CHECK_EVERY === 0) ctx.check();
      const cp = (ch.codePointAt(0) ?? 0) - BRAILLE_BASE;
      out.push(cp >= 0 && cp < 64 ? (BRAILLE_ASCII[cp] ?? ch) : ch);
    }
    return out.join('');
  },
});

// ---------------------------------------------------------------------------
// A1Z26

export const a1z26Encode = defineOp({
  id: 'a1z26-encode',
  name: 'A1Z26 encode',
  category: 'Crypto',
  description:
    'Write each ASCII letter as its place in the alphabet (`a` and `A` are 1, `z` and ' +
    '`Z` are 26), joined by `delimiter`. Other characters are dropped.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello', args: {}, output: '8 5 12 12 15' }],
  args: [enumArg('delimiter', A1Z26_DELIMITERS)],
  run(text, args) {
    const out: string[] = [];
    for (const ch of text) {
      if (isAsciiLetter(ch)) out.push(String((ch.charCodeAt(0) | 32) - 96));
    }
    return out.join(delimiter(args.text('delimiter')));
  },
});

function stripAsciiSpace(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && ASCII_SPACE.has(s.charAt(start))) start++;
  while (end > start && ASCII_SPACE.has(s.charAt(end - 1))) end--;
  return s.slice(start, end);
}

export const a1z26Decode = defineOp({
  id: 'a1z26-decode',
  name: 'A1Z26 decode',
  category: 'Crypto',
  description:
    'Split on `delimiter` and write each number from 1 to 26 as a lower-case letter. ' +
    'Spaces, tabs and line breaks around a number are ignored. Anything else is ' +
    '`E_DECODE`.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '8 5 12 12 15', args: {}, output: 'hello' }],
  args: [enumArg('delimiter', A1Z26_DELIMITERS)],
  run(text, args, ctx) {
    if (text === '') return '';
    const out: string[] = [];
    text.split(delimiter(args.text('delimiter'))).forEach((piece, i) => {
      if (i % CHECK_EVERY === 0) ctx.check();
      const digits = stripAsciiSpace(piece);
      const n = /^[0-9]+$/.test(digits) ? Number(digits) : 0;
      if (n < 1 || n > 26) {
        throw new UniChefError('E_DECODE', `Number ${String(i + 1)} is not between 1 and 26.`);
      }
      out.push(String.fromCharCode(n + 96));
    });
    return out.join('');
  },
});

// ---------------------------------------------------------------------------
// Bacon cipher

const BACON_ALPHABETS: Readonly<Record<string, string>> = {
  // I and J share a code, as do U and V.
  standard: 'ABCDEFGHIKLMNOPQRSTUWXYZ',
  complete: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
};
const BACON_STANDARD_CODES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 23,
];
const BACON_WORDS = /\s+/;

function baconCode(ch: string, alphabet: string, invert: boolean, letters: string): string {
  let n = asciiUpper(ch).charCodeAt(0) - 65;
  if (alphabet === 'standard') n = BACON_STANDARD_CODES[n] ?? n;
  if (invert) n ^= 0b11111;
  let out = '';
  for (let bit = 4; bit >= 0; bit--) out += letters.charAt((n >> bit) & 1);
  return out;
}

export const baconEncode = defineOp({
  id: 'bacon-encode',
  name: 'Bacon cipher encode',
  category: 'Crypto',
  description:
    'Write each ASCII letter as a five-symbol Bacon code. The `standard` alphabet gives ' +
    'I and J one code, and U and V another; `complete` gives all 26 letters their own. ' +
    'Codes are written in `0`/`1` or `A`/`B` and joined by spaces, or, with `keep_other`, ' +
    'written in place among the other characters. `invert` swaps the two symbols.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hi', args: {}, output: '00111 01000' }],
  args: [
    enumArg('alphabet', ['standard', 'complete']),
    enumArg('translation', ['01', 'ab']),
    boolArg('keep_other', false),
    boolArg('invert', false),
  ],
  run(text, args, ctx) {
    const alphabet = args.text('alphabet');
    const letters = args.text('translation') === '01' ? '01' : 'AB';
    const invert = args.flag('invert');
    const keep = args.flag('keep_other');
    const out: string[] = [];
    let i = 0;
    for (const ch of text) {
      if (i++ % CHECK_EVERY === 0) ctx.check();
      if (isAsciiLetter(ch)) {
        out.push(baconCode(ch, alphabet, invert, letters));
      } else if (keep) {
        out.push(ch);
      }
    }
    return out.join(keep ? '' : ' ');
  },
});

function baconBits(text: string, translation: string): string {
  const chars = Array.from(text);
  switch (translation) {
    case '01':
      return chars.filter((ch) => ch === '0' || ch === '1').join('');
    case 'ab':
      return chars
        .filter((ch) => 'AaBb'.includes(ch))
        .map((ch) => (ch === 'A' || ch === 'a' ? '0' : '1'))
        .join('');
    case 'case':
      return chars
        .filter(isAsciiLetter)
        .map((ch) => (ch <= 'Z' ? '1' : '0'))
        .join('');
    default:
      return text
        .split(BACON_WORDS)
        .filter((word) => word !== '' && isAsciiLetter(word.charAt(0)))
        .map((word) => (asciiUpper(word.charAt(0)) >= 'N' ? '1' : '0'))
        .join('');
  }
}

export const baconDecode = defineOp({
  id: 'bacon-decode',
  name: 'Bacon cipher decode',
  category: 'Crypto',
  description:
    'Read Bacon codes as upper-case letters. `01` reads `0` and `1`, `ab` reads `A` and ' +
    '`B` in either case, `case` reads lower-case ASCII letters as 0 and upper-case as 1, ' +
    'and `first-letter` reads each word starting with A to M as 0 and N to Z as 1. Other ' +
    'characters are skipped, every five symbols make a letter, and leftover symbols are ' +
    'ignored. A code past the end of the alphabet is written as `?`.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: '00111 01000', args: {}, output: 'HI' }],
  args: [
    enumArg('alphabet', ['standard', 'complete']),
    enumArg('translation', ['01', 'ab', 'case', 'first-letter']),
    boolArg('invert', false),
  ],
  run(text, args, ctx) {
    ctx.check();
    const bits = baconBits(text, args.text('translation'));
    const alphabet = BACON_ALPHABETS[args.text('alphabet')] ?? '';
    const invert = args.flag('invert') ? 0b11111 : 0;
    let out = '';
    for (let start = 0; start + 5 <= bits.length; start += 5) {
      const n = parseInt(bits.slice(start, start + 5), 2) ^ invert;
      out += n < alphabet.length ? alphabet.charAt(n) : '?';
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// Leet speak

const TO_LEET: Readonly<Record<string, string>> = {
  a: '4',
  e: '3',
  i: '1',
  o: '0',
  s: '5',
  t: '7',
};
const FROM_LEET = new Map(Object.entries(TO_LEET).map(([letter, digit]) => [digit, letter]));

export const leetSpeak = defineOp({
  id: 'leet-speak',
  name: 'Leet speak',
  category: 'Text',
  description:
    '`to` replaces the ASCII letters a, e, i, o, s and t, in either case, with 4, 3, 1, ' +
    '0, 5 and 7. `from` replaces those digits with the lower-case letters. Other ' +
    'characters are copied.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Leet speak', args: {}, output: 'L337 5p34k' }],
  args: [enumArg('direction', ['to', 'from'])],
  run(text, args) {
    if (args.text('direction') === 'to') {
      return text.replace(/[AEIOSTaeiost]/g, (ch) => TO_LEET[ch.toLowerCase()] ?? ch);
    }
    return text.replace(/[013457]/g, (ch) => FROM_LEET.get(ch) ?? ch);
  },
});

// ---------------------------------------------------------------------------
// ROT8000

// Rotated code points: the BMP without controls, spaces, surrogates and a few format
// characters. 63 404 code points, rotated by half.
const ROT8000_RANGES: readonly (readonly [number, number])[] = [
  [0x21, 0x7e],
  [0xa1, 0x167f],
  [0x1681, 0x1fff],
  [0x200b, 0x2027],
  [0x202a, 0x202e],
  [0x2030, 0x205e],
  [0x2060, 0x2fff],
  [0x3001, 0xd7ff],
  [0xe000, 0xffff],
];
let rot8000Table: Uint16Array | undefined;

/** Index by BMP code point; 0 means "not rotated" (U+0000 is never in the list). */
function rot8000Map(): Uint16Array {
  if (rot8000Table === undefined) {
    const points: number[] = [];
    for (const [lo, hi] of ROT8000_RANGES) {
      for (let cp = lo; cp <= hi; cp++) points.push(cp);
    }
    const half = points.length / 2;
    const table = new Uint16Array(0x10000);
    points.forEach((cp, i) => {
      table[cp] = points[(i + half) % points.length] ?? 0;
    });
    rot8000Table = table;
  }
  return rot8000Table;
}

export const rot8000 = defineOp({
  id: 'rot8000',
  name: 'ROT8000',
  category: 'Crypto',
  description:
    'Rotate visible Basic Multilingual Plane characters halfway through the list of ' +
    '63 404 that take part, so applying it twice gives the input back. Spaces, controls ' +
    'and characters outside the BMP are copied.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello, World!', args: {}, output: '籑籮籵籵籸簵 籠籸类籵籭簪' }],
  args: [],
  run(text, _args, ctx) {
    const table = rot8000Map();
    const out: string[] = [];
    let i = 0;
    for (const ch of text) {
      if (i++ % CHECK_EVERY === 0) ctx.check();
      const cp = ch.codePointAt(0) ?? 0;
      const to = cp < 0x10000 ? (table[cp] ?? 0) : 0;
      out.push(to === 0 ? ch : String.fromCharCode(to));
    }
    return out.join('');
  },
});

export const TEXT_CODE_OPS: readonly Operation[] = [
  toMorseCode,
  fromMorseCode,
  toNatoAlphabet,
  toBraille,
  fromBraille,
  a1z26Encode,
  a1z26Decode,
  baconEncode,
  baconDecode,
  leetSpeak,
  rot8000,
];
