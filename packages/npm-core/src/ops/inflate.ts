// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * A DEFLATE decoder (RFC 1951) for the compression ops.
 *
 * The Python core uses zlib, so this decoder accepts and rejects exactly what zlib's
 * inflate does: the same code-set rules (an incomplete literal/length or distance code is
 * allowed only when it is a single code of length 1), at most 286 literal/length and 30
 * distance codes, a required end-of-block code, and no distance past the start of the
 * output. It also stops at the same point as zlib when the output limit is reached, and
 * reports how many input bytes the stream used, so trailing data can be detected.
 */

import { UniChefError } from '../errors.js';

const MAX_BITS = 15;
const END_OF_BLOCK = 256;
const MAX_LITLEN_CODES = 286;
const MAX_DIST_CODES = 30;
const CHECK_EVERY = 0x10000; // symbols between cancellation checks

const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** A canonical Huffman code: how many codes of each length, and symbols in code order. */
interface Code {
  readonly count: Uint16Array;
  readonly symbol: Uint16Array;
  /** 0 complete, > 0 incomplete, < 0 over-subscribed. */
  readonly left: number;
  /** The longest code length in use (0 when no symbol has a code). */
  readonly max: number;
}

function build(lengths: ArrayLike<number>): Code {
  const n = lengths.length;
  const count = new Uint16Array(MAX_BITS + 1);
  for (let i = 0; i < n; i++) {
    const len = lengths[i] ?? 0;
    count[len] = (count[len] ?? 0) + 1;
  }
  let max = 0;
  let left = 1;
  for (let len = 1; len <= MAX_BITS; len++) {
    if ((count[len] ?? 0) > 0) {
      max = len;
    }
    left = left * 2 - (count[len] ?? 0);
    if (left < 0) {
      return { count, symbol: new Uint16Array(0), left, max };
    }
  }
  const offsets = new Uint16Array(MAX_BITS + 2);
  for (let len = 1; len <= MAX_BITS; len++) {
    offsets[len + 1] = (offsets[len] ?? 0) + (count[len] ?? 0);
  }
  const symbol = new Uint16Array(n);
  for (let sym = 0; sym < n; sym++) {
    const len = lengths[sym] ?? 0;
    if (len !== 0) {
      const at = offsets[len] ?? 0;
      symbol[at] = sym;
      offsets[len] = at + 1;
    }
  }
  return { count, symbol, left, max };
}

/** zlib's rule for literal/length and distance codes. */
const usable = (code: Code): boolean => code.left === 0 || (code.left > 0 && code.max <= 1);

let fixedCodes: readonly [Code, Code] | undefined;

function fixed(): readonly [Code, Code] {
  if (fixedCodes === undefined) {
    const lengths = new Uint8Array(288);
    lengths.fill(8, 0, 144);
    lengths.fill(9, 144, 256);
    lengths.fill(7, 256, 280);
    lengths.fill(8, 280, 288);
    fixedCodes = [build(lengths), build(new Uint8Array(32).fill(5))];
  }
  return fixedCodes;
}

const invalid = (what: string): UniChefError =>
  new UniChefError('E_DECODE', `Invalid DEFLATE data: ${what}.`);

class Inflater {
  private pos = 0;
  private bitBuf = 0;
  private bitCount = 0;
  private out: Uint8Array;
  private length = 0;
  private symbols = 0;

  constructor(
    private readonly data: Uint8Array,
    private readonly limit: number,
    private readonly op: string,
    private readonly check: () => void,
  ) {
    this.out = new Uint8Array(Math.min(Math.max(data.length * 4, 1024), limit + 1));
  }

  run(): { output: Uint8Array; used: number } {
    let last = 0;
    while (last === 0) {
      last = this.bits(1);
      const type = this.bits(2);
      if (type === 0) {
        this.stored();
      } else if (type === 1) {
        const [lit, dist] = fixed();
        this.codes(lit, dist);
      } else if (type === 2) {
        this.dynamic();
      } else {
        throw invalid('invalid block type');
      }
    }
    return { output: this.out.slice(0, this.length), used: this.pos };
  }

  private incomplete(): UniChefError {
    return new UniChefError('E_DECODE', 'The DEFLATE stream is incomplete.');
  }

  private bits(need: number): number {
    let buf = this.bitBuf;
    while (this.bitCount < need) {
      if (this.pos >= this.data.length) {
        throw this.incomplete();
      }
      buf |= (this.data[this.pos++] ?? 0) << this.bitCount;
      this.bitCount += 8;
    }
    this.bitBuf = buf >>> need;
    this.bitCount -= need;
    return buf & ((1 << need) - 1);
  }

  private decode(code: Code): number {
    let bits = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= MAX_BITS; len++) {
      bits |= this.bits(1);
      const count = code.count[len] ?? 0;
      if (bits - first < count) {
        return code.symbol[index + bits - first] ?? 0;
      }
      index += count;
      first = (first + count) << 1;
      bits <<= 1;
    }
    throw invalid('invalid code');
  }

  /** Make room for `n` more bytes, or fail as zlib would on passing the limit. */
  private reserve(n: number): void {
    const need = this.length + n;
    if (need > this.limit) {
      throw new UniChefError(
        'E_LIMIT',
        `${this.op} produced more than ${String(this.limit)} units of output.`,
      );
    }
    if (need > this.out.length) {
      const grown = new Uint8Array(Math.max(need, Math.min(this.out.length * 2, this.limit)));
      grown.set(this.out.subarray(0, this.length));
      this.out = grown;
    }
  }

  private stored(): void {
    this.bitBuf = 0; // skip to a byte boundary
    this.bitCount = 0;
    const { data } = this;
    if (this.pos + 4 > data.length) {
      throw this.incomplete();
    }
    const len = (data[this.pos] ?? 0) | ((data[this.pos + 1] ?? 0) << 8);
    const nlen = (data[this.pos + 2] ?? 0) | ((data[this.pos + 3] ?? 0) << 8);
    this.pos += 4;
    if (len !== (~nlen & 0xffff)) {
      throw invalid('invalid stored block lengths');
    }
    // zlib copies what it has, so the limit is checked before truncation.
    const available = Math.min(len, data.length - this.pos);
    this.reserve(available);
    if (available < len) {
      throw this.incomplete();
    }
    this.out.set(data.subarray(this.pos, this.pos + len), this.length);
    this.length += len;
    this.pos += len;
    this.check();
  }

  private dynamic(): void {
    const nlen = this.bits(5) + 257;
    const ndist = this.bits(5) + 1;
    const ncode = this.bits(4) + 4;
    if (nlen > MAX_LITLEN_CODES || ndist > MAX_DIST_CODES) {
      throw invalid('too many length or distance symbols');
    }
    const codeLengths = new Uint8Array(19);
    for (let i = 0; i < ncode; i++) {
      codeLengths[CODE_LENGTH_ORDER[i] ?? 0] = this.bits(3);
    }
    const lencode = build(codeLengths);
    if (lencode.left !== 0) {
      throw invalid('invalid code lengths set');
    }
    const lengths = new Uint8Array(nlen + ndist);
    let have = 0;
    while (have < nlen + ndist) {
      const sym = this.decode(lencode);
      if (sym < 16) {
        lengths[have++] = sym;
        continue;
      }
      let value = 0;
      let repeat: number;
      if (sym === 16) {
        if (have === 0) {
          throw invalid('invalid bit length repeat');
        }
        value = lengths[have - 1] ?? 0;
        repeat = 3 + this.bits(2);
      } else if (sym === 17) {
        repeat = 3 + this.bits(3);
      } else {
        repeat = 11 + this.bits(7);
      }
      if (have + repeat > nlen + ndist) {
        throw invalid('invalid bit length repeat');
      }
      lengths.fill(value, have, have + repeat);
      have += repeat;
    }
    if (lengths[END_OF_BLOCK] === 0) {
      throw invalid('invalid code -- missing end-of-block');
    }
    const lit = build(lengths.subarray(0, nlen));
    if (!usable(lit)) {
      throw invalid('invalid literal/lengths set');
    }
    const dist = build(lengths.subarray(nlen));
    if (!usable(dist)) {
      throw invalid('invalid distances set');
    }
    this.codes(lit, dist);
  }

  private codes(lit: Code, dist: Code): void {
    for (;;) {
      if (++this.symbols % CHECK_EVERY === 0) {
        this.check();
      }
      let sym = this.decode(lit);
      if (sym < END_OF_BLOCK) {
        this.reserve(1);
        this.out[this.length++] = sym;
        continue;
      }
      if (sym === END_OF_BLOCK) {
        return;
      }
      sym -= END_OF_BLOCK + 1;
      if (sym >= LEN_BASE.length) {
        throw invalid('invalid literal/length code');
      }
      const len = (LEN_BASE[sym] ?? 0) + this.bits(LEN_EXTRA[sym] ?? 0);
      const dsym = this.decode(dist);
      if (dsym >= MAX_DIST_CODES) {
        throw invalid('invalid distance code');
      }
      const distance = (DIST_BASE[dsym] ?? 0) + this.bits(DIST_EXTRA[dsym] ?? 0);
      if (distance > this.length) {
        throw invalid('invalid distance too far back');
      }
      this.reserve(len);
      const { out } = this;
      let from = this.length - distance;
      for (let end = this.length + len; this.length < end;) {
        out[this.length++] = out[from++] ?? 0;
      }
    }
  }
}

/**
 * Inflate one DEFLATE stream at the start of `data`. Returns the output and the number of
 * input bytes the stream used. More than `limit` bytes of output is `E_LIMIT`.
 */
export function inflateRaw(
  data: Uint8Array,
  limit: number,
  op: string,
  check: () => void,
): { output: Uint8Array; used: number } {
  return new Inflater(data, limit, op, check).run();
}

let crcTable: Uint32Array | undefined;

/** CRC-32 (ISO 3309, as used by gzip). */
export function crc32(data: Uint8Array): number {
  if (crcTable === undefined) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const ADLER_MOD = 65521;
const ADLER_RUN = 5552; // bytes that can be summed before the 32-bit sums could overflow

/** Adler-32 (RFC 1950). */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length;) {
    const end = Math.min(i + ADLER_RUN, data.length);
    for (; i < end; i++) {
      a += data[i] ?? 0;
      b += a;
    }
    a %= ADLER_MOD;
    b %= ADLER_MOD;
  }
  return ((b << 16) | a) >>> 0;
}
