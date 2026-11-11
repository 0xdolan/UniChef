// SPDX-License-Identifier: GPL-3.0-or-later
/** Hashing ops (PRD §3.8): digests and checksums as lower-case hex strings. */

import { blake2b as blake2bHash, blake2s as blake2sHash } from '@noble/hashes/blake2.js';
import { hmac as hmacHash } from '@noble/hashes/hmac.js';
import { md5 as md5Hash, sha1 as sha1Hash } from '@noble/hashes/legacy.js';
import { sha224, sha256, sha384, sha512, sha512_224, sha512_256 } from '@noble/hashes/sha2.js';
import { sha3_224, sha3_256, sha3_384, sha3_512, shake128, shake256 } from '@noble/hashes/sha3.js';
import { bytesToHex, type CHash } from '@noble/hashes/utils.js';

import { UniChefError } from '../errors.js';
import {
  secretArg,
  defineOp,
  enumArg,
  intArg,
  type Args,
  type OpContext,
  type Operation,
} from './types.js';

const CHUNK = 1 << 20;

/** The incremental-hash interface shared by every @noble/hashes hash and HMAC. */
interface Hasher {
  update(data: Uint8Array): unknown;
  digest(): Uint8Array;
}

/** A hash function, e.g. `sha256`, whose `create()` starts an incremental hash. */
interface HashFn {
  create(): Hasher;
}

/** Hash in 1 MiB chunks so long inputs stay cancellable. */
function feed<H extends Hasher>(hasher: H, data: Uint8Array, ctx: OpContext): H {
  for (let start = 0; start < data.length; start += CHUNK) {
    ctx.check();
    hasher.update(data.subarray(start, start + CHUNK));
  }
  return hasher;
}

const hexDigest = (hasher: Hasher, data: Uint8Array, ctx: OpContext): string =>
  bytesToHex(feed(hasher, data, ctx).digest());

function insecure(ctx: OpContext, name: string): void {
  ctx.warn('W_INSECURE', `${name} is broken for collision resistance; do not rely on it.`);
}

export const md5 = defineOp({
  id: 'md5',
  name: 'MD5',
  category: 'Hashing',
  description: 'MD5 digest (RFC 1321). Warns W_INSECURE.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'abc', args: {}, output: '900150983cd24fb0d6963f7d28e17f72' }],
  run(data, _args, ctx) {
    insecure(ctx, 'MD5');
    return hexDigest(md5Hash.create(), data, ctx);
  },
});

export const sha1 = defineOp({
  id: 'sha1',
  name: 'SHA-1',
  category: 'Hashing',
  description: 'SHA-1 digest (FIPS 180-4). Warns W_INSECURE.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'abc', args: {}, output: 'a9993e364706816aba3e25717850c26c9cd0d89d' }],
  run(data, _args, ctx) {
    insecure(ctx, 'SHA-1');
    return hexDigest(sha1Hash.create(), data, ctx);
  },
});

export const SHA2_SIZES: ReadonlyMap<string, HashFn> = new Map<string, HashFn>([
  ['256', sha256],
  ['224', sha224],
  ['384', sha384],
  ['512', sha512],
  ['512-224', sha512_224],
  ['512-256', sha512_256],
]);

/** Look up an enum argument's value in a table built from the same options. */
export function pick<T>(table: ReadonlyMap<string, T>, args: Args, name: string): T {
  const value = table.get(args.text(name));
  if (value === undefined) {
    throw new UniChefError('E_INTERNAL', `No table entry for argument ${name}.`);
  }
  return value;
}

export const sha2 = defineOp({
  id: 'sha2',
  name: 'SHA-2',
  category: 'Hashing',
  description:
    'SHA-2 digest (FIPS 180-4); `size` is 256 (default), 224, 384, 512, 512-224 or 512-256.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [
    {
      input: 'abc',
      args: {},
      output: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    },
  ],
  args: [enumArg('size', [...SHA2_SIZES.keys()])],
  run: (data, args, ctx) => hexDigest(pick(SHA2_SIZES, args, 'size').create(), data, ctx),
});

const SHA3_SIZES = new Map<string, HashFn>([
  ['256', sha3_256],
  ['224', sha3_224],
  ['384', sha3_384],
  ['512', sha3_512],
]);

export const sha3 = defineOp({
  id: 'sha3',
  name: 'SHA-3',
  category: 'Hashing',
  description: 'SHA-3 digest (FIPS 202); `size` is 256 (default), 224, 384 or 512.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [
    {
      input: 'abc',
      args: {},
      output: '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532',
    },
  ],
  args: [enumArg('size', [...SHA3_SIZES.keys()])],
  run: (data, args, ctx) => hexDigest(pick(SHA3_SIZES, args, 'size').create(), data, ctx),
});

export const shake = defineOp({
  id: 'shake',
  name: 'SHAKE',
  category: 'Hashing',
  description:
    'SHAKE extendable-output function (FIPS 202); `size` is 128 (default) or 256 and ' +
    '`length` is the output length in bytes (default 32).',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'abc', args: { length: 16 }, output: '5881092dd818bf5cf8a3ddb793fbcba7' }],
  args: [enumArg('size', ['128', '256']), intArg('length', 32, 1, 65536)],
  run(data, args, ctx) {
    const fn = args.text('size') === '128' ? shake128 : shake256;
    return hexDigest(fn.create({ dkLen: args.int('length') }), data, ctx);
  },
});

function blake2(
  fn: typeof blake2bHash | typeof blake2sHash,
  maxSize: number,
  data: Uint8Array,
  args: Args,
  ctx: OpContext,
): string {
  const key = args.data('key');
  if (key.length > maxSize) {
    throw new UniChefError(
      'E_ARG_INVALID',
      `Argument 'key' is longer than ${String(maxSize)} bytes.`,
    );
  }
  const hasher = fn.create({
    dkLen: args.int('size'),
    ...(key.length > 0 ? { key } : {}),
  });
  return hexDigest(hasher, data, ctx);
}

export const blake2b = defineOp({
  id: 'blake2b',
  name: 'BLAKE2b',
  category: 'Hashing',
  description:
    'BLAKE2b (RFC 7693); `size` is the digest length in bytes (1-64, default 64) and ' +
    '`key` an optional key of up to 64 bytes.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [
    {
      input: 'abc',
      args: { size: 32 },
      output: 'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319',
    },
  ],
  args: [intArg('size', 64, 1, 64), secretArg('key')],
  run: (data, args, ctx) => blake2(blake2bHash, 64, data, args, ctx),
});

export const blake2s = defineOp({
  id: 'blake2s',
  name: 'BLAKE2s',
  category: 'Hashing',
  description:
    'BLAKE2s (RFC 7693); `size` is the digest length in bytes (1-32, default 32) and ' +
    '`key` an optional key of up to 32 bytes.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [
    {
      input: 'abc',
      args: {},
      output: '508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982',
    },
  ],
  args: [intArg('size', 32, 1, 32), secretArg('key')],
  run: (data, args, ctx) => blake2(blake2sHash, 32, data, args, ctx),
});

/** CRC-32 lookup table for the reflected polynomial 0xEDB88320. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (ISO-HDLC), continuing from `crc` like zlib.crc32. */
export function crc32Update(data: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (const byte of data) {
    c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return ~c >>> 0;
}

const ADLER_MOD = 65521;
/** Bytes summed before a modulo can be needed (zlib's NMAX). */
const ADLER_NMAX = 5552;

/** Adler-32, continuing from `value` like zlib.adler32. */
export function adler32Update(data: Uint8Array, value = 1): number {
  let a = value & 0xffff;
  let b = value >>> 16;
  for (let start = 0; start < data.length; start += ADLER_NMAX) {
    const end = Math.min(start + ADLER_NMAX, data.length);
    for (let i = start; i < end; i++) {
      a += data[i] ?? 0;
      b += a;
    }
    a %= ADLER_MOD;
    b %= ADLER_MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function checksum(
  fn: (data: Uint8Array, value: number) => number,
  start: number,
  data: Uint8Array,
  ctx: OpContext,
): string {
  let value = start;
  for (let offset = 0; offset < data.length; offset += CHUNK) {
    ctx.check();
    value = fn(data.subarray(offset, offset + CHUNK), value);
  }
  return value.toString(16).padStart(8, '0');
}

export const crc32 = defineOp({
  id: 'crc32',
  name: 'CRC-32',
  category: 'Hashing',
  description: 'CRC-32 (ISO-HDLC, as in zlib and PNG) as 8 hex digits.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [
    { input: 'The quick brown fox jumps over the lazy dog', args: {}, output: '414fa339' },
  ],
  run: (data, _args, ctx) => checksum(crc32Update, 0, data, ctx),
});

export const adler32 = defineOp({
  id: 'adler32',
  name: 'Adler-32',
  category: 'Hashing',
  description: 'Adler-32 (RFC 1950) as 8 hex digits.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [{ input: 'Wikipedia', args: {}, output: '11e60398' }],
  run: (data, _args, ctx) => checksum(adler32Update, 1, data, ctx),
});

export const HMAC_HASHES: ReadonlyMap<string, CHash> = new Map<string, CHash>([
  ['sha256', sha256],
  ['sha1', sha1Hash],
  ['md5', md5Hash],
  ['sha224', sha224],
  ['sha384', sha384],
  ['sha512', sha512],
  ['sha3-256', sha3_256],
  ['sha3-512', sha3_512],
]);

export const hmac = defineOp({
  id: 'hmac',
  name: 'HMAC',
  category: 'Hashing',
  description: 'HMAC (RFC 2104) with `hash` (default sha256) and a bytes `key`.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [
    {
      input: 'message',
      args: { key: { encoding: 'utf8', value: 'secret' } },
      output: '8b5f48702995c1598c573db1e21866a9b825d4a794d169d7060a03605796360b',
    },
  ],
  args: [enumArg('hash', [...HMAC_HASHES.keys()]), secretArg('key')],
  run(data, args, ctx) {
    const mac = hmacHash.create(pick(HMAC_HASHES, args, 'hash'), args.data('key'));
    return hexDigest(mac, data, ctx);
  },
});

export const HASHING_OPS: readonly Operation[] = [
  md5,
  sha1,
  sha2,
  sha3,
  shake,
  blake2b,
  blake2s,
  crc32,
  adler32,
  hmac,
];
