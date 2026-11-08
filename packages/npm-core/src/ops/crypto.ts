// SPDX-License-Identifier: GPL-3.0-or-later
/** Crypto ops (PRD §3.8): XOR, classical ciphers and AES. */

import { cbc, ctr, ecb, gcm } from '@noble/ciphers/aes.js';

import { UniChefError } from '../errors.js';
import {
  boolArg,
  bytesArg,
  defineOp,
  enumArg,
  intArg,
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
  args: [bytesArg('key'), enumArg('scheme', ['standard', 'rolling'])],
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
// AES

export const AES_MODES = ['cbc', 'ctr', 'gcm', 'ecb'];
const AES_ARGS = [
  bytesArg('key'),
  enumArg('mode', AES_MODES),
  bytesArg('iv'),
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

export const CRYPTO_OPS: readonly Operation[] = [xor, rot13, rot47, atbash, aesEncrypt, aesDecrypt];
