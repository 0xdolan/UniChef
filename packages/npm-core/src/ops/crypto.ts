// SPDX-License-Identifier: GPL-3.0-or-later
/** Crypto ops (PRD §3.8): XOR, classical ciphers, AES, PBKDF2 and random bytes. */

import { cbc, ctr, ecb, gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 as pbkdf2Hash } from '@noble/hashes/pbkdf2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { UniChefError } from '../errors.js';
import { HMAC_HASHES, pick } from './hashing.js';
import {
  boolArg,
  bytesArg,
  secretArg,
  defineOp,
  enumArg,
  intArg,
  stringArg,
  type Args,
  type OpContext,
  type Operation,
} from './types.js';

const CHECK_EVERY = 64 * 1024;
const BLOCK = 16;
const GCM_TAG = 16;
const KEY_SIZES = [16, 24, 32];
const GCM_NONCE_MIN = 8;
const GCM_NONCE_MAX = 128;
const ROT_LIMIT = 1_000_000;
const PRINTABLE_FIRST = 0x21;
const PRINTABLE_COUNT = 94;

const cryptoError = (message: string): UniChefError => new UniChefError('E_CRYPTO', message);

// ---------------------------------------------------------------------------
// XOR and classical ciphers

export const xor = defineOp({
  id: 'xor',
  name: 'XOR',
  category: 'Crypto',
  description:
    'XOR with a repeating `key`. `rolling` adds the number of completed passes over the ' +
    'key to each key byte (mod 256), so the key stream changes on every pass. Both ' +
    'schemes are their own inverse.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [{ input: 'hello', args: { key: { encoding: 'hex', value: '20' } }, output: 'HELLO' }],
  args: [secretArg('key'), enumArg('scheme', ['standard', 'rolling'])],
  run(data, args, ctx) {
    const key = args.data('key');
    if (key.length === 0) {
      throw new UniChefError('E_ARG_INVALID', "Argument 'key' must not be empty.");
    }
    ctx.check();
    const rolling = args.text('scheme') === 'rolling';
    const n = key.length;
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      if (i % CHECK_EVERY === 0) {
        ctx.check();
      }
      const k = key[i % n] ?? 0;
      const stream = rolling ? (k + Math.floor(i / n)) & 0xff : k;
      out[i] = (data[i] ?? 0) ^ stream;
    }
    return out;
  },
});

/** Python-style modulo: the result has the sign of `n`. */
const mod = (x: number, n: number): number => ((x % n) + n) % n;

function rotate(ch: string, first: number, size: number, amount: number): string {
  return String.fromCharCode(first + mod(ch.charCodeAt(0) - first + amount, size));
}

export const rot13 = defineOp({
  id: 'rot13',
  name: 'ROT13',
  category: 'Crypto',
  description:
    'Rotate ASCII letters by `amount` (default 13, case kept); with `digits`, also rotate ' +
    '0-9 by the same amount mod 10. Other characters are unchanged.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello, World!', args: {}, output: 'Uryyb, Jbeyq!' }],
  args: [intArg('amount', 13, -ROT_LIMIT, ROT_LIMIT), boolArg('digits')],
  run(text, args) {
    const amount = args.int('amount');
    const pattern = args.flag('digits') ? /[a-zA-Z0-9]/g : /[a-zA-Z]/g;
    return text.replace(pattern, (ch) => {
      if (ch >= 'a') {
        return rotate(ch, 0x61, 26, amount);
      }
      if (ch >= 'A') {
        return rotate(ch, 0x41, 26, amount);
      }
      return rotate(ch, 0x30, 10, amount);
    });
  },
});

export const rot47 = defineOp({
  id: 'rot47',
  name: 'ROT47',
  category: 'Crypto',
  description: 'Rotate printable ASCII U+0021..U+007E by `amount` (default 47) mod 94.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello, World!', args: {}, output: 'w6==@[ (@C=5P' }],
  args: [intArg('amount', 47, -ROT_LIMIT, ROT_LIMIT)],
  run(text, args) {
    const amount = args.int('amount');
    return text.replace(/[!-~]/g, (ch) => rotate(ch, PRINTABLE_FIRST, PRINTABLE_COUNT, amount));
  },
});

export const atbash = defineOp({
  id: 'atbash',
  name: 'Atbash',
  category: 'Crypto',
  description: 'Mirror the ASCII alphabet (A<->Z, case kept). Other characters are unchanged.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello', args: {}, output: 'Svool' }],
  run: (text) =>
    text.replace(/[a-zA-Z]/g, (ch) => {
      const base = ch >= 'a' ? 0x61 : 0x41;
      return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base));
    }),
});

// ---------------------------------------------------------------------------
// Vigenère

function vigenere(text: string, args: Args, ctx: OpContext, sign: number): string {
  const key = args.text('key');
  if (!key) {
    throw new UniChefError('E_ARG_INVALID', 'The Vigenère key is empty.');
  }
  if (!/^[A-Za-z]+$/.test(key)) {
    throw new UniChefError('E_ARG_INVALID', 'The Vigenère key must contain only letters A-Z.');
  }
  const lower = key.toLowerCase();
  const shifts = Array.from(lower, (_, i) => sign * (lower.charCodeAt(i) - 0x61));
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < text.length; i++) {
    if (i % CHECK_EVERY === 0) {
      ctx.check();
    }
    const ch = text.charAt(i);
    const base = ch >= 'a' && ch <= 'z' ? 0x61 : ch >= 'A' && ch <= 'Z' ? 0x41 : 0;
    if (base === 0) {
      out.push(ch);
      continue;
    }
    const shift = shifts[used % shifts.length] ?? 0;
    out.push(String.fromCharCode(base + mod(ch.charCodeAt(0) - base + shift, 26)));
    used++;
  }
  return out.join('');
}

export const vigenereEncode = defineOp({
  id: 'vigenere-encode',
  name: 'Vigenère Encode',
  category: 'Crypto',
  description:
    'Shift each ASCII letter forward by the next letter of `key` (A=0, case kept). Other ' +
    'characters are unchanged and do not use up a key letter.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Hello, World!', args: { key: 'key' }, output: 'Rijvs, Uyvjn!' }],
  args: [stringArg('key')],
  run: (text, args, ctx) => vigenere(text, args, ctx, 1),
});

export const vigenereDecode = defineOp({
  id: 'vigenere-decode',
  name: 'Vigenère Decode',
  category: 'Crypto',
  description: 'Undo `vigenere-encode`: shift each ASCII letter back by the next letter of `key`.',
  inputType: 'string',
  outputType: 'string',
  examples: [{ input: 'Rijvs, Uyvjn!', args: { key: 'key' }, output: 'Hello, World!' }],
  args: [stringArg('key')],
  run: (text, args, ctx) => vigenere(text, args, ctx, -1),
});

// ---------------------------------------------------------------------------
// PBKDF2 and random bytes

export const PBKDF2_MAX_ITERATIONS = 10_000_000;
const PBKDF2_WEAK = 100_000;
const PBKDF2_MAX_LENGTH = 1024;
export const RANDOM_MAX = 64 * 1024 * 1024;
/** A multiple of 32, so seeded output does not depend on chunking. */
const RANDOM_CHUNK = 64 * 1024;

export const pbkdf2 = defineOp({
  id: 'pbkdf2',
  name: 'PBKDF2',
  category: 'Crypto',
  description:
    'Derive a `length`-byte key from the input password (PBKDF2-HMAC, RFC 8018) and ' +
    'return it as hex. Warns W_INSECURE below 100 000 iterations.',
  inputType: 'bytes',
  outputType: 'string',
  examples: [
    {
      input: 'password',
      args: { salt: { encoding: 'utf8', value: 'salt' } },
      output: '0394a2ede332c9a13eb82e9b24631604c31df978b4e2f0fbd2c549944f9d79a5',
    },
  ],
  args: [
    enumArg('hash', [...HMAC_HASHES.keys()]),
    intArg('iterations', PBKDF2_WEAK, 1, PBKDF2_MAX_ITERATIONS),
    bytesArg('salt'),
    intArg('length', 32, 1, PBKDF2_MAX_LENGTH),
  ],
  run(data, args, ctx) {
    const iterations = args.int('iterations');
    if (iterations < PBKDF2_WEAK) {
      ctx.warn('W_INSECURE', `${iterations} PBKDF2 iterations is too few to slow down guessing.`);
    }
    ctx.check();
    const hash = pick(HMAC_HASHES, args, 'hash');
    const key = pbkdf2Hash(hash, data, args.data('salt'), {
      c: iterations,
      dkLen: args.int('length'),
    });
    return bytesToHex(key);
  },
});

export const generateRandomBytes = defineOp({
  id: 'generate-random-bytes',
  name: 'Generate Random Bytes',
  category: 'Crypto',
  description:
    "Replace the input with `length` random bytes: from the platform's secure random " +
    'generator, or, when the recipe has a `seed`, from SHA-256 in counter mode.',
  inputType: 'bytes',
  outputType: 'bytes',
  parity: 'nondeterministic',
  args: [intArg('length', 32, 1, RANDOM_MAX)],
  run(_data, args, ctx) {
    const length = args.int('length');
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += RANDOM_CHUNK) {
      ctx.check();
      out.set(ctx.rng.randomBytes(Math.min(RANDOM_CHUNK, length - i)), i);
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// AES

export const AES_MODES = ['cbc', 'ctr', 'gcm', 'ecb'];
const AES_ARGS = [
  secretArg('key'),
  enumArg('mode', AES_MODES),
  secretArg('iv'),
  enumArg('padding', ['pkcs7', 'none']),
  bytesArg('aad'),
];

/** Check the key (and that `aad` is only given for GCM); return the key. */
function aesKey(args: Args): Uint8Array {
  if (args.data('aad').length > 0 && args.text('mode') !== 'gcm') {
    throw new UniChefError('E_ARG_INVALID', "Argument 'aad' is only used in GCM mode.");
  }
  const key = args.data('key');
  if (!KEY_SIZES.includes(key.length)) {
    throw cryptoError(`AES needs a 16, 24 or 32 byte key, got ${String(key.length)} bytes.`);
  }
  return key;
}

interface BlockCipher {
  encrypt(data: Uint8Array): Uint8Array;
  decrypt(data: Uint8Array): Uint8Array;
}

/** CBC, CTR or ECB without padding (padding is done here, as Python does it). */
function blockMode(key: Uint8Array, args: Args, ctx: OpContext): BlockCipher {
  const name = args.text('mode');
  if (name === 'ecb') {
    ctx.warn('W_INSECURE', 'ECB mode leaks patterns between identical blocks.');
    return ecb(key, { disablePadding: true });
  }
  const iv = args.data('iv');
  if (iv.length !== BLOCK) {
    throw cryptoError(`${name.toUpperCase()} needs a 16-byte IV, got ${String(iv.length)} bytes.`);
  }
  return name === 'cbc' ? cbc(key, iv, { disablePadding: true }) : ctr(key, iv);
}

function gcmCipher(key: Uint8Array, args: Args): BlockCipher {
  const iv = args.data('iv');
  if (iv.length < GCM_NONCE_MIN || iv.length > GCM_NONCE_MAX) {
    throw cryptoError(`GCM needs an 8 to 128 byte IV (nonce), got ${String(iv.length)} bytes.`);
  }
  return gcm(key, iv, args.data('aad'));
}

const padded = (args: Args): boolean =>
  ['cbc', 'ecb'].includes(args.text('mode')) && args.text('padding') === 'pkcs7';

function checkBlocks(args: Args, size: number, what: string): void {
  if (['cbc', 'ecb'].includes(args.text('mode')) && size % BLOCK !== 0) {
    throw cryptoError(`${what} is ${String(size)} bytes, not a multiple of the 16-byte block.`);
  }
}

function pkcs7Pad(data: Uint8Array): Uint8Array {
  const pad = BLOCK - (data.length % BLOCK);
  const out = new Uint8Array(data.length + pad);
  out.set(data);
  out.fill(pad, data.length);
  return out;
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  const pad = data.at(-1) ?? 0;
  const bad = (): UniChefError => cryptoError('Invalid PKCS#7 padding (wrong key or IV?).');
  if (pad < 1 || pad > BLOCK || pad > data.length) {
    throw bad();
  }
  for (let i = data.length - pad; i < data.length; i++) {
    if (data[i] !== pad) {
      throw bad();
    }
  }
  return data.slice(0, data.length - pad);
}

export const aesEncrypt = defineOp({
  id: 'aes-encrypt',
  name: 'AES Encrypt',
  category: 'Crypto',
  description:
    'AES in CBC (default), CTR, GCM or ECB mode. `padding` (PKCS#7 by default) applies to ' +
    'CBC and ECB. In GCM the 16-byte tag is appended and `aad` is authenticated. ECB ' +
    'warns W_INSECURE.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [
    {
      input: 'Attack at dawn',
      args: {
        key: { encoding: 'hex', value: '000102030405060708090a0b0c0d0e0f' },
        iv: { encoding: 'hex', value: '0f0e0d0c0b0a09080706050403020100' },
      },
      output: 'b4 dd 38 c9 96 76 b8 ec b1 d3 ad bd 52 ad 57 70',
    },
  ],
  args: AES_ARGS,
  run(data, args, ctx) {
    const key = aesKey(args);
    if (args.text('mode') === 'gcm') {
      const cipher = gcmCipher(key, args);
      ctx.check();
      return cipher.encrypt(data);
    }
    const cipher = blockMode(key, args, ctx);
    const input = padded(args) ? pkcs7Pad(data) : data;
    checkBlocks(args, input.length, 'Input');
    ctx.check();
    return cipher.encrypt(input);
  },
});

export const aesDecrypt = defineOp({
  id: 'aes-decrypt',
  name: 'AES Decrypt',
  category: 'Crypto',
  description:
    'Inverse of `aes-encrypt` with the same arguments. In GCM the last 16 bytes are the ' +
    'tag; a wrong key, IV, AAD or tag raises E_CRYPTO, as does bad PKCS#7 padding.',
  inputType: 'bytes',
  outputType: 'bytes',
  examples: [
    {
      input: 'r[Q~Cg',
      args: {
        key: { encoding: 'hex', value: '000102030405060708090a0b0c0d0e0f' },
        mode: 'ctr',
        iv: { encoding: 'hex', value: '000000000000000000000000000004b2' },
      },
      output: 'secret',
    },
  ],
  args: AES_ARGS,
  run(data, args, ctx) {
    const key = aesKey(args);
    if (args.text('mode') === 'gcm') {
      if (data.length < GCM_TAG) {
        throw cryptoError('GCM input is shorter than the 16-byte tag.');
      }
      const cipher = gcmCipher(key, args);
      ctx.check();
      try {
        return cipher.decrypt(data);
      } catch {
        throw cryptoError('GCM authentication failed (wrong key, IV, AAD or tag).');
      }
    }
    const cipher = blockMode(key, args, ctx);
    checkBlocks(args, data.length, 'Ciphertext');
    ctx.check();
    const plain = cipher.decrypt(data);
    return padded(args) ? pkcs7Unpad(plain) : plain;
  },
});

export const CRYPTO_OPS: readonly Operation[] = [
  xor,
  rot13,
  rot47,
  atbash,
  vigenereEncode,
  vigenereDecode,
  aesEncrypt,
  aesDecrypt,
  pbkdf2,
  generateRandomBytes,
];
