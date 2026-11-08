// SPDX-License-Identifier: GPL-3.0-or-later

import { makeDish } from '@unichef/core';
import { describe, expect, it } from 'vitest';

import { InputError, dishText, inputDish, visible } from '../src/lib/format.js';

describe('dishText', () => {
  it('shows valid UTF-8 bytes as text and anything else as hex', () => {
    expect(dishText(makeDish('bytes', new TextEncoder().encode('héllo')))).toBe('héllo');
    expect(dishText(makeDish('bytes', new Uint8Array([0xff, 0x00, 0x1a])))).toBe('ff 00 1a');
  });

  it('formats code points, integers and tables', () => {
    expect(dishText(makeDish('codepoints', [0x41, 0x1f600]))).toBe('U+0041 U+1F600');
    expect(dishText(makeDish('integer', 12345678901234567890n))).toBe('12345678901234567890');
    expect(dishText(makeDish('table', { columns: ['a', 'b'], rows: [['1', 2]] }))).toBe(
      'a\tb\n1\t2',
    );
  });
});

describe('inputDish', () => {
  it('keeps text as a string', () => {
    expect(inputDish('abc', 'text')).toEqual(makeDish('string', 'abc'));
  });

  it('reads hex with any whitespace', () => {
    expect(inputDish('de ad\nBE EF', 'hex')).toEqual(
      makeDish('bytes', new Uint8Array([0xde, 0xad, 0xbe, 0xef])),
    );
    expect(() => inputDish('abc', 'hex')).toThrow(InputError);
    expect(() => inputDish('zz', 'hex')).toThrow(InputError);
  });

  it('reads Base64', () => {
    expect(inputDish('aGk=', 'base64')).toEqual(makeDish('bytes', new Uint8Array([0x68, 0x69])));
    expect(() => inputDish('a', 'base64')).toThrow(InputError);
  });
});

describe('visible (NFR-041)', () => {
  it('labels bidi controls, invisibles and control characters', () => {
    expect(visible('a\u202Eb')).toBe('a⟨U+202E⟩b');
    expect(visible('x\u200By\u0000\t')).toBe('x⟨U+200B⟩y⟨U+0000⟩⟨U+0009⟩');
    expect(visible('\u00A0\u2028')).toBe('⟨U+00A0⟩⟨U+2028⟩');
  });

  it('keeps visible text, spaces and RTL letters as they are', () => {
    expect(visible('hello world مرحبا')).toBe('hello world مرحبا');
    expect(visible('e\u0301👋')).toBe('e\u0301👋');
  });
});
