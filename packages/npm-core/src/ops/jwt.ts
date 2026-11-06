// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * JSON Web Token ops (RFC 7519, JWS compact serialisation RFC 7515, algorithms RFC 7518
 * and RFC 8037): decode, sign and verify. Signatures other than HMAC use WebCrypto.
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import type { CHash } from '@noble/hashes/utils.js';

import { decode as b64decode, encode as b64encode } from '../dish/base64.js';
import { jsonDumps, jsonLoads } from '../dish/json.js';
import type { JsonObject, JsonValue } from '../dish/types.js';
import { encode as utf8Encode } from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import {
  CURVES,
  buffer,
  importKey,
  loadPrivate,
  loadPublic,
  webAlgorithm,
  type LoadedKey,
} from './jwt-keys.js';
import {
  bytesArg,
  defineOp,
  enumArg,
  stringArg,
  type Args,
  type BytesEncoding,
  type OpContext,
  type Operation,
} from './types.js';

export const ALGORITHMS = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
];
const HMAC_HASHES = new Map<string, CHash>([
  ['256', sha256],
  ['384', sha384],
  ['512', sha512],
]);
/** The curve OID and coordinate size of each ES algorithm. */
const ES_CURVES = new Map([
  ['ES256', { oid: '1.2.840.10045.3.1.7', size: 32 }],
  ['ES384', { oid: '1.3.132.0.34', size: 48 }],
  ['ES512', { oid: '1.3.132.0.35', size: 66 }],
]);
const MIN_RSA_BITS = 2048;
const B64URL = /^[A-Za-z0-9_-]*$/;
const SEGMENTS = 3;
const JWE_SEGMENTS = 5;
const KEY_ENCODINGS: readonly BytesEncoding[] = ['utf8', 'hex', 'base64', 'latin1'];

const cryptoError = (message: string): UniChefError => new UniChefError('E_CRYPTO', message);
const decodeError = (message: string): UniChefError => new UniChefError('E_DECODE', message);

// ---------------------------------------------------------------------------
// Compact serialisation

export function b64urlEncode(data: Uint8Array): string {
  return b64encode(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Strict unpadded base64url: no padding, no whitespace, zero trailing bits. */
export function b64urlDecode(text: string, what: string): Uint8Array {
  const data =
    B64URL.test(text) && text.length % 4 !== 1
      ? b64decode(
          text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4),
        )
      : null;
  if (data === null) {
    throw decodeError(`The ${what} is not valid unpadded base64url.`);
  }
  if (b64urlEncode(data) !== text) {
    throw decodeError(`The ${what} has non-zero trailing bits.`);
  }
  return data;
}

const STRICT_UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function jsonObject(raw: Uint8Array, what: string, ctx: OpContext): JsonObject {
  let text: string;
  try {
    text = STRICT_UTF8.decode(raw);
  } catch {
    throw decodeError(`The ${what} is not valid UTF-8.`);
  }
  let value: JsonValue;
  try {
    value = jsonLoads(text, ctx.warn);
  } catch (exc) {
    if (exc instanceof UniChefError) {
      throw decodeError(`The ${what} is not valid JSON.`);
    }
    throw exc;
  }
  if (!(value instanceof Map)) {
    throw decodeError(`The ${what} is not a JSON object.`);
  }
  return value;
}

interface Token {
  readonly header: JsonObject;
  readonly payload: JsonObject;
  readonly signature: Uint8Array;
  readonly signingInput: Uint8Array;
}

function parseToken(text: string, ctx: OpContext): Token {
  const parts = text.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '').split('.');
  if (parts.length === JWE_SEGMENTS) {
    throw decodeError('Encrypted tokens (JWE, five segments) are not supported.');
  }
  const [head = '', body = '', sig = ''] = parts;
  if (parts.length !== SEGMENTS) {
    throw decodeError(`A JWT has three dot-separated segments, found ${String(parts.length)}.`);
  }
  return {
    header: jsonObject(b64urlDecode(head, 'header'), 'header', ctx),
    payload: jsonObject(b64urlDecode(body, 'payload'), 'payload', ctx),
    signature: b64urlDecode(sig, 'signature'),
    signingInput: utf8Encode(`${head}.${body}`),
  };
}

// ---------------------------------------------------------------------------
// Keys and signatures

function hmacKey(alg: string, args: Args, ctx: OpContext): Uint8Array {
  const key = args.data('key');
  if (key.length === 0) {
    throw new UniChefError('E_ARG_INVALID', "Argument 'key' (the HMAC secret) is empty.");
  }
  const bits = Number(alg.slice(2));
  if (key.length * 8 < bits) {
    ctx.warn(
      'W_INSECURE',
      `${alg} secret is ${String(key.length * 8)} bits; RFC 7518 requires at least ` +
        `${String(bits)}.`,
    );
  }
  return key;
}

function hmacSign(alg: string, message: Uint8Array, args: Args, ctx: OpContext): Uint8Array {
  const key = hmacKey(alg, args, ctx);
  const hash = HMAC_HASHES.get(alg.slice(2)) ?? sha256;
  return hmac(hash, key, message);
}

function checkKey(alg: string, key: LoadedKey, ctx: OpContext): void {
  const family = alg.slice(0, 2);
  if (family === 'RS' || family === 'PS') {
    if (key.kind !== 'rsa') {
      throw cryptoError(`${alg} needs an RSA key.`);
    }
    const bits = key.bits ?? 0;
    if (bits < MIN_RSA_BITS) {
      ctx.warn('W_INSECURE', `RSA key is ${String(bits)} bits; use at least 2048.`);
    }
  } else if (family === 'ES') {
    const want = ES_CURVES.get(alg)?.oid ?? '';
    if (key.kind !== 'ec' || key.curve !== want) {
      throw cryptoError(`${alg} needs an EC key on curve ${CURVES.get(want)?.name ?? want}.`);
    }
  } else if (key.kind !== 'ed25519' && key.kind !== 'ed448') {
    throw cryptoError('EdDSA needs an Ed25519 or Ed448 key.');
  }
}

/** RSA-PSS uses a salt as long as the digest (RFC 7518 §3.5). */
function signParams(alg: string, key: LoadedKey): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
  if (alg.startsWith('PS')) {
    return { name: 'RSA-PSS', saltLength: Number(alg.slice(2)) / 8 };
  }
  if (alg.startsWith('ES')) {
    return { name: 'ECDSA', hash: `SHA-${alg.slice(2)}` };
  }
  return webAlgorithm(alg, key);
}

async function sign(
  alg: string,
  message: Uint8Array,
  args: Args,
  ctx: OpContext,
): Promise<Uint8Array> {
  if (alg.startsWith('HS')) {
    return hmacSign(alg, message, args, ctx);
  }
  const loaded = loadPrivate(args.data('key'));
  checkKey(alg, loaded, ctx);
  const key = await importKey(alg, loaded, 'sign');
  try {
    const sig = await globalThis.crypto.subtle.sign(signParams(alg, loaded), key, buffer(message));
    return new Uint8Array(sig);
  } catch (exc) {
    const why = exc instanceof Error ? exc.message : String(exc);
    throw cryptoError(`${alg} signing failed (${why}).`);
  }
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

async function verify(
  alg: string,
  message: Uint8Array,
  signature: Uint8Array,
  args: Args,
  ctx: OpContext,
): Promise<boolean> {
  if (alg.startsWith('HS')) {
    return equalBytes(hmacSign(alg, message, args, ctx), signature);
  }
  const loaded = loadPublic(args.data('key'));
  checkKey(alg, loaded, ctx);
  const es = ES_CURVES.get(alg);
  if (es !== undefined && signature.length !== 2 * es.size) {
    return false;
  }
  const key = await importKey(alg, loaded, 'verify');
  try {
    return await globalThis.crypto.subtle.verify(
      signParams(alg, loaded),
      key,
      buffer(signature),
      buffer(message),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Operations

export const jwtDecode = defineOp({
  id: 'jwt-decode',
  name: 'JWT Decode',
  category: 'Crypto',
  description:
    'Split a JWT into `header`, `payload` and `signature` (base64url text), without ' +
    'checking the signature or time claims. Surrounding whitespace is ignored.',
  inputType: 'string',
  outputType: 'json',
  run(text, _args, ctx) {
    const token = parseToken(text, ctx);
    return new Map<string, JsonValue>([
      ['header', token.header],
      ['payload', token.payload],
      ['signature', b64urlEncode(token.signature)],
    ]);
  },
});

export const jwtSign = defineOp({
  id: 'jwt-sign',
  name: 'JWT Sign',
  category: 'Crypto',
  description:
    'Sign a JSON object as a JWT. `key` is the HMAC secret for HS*, or a PEM/DER private ' +
    'key. `header` adds JSON fields after `alg` and `typ` ("JWT"); it may replace `typ` ' +
    'but not `alg`. PS* and ES* signatures are randomised; `none` warns W_INSECURE.',
  inputType: 'json',
  outputType: 'string',
  args: [
    enumArg('algorithm', [...ALGORITHMS, 'none']),
    bytesArg('key', '', KEY_ENCODINGS),
    stringArg('header', '', true),
  ],
  parity: 'roundtrip',
  async run(payload, args, ctx) {
    if (!(payload instanceof Map)) {
      throw new UniChefError('E_INPUT_TYPE', 'The JWT payload must be a JSON object.');
    }
    const alg = args.text('algorithm');
    const header: JsonObject = new Map<string, JsonValue>([
      ['alg', alg],
      ['typ', 'JWT'],
    ]);
    const extraText = args.text('header').trim();
    if (extraText !== '') {
      let extra: JsonValue;
      try {
        extra = jsonLoads(extraText, ctx.warn);
      } catch (exc) {
        if (exc instanceof UniChefError) {
          throw new UniChefError('E_ARG_INVALID', "Argument 'header' is not valid JSON.");
        }
        throw exc;
      }
      if (!(extra instanceof Map)) {
        throw new UniChefError('E_ARG_INVALID', "Argument 'header' must be a JSON object.");
      }
      if (extra.has('alg') && extra.get('alg') !== alg) {
        throw new UniChefError('E_ARG_INVALID', "Set 'alg' with the 'algorithm' argument.");
      }
      for (const [k, v] of extra) {
        header.set(k, v);
      }
    }
    const encoded =
      b64urlEncode(utf8Encode(jsonDumps(header))) +
      '.' +
      b64urlEncode(utf8Encode(jsonDumps(payload)));
    if (alg === 'none') {
      ctx.warn('W_INSECURE', "Unsecured JWT (alg 'none') carries no signature.");
      return encoded + '.';
    }
    return encoded + '.' + b64urlEncode(await sign(alg, utf8Encode(encoded), args, ctx));
  },
});

export const jwtVerify = defineOp({
  id: 'jwt-verify',
  name: 'JWT Verify',
  category: 'Crypto',
  description:
    "Check a JWT's signature and return its payload. The header `alg` must equal " +
    '`algorithm` (so `none` and algorithm swaps are refused). `key` is the HMAC secret, ' +
    'or a PEM/DER public key, certificate or private key. Tokens with `crit` are ' +
    'refused. Time claims (`exp`, `nbf`) are not checked. Failures raise E_CRYPTO.',
  inputType: 'string',
  outputType: 'json',
  args: [enumArg('algorithm', ALGORITHMS), bytesArg('key', '', KEY_ENCODINGS)],
  async run(text, args, ctx) {
    const token = parseToken(text, ctx);
    const alg = args.text('algorithm');
    const found = token.header.get('alg');
    if (found !== alg) {
      throw cryptoError(`Header alg is ${jsonDumps(found ?? null)}, expected ${jsonDumps(alg)}.`);
    }
    if (token.header.has('crit')) {
      throw cryptoError("The token has critical header extensions ('crit'), not supported.");
    }
    ctx.check();
    if (!(await verify(alg, token.signingInput, token.signature, args, ctx))) {
      throw cryptoError('Invalid signature.');
    }
    return token.payload;
  },
});

export const JWT_OPS: readonly Operation[] = [jwtDecode, jwtSign, jwtVerify];
