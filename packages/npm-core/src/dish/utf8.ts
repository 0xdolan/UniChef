// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * In-house UTF-8 codec (PRD §3.2 rules 1-2, §16.3).
 *
 * The decoder accepts exactly the well-formed byte sequences of Unicode Table 3-7 and
 * replaces each maximal subpart of an ill-formed sequence with one U+FFFD. A BOM is
 * kept as U+FEFF.
 */

export const REPLACEMENT = '�';
const CHUNK = 64 * 1024;
const PIECE = 8192;

/** Sequence length per lead byte; 0 for bytes that can never start a sequence. */
const LENGTH = new Uint8Array(256);
LENGTH.fill(2, 0xc2, 0xe0);
LENGTH.fill(3, 0xe0, 0xf0);
LENGTH.fill(4, 0xf0, 0xf5);

function secondByteRange(lead: number): readonly [number, number] {
  switch (lead) {
    case 0xe0:
      return [0xa0, 0xbf];
    case 0xed:
      return [0x80, 0x9f];
    case 0xf0:
      return [0x90, 0xbf];
    case 0xf4:
      return [0x80, 0x8f];
    default:
      return [0x80, 0xbf];
  }
}

/** Decode `data` as UTF-8 with maximal-subpart U+FFFD substitution. */
export function decode(data: Uint8Array, check?: () => void): string {
  const parts: string[] = [];
  const units: number[] = [];
  const n = data.length;
  let i = 0;
  let nextCheck = CHUNK;
  const flush = (): void => {
    parts.push(String.fromCharCode(...units));
    units.length = 0;
  };
  while (i < n) {
    if (check !== undefined && i >= nextCheck) {
      check();
      nextCheck = i + CHUNK;
    }
    if (units.length >= PIECE) {
      flush();
    }
    const lead = data[i] ?? 0;
    if (lead < 0x80) {
      units.push(lead);
      i += 1;
      continue;
    }
    const size = LENGTH[lead] ?? 0;
    if (size === 0) {
      units.push(0xfffd);
      i += 1;
      continue;
    }
    let cp = lead & (0x3f >> (size - 1));
    let [lo, hi] = secondByteRange(lead);
    let j = i + 1;
    while (j < i + size) {
      const b = data[j];
      if (b === undefined || b < lo || b > hi) {
        break;
      }
      cp = (cp << 6) | (b & 0x3f);
      lo = 0x80;
      hi = 0xbf;
      j += 1;
    }
    if (j === i + size) {
      if (cp >= 0x10000) {
        const v = cp - 0x10000;
        units.push(0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff));
      } else {
        units.push(cp);
      }
    } else {
      // The maximal subpart is the lead plus every continuation byte accepted so far.
      units.push(0xfffd);
    }
    i = j;
  }
  flush();
  return parts.join('');
}

/** Replace each lone surrogate with U+FFFD (PRD §3.2 rule 1). */
export function scrub(text: string): string {
  return text.replace(LONE_SURROGATE, REPLACEMENT);
}

// Matched per UTF-16 unit (no `u` flag), so a lone half is found on its own.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Encode `text` as UTF-8, turning lone surrogates into EF BF BD. */
export function encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 3);
  let o = 0;
  for (let i = 0; i < text.length; i += 1) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdfff) {
      const next = text.charCodeAt(i + 1);
      if (cp <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        cp = 0xfffd;
      }
    }
    if (cp < 0x80) {
      out[o++] = cp;
    } else if (cp < 0x800) {
      out[o++] = 0xc0 | (cp >> 6);
      out[o++] = 0x80 | (cp & 0x3f);
    } else if (cp < 0x10000) {
      out[o++] = 0xe0 | (cp >> 12);
      out[o++] = 0x80 | ((cp >> 6) & 0x3f);
      out[o++] = 0x80 | (cp & 0x3f);
    } else {
      out[o++] = 0xf0 | (cp >> 18);
      out[o++] = 0x80 | ((cp >> 12) & 0x3f);
      out[o++] = 0x80 | ((cp >> 6) & 0x3f);
      out[o++] = 0x80 | (cp & 0x3f);
    }
  }
  return out.slice(0, o);
}
