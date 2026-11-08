// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Compression operations: raw DEFLATE, zlib and gzip (PRD §3.8 Beta; spec/README.md).
 *
 * Compressed output at levels 1-9 comes from fflate, so it may differ from the Python core
 * byte for byte (parity class `roundtrip`). Level 0, the zlib and gzip framing, and every
 * decoder decision are written here and match the Python core exactly.
 */

import { deflateSync, type DeflateOptions } from 'fflate';
import { UniChefError } from '../errors.js';
import { adler32, crc32, inflateRaw } from './inflate.js';
import { defineOp, intArg, outputLimit, type OpContext, type Operation } from './types.js';

const CHUNK = 1 << 20; // bytes between cancellation checks
const STORED_MAX = 0xffff; // largest stored block (RFC 1951 §3.2.4)
const DEFAULT_LEVEL = 6;

const ZLIB_CMF = 0x78; // deflate, 32 KiB window
const ZLIB_FDICT = 0x20;
const ZLIB_CHECK = 31;
const ZLIB_MAX_CINFO = 7;
const DEFLATE_CM = 8;

const GZIP_HEADER = 10;
const GZIP_TRAILER = 8;
const GZIP_OS_UNKNOWN = 255;
const FHCRC = 0x02;
const FEXTRA = 0x04;
const FNAME = 0x08;
const FCOMMENT = 0x10;
const FRESERVED = 0xe0;
const XFL_SLOWEST = 2;
const XFL_FASTEST = 4;
const LEVEL_FASTEST = 1;
const LEVEL_BEST = 9;

const levelArg = intArg('level', DEFAULT_LEVEL, 0, 9);

const decodeError = (message: string): UniChefError => new UniChefError('E_DECODE', message);

function stored(data: Uint8Array, ctx: OpContext): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / STORED_MAX));
  const out = new Uint8Array(data.length + blocks * 5);
  let pos = 0;
  for (let i = 0; i < blocks; i++) {
    const start = i * STORED_MAX;
    if (start % CHUNK < STORED_MAX) {
      ctx.check();
    }
    const block = data.subarray(start, start + STORED_MAX);
    const size = block.length;
    out[pos] = i === blocks - 1 ? 1 : 0;
    out[pos + 1] = size & 0xff;
    out[pos + 2] = size >>> 8;
    out[pos + 3] = ~size & 0xff;
    out[pos + 4] = (~size >>> 8) & 0xff;
    out.set(block, pos + 5);
    pos += 5 + size;
  }
  return out;
}

function deflateRaw(data: Uint8Array, level: number, ctx: OpContext): Uint8Array {
  ctx.check();
  if (level === 0) {
    return stored(data, ctx);
  }
  return deflateSync(data, { level: level as NonNullable<DeflateOptions['level']> });
}

function noTrailing(data: Uint8Array, pos: number): void {
  if (pos !== data.length) {
    const extra = data.length - pos;
    throw decodeError(`${String(extra)} byte${extra === 1 ? '' : 's'} of trailing data.`);
  }
}

function need(data: Uint8Array, end: number, what: string): void {
  if (data.length < end) {
    throw decodeError(`The ${what} is incomplete.`);
  }
}

const u32le = (data: Uint8Array, pos: number): number =>
  ((data[pos] ?? 0) |
    ((data[pos + 1] ?? 0) << 8) |
    ((data[pos + 2] ?? 0) << 16) |
    ((data[pos + 3] ?? 0) << 24)) >>>
  0;

const u32be = (data: Uint8Array, pos: number): number =>
  (((data[pos] ?? 0) << 24) |
    ((data[pos + 1] ?? 0) << 16) |
    ((data[pos + 2] ?? 0) << 8) |
    (data[pos + 3] ?? 0)) >>>
  0;

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const part of parts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

const le32 = (n: number): Uint8Array =>
  Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
const be32 = (n: number): Uint8Array =>
  Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

/** FLG with FLEVEL chosen as zlib chooses it (0-1, 2-5, 6, 7-9), plus the check bits. */
function zlibFlg(level: number): number {
  const flevel = [2, DEFAULT_LEVEL, DEFAULT_LEVEL + 1].filter((t) => level >= t).length;
  const flg = flevel << 6;
  const rem = ((ZLIB_CMF << 8) | flg) % ZLIB_CHECK;
  return flg + (rem === 0 ? 0 : ZLIB_CHECK - rem);
}

export const rawDeflate = defineOp({
  id: 'raw-deflate',
  name: 'Raw Deflate',
  category: 'Compression',
  description:
    'Compress to a raw DEFLATE stream (RFC 1951) with no header or checksum. Level 0 ' +
    'stores the input uncompressed; 1 is fastest and 9 smallest.',
  inputType: 'bytes',
  outputType: 'bytes',
  parity: 'roundtrip',
  args: [levelArg],
  examples: [{ input: 'Hi', args: { level: 0 }, output: '01 02 00 fd ff 48 69' }],
  run(data, args, ctx) {
    return deflateRaw(data, args.int('level'), ctx);
  },
});

export const rawInflate = defineOp({
  id: 'raw-inflate',
  name: 'Raw Inflate',
  category: 'Compression',
  description:
    'Decompress a raw DEFLATE stream (RFC 1951). The stream must be complete, and no ' +
    'bytes may follow it.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [{ input: 'K\u0004\u0000', args: {}, output: 'a' }],
  run(data, _args, ctx) {
    const { output, used } = inflateRaw(
      data,
      outputLimit(ctx.limits, data.length),
      'raw-inflate',
      ctx.check,
    );
    noTrailing(data, used);
    return output;
  },
});

export const zlibDeflate = defineOp({
  id: 'zlib-deflate',
  name: 'Zlib Deflate',
  category: 'Compression',
  description:
    'Compress to the zlib format (RFC 1950): a 2-byte header, raw DEFLATE and an ' +
    'Adler-32 checksum.',
  inputType: 'bytes',
  outputType: 'bytes',
  parity: 'roundtrip',
  args: [levelArg],
  examples: [{ input: 'Hi', args: { level: 0 }, output: '78 01 01 02 00 fd ff 48 69 00 fb 00 b2' }],
  run(data, args, ctx) {
    const level = args.int('level');
    const body = deflateRaw(data, level, ctx);
    return concat(Uint8Array.of(ZLIB_CMF, zlibFlg(level)), body, be32(adler32(data)));
  },
});

export const zlibInflate = defineOp({
  id: 'zlib-inflate',
  name: 'Zlib Inflate',
  category: 'Compression',
  description:
    'Decompress zlib data (RFC 1950) and check its Adler-32. A preset dictionary is not ' +
    'supported, and no bytes may follow the checksum.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [{ input: 'x\u0001K\u0004\u0000\u0000b\u0000b', args: {}, output: 'a' }],
  run(data, _args, ctx) {
    need(data, 2, 'zlib header');
    const cmf = data[0] ?? 0;
    const flg = data[1] ?? 0;
    if (((cmf << 8) | flg) % ZLIB_CHECK !== 0) {
      throw decodeError('The zlib header check failed.');
    }
    if ((cmf & 0x0f) !== DEFLATE_CM || cmf >> 4 > ZLIB_MAX_CINFO) {
      throw decodeError('The zlib header names an unknown method or window.');
    }
    if (flg & ZLIB_FDICT) {
      throw decodeError('zlib data with a preset dictionary is not supported.');
    }
    const { output, used } = inflateRaw(
      data.subarray(2),
      outputLimit(ctx.limits, data.length),
      'zlib-inflate',
      ctx.check,
    );
    const pos = 2 + used;
    need(data, pos + 4, 'zlib checksum');
    if (u32be(data, pos) !== adler32(output)) {
      throw decodeError('The zlib Adler-32 checksum does not match.');
    }
    noTrailing(data, pos + 4);
    return output;
  },
});

export const gzip = defineOp({
  id: 'gzip',
  name: 'Gzip',
  category: 'Compression',
  description:
    'Compress to one gzip member (RFC 1952) with no file name, a zero modification time ' +
    'and OS 255 (unknown), so the output does not depend on when or where it is made.',
  inputType: 'bytes',
  outputType: 'bytes',
  parity: 'roundtrip',
  args: [levelArg],
  examples: [
    {
      input: 'Hi',
      args: { level: 0 },
      output: '1f 8b 08 00 00 00 00 00 00 ff 01 02 00 fd ff 48 69 0e 0e 17 4d 02 00 00 00',
    },
  ],
  run(data, args, ctx) {
    const level = args.int('level');
    const xfl = level === LEVEL_BEST ? XFL_SLOWEST : level === LEVEL_FASTEST ? XFL_FASTEST : 0;
    const header = Uint8Array.of(0x1f, 0x8b, DEFLATE_CM, 0, 0, 0, 0, 0, xfl, GZIP_OS_UNKNOWN);
    const body = deflateRaw(data, level, ctx);
    return concat(header, body, le32(crc32(data)), le32(data.length));
  },
});

/** Check one member header at `start`; return where its DEFLATE data begins. */
function gzipHeader(data: Uint8Array, start: number): number {
  if (data[start] !== 0x1f || data[start + 1] !== 0x8b) {
    throw decodeError(`No gzip header at byte ${String(start)}.`);
  }
  need(data, start + GZIP_HEADER, 'gzip header');
  if (data[start + 2] !== DEFLATE_CM) {
    throw decodeError('The gzip header names an unknown method.');
  }
  const flg = data[start + 3] ?? 0;
  if (flg & FRESERVED) {
    throw decodeError('The gzip header sets reserved flags.');
  }
  let pos = start + GZIP_HEADER;
  if (flg & FEXTRA) {
    need(data, pos + 2, 'gzip header');
    pos += 2 + ((data[pos] ?? 0) | ((data[pos + 1] ?? 0) << 8));
  }
  for (const flag of [FNAME, FCOMMENT]) {
    if (flg & flag) {
      const end = data.indexOf(0, Math.min(pos, data.length));
      pos = end >= 0 ? end + 1 : data.length + 1;
    }
  }
  if (flg & FHCRC) {
    need(data, pos + 2, 'gzip header');
    const stated = (data[pos] ?? 0) | ((data[pos + 1] ?? 0) << 8);
    if (stated !== (crc32(data.subarray(start, pos)) & 0xffff)) {
      throw decodeError('The gzip header CRC does not match.');
    }
    pos += 2;
  }
  need(data, pos, 'gzip header');
  return pos;
}

export const gunzip = defineOp({
  id: 'gunzip',
  name: 'Gunzip',
  category: 'Compression',
  description:
    'Decompress gzip data (RFC 1952), member after member, checking each CRC-32 and ' +
    'length. Anything after the last member that is not another member is an error.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [],
  run(data, _args, ctx) {
    const limit = outputLimit(ctx.limits, data.length);
    const members: Uint8Array[] = [];
    let total = 0;
    let pos = 0;
    for (;;) {
      ctx.check();
      pos = gzipHeader(data, pos);
      const { output, used } = inflateRaw(data.subarray(pos), limit - total, 'gunzip', ctx.check);
      pos += used;
      need(data, pos + GZIP_TRAILER, 'gzip trailer');
      if (u32le(data, pos) !== crc32(output)) {
        throw decodeError('The gzip CRC-32 does not match.');
      }
      if (u32le(data, pos + 4) !== output.length >>> 0) {
        throw decodeError('The gzip length does not match.');
      }
      members.push(output);
      total += output.length;
      pos += GZIP_TRAILER;
      if (pos === data.length) {
        return concat(...members);
      }
    }
  },
});

export const COMPRESSION_OPS: readonly Operation[] = [
  rawDeflate,
  rawInflate,
  zlibDeflate,
  zlibInflate,
  gzip,
  gunzip,
];
