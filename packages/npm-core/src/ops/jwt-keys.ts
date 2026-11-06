// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Key loading for the JWT ops: PEM/DER private keys (PKCS#8, PKCS#1, SEC1), public keys
 * (SPKI, PKCS#1) and X.509 certificates, turned into WebCrypto keys.
 *
 * A minimal DER reader finds the key type, curve and RSA size, so the checks and error
 * messages match the Python core (which uses `cryptography`) before WebCrypto is asked to
 * import anything. RSA keys are always rebuilt as `rsaEncryption` PKCS#8/SPKI from their
 * PKCS#1 body, so PKCS#1 PEM files and RSA-PSS-tagged keys import the same way.
 */

import { decode as b64decode } from '../dish/base64.js';
import { UniChefError } from '../errors.js';

const cryptoError = (message: string): UniChefError => new UniChefError('E_CRYPTO', message);

// ---------------------------------------------------------------------------
// DER

const SEQUENCE = 0x30;
const INTEGER = 0x02;
const BIT_STRING = 0x03;
const OCTET_STRING = 0x04;
const NULL = 0x05;
const OID = 0x06;
const CONTEXT_0 = 0xa0;

/** Raised for malformed DER; callers turn it into their own E_CRYPTO message. */
class DerError extends Error {}

export interface Tlv {
  readonly tag: number;
  /** The whole element, header included. */
  readonly raw: Uint8Array;
  /** The content octets. */
  readonly body: Uint8Array;
}

/** Read one definite-length element at `pos` (single-byte tags only). */
function readTlv(buf: Uint8Array, pos: number): Tlv {
  const tag = buf[pos];
  let len = buf[pos + 1];
  if (tag === undefined || len === undefined || (tag & 0x1f) === 0x1f) {
    throw new DerError('truncated');
  }
  let start = pos + 2;
  if (len & 0x80) {
    const count = len & 0x7f;
    if (count === 0 || count > 4) {
      throw new DerError('bad length');
    }
    len = 0;
    for (let i = 0; i < count; i++) {
      const byte = buf[start + i];
      if (byte === undefined) {
        throw new DerError('truncated');
      }
      len = len * 256 + byte;
    }
    start += count;
  }
  const end = start + len;
  if (end > buf.length) {
    throw new DerError('truncated');
  }
  return { tag, raw: buf.subarray(pos, end), body: buf.subarray(start, end) };
}

/** Parse `buf` as exactly one element. */
export function parseDer(buf: Uint8Array): Tlv {
  const tlv = readTlv(buf, 0);
  if (tlv.raw.length !== buf.length) {
    throw new DerError('trailing data');
  }
  return tlv;
}

/** The elements inside a constructed element. */
export function children(tlv: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let pos = 0; pos < tlv.body.length;) {
    const child = readTlv(tlv.body, pos);
    out.push(child);
    pos += child.raw.length;
  }
  return out;
}

function expect(tlv: Tlv | undefined, tag: number): Tlv {
  if (tlv?.tag !== tag) {
    throw new DerError(`expected tag ${String(tag)}`);
  }
  return tlv;
}

export function oidString(body: Uint8Array): string {
  const first = body[0];
  if (first === undefined) {
    throw new DerError('empty OID');
  }
  const top = Math.min(2, Math.floor(first / 40));
  const parts = [top, first - top * 40];
  let value = 0;
  for (const byte of body.subarray(1)) {
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join('.');
}

function encodeLength(len: number): number[] {
  if (len < 0x80) {
    return [len];
  }
  const bytes: number[] = [];
  for (let n = len; n > 0; n = Math.floor(n / 256)) {
    bytes.unshift(n & 0xff);
  }
  return [0x80 | bytes.length, ...bytes];
}

function der(tag: number, ...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const head = [tag, ...encodeLength(len)];
  const out = new Uint8Array(head.length + len);
  out.set(head);
  let pos = head.length;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

function oidBytes(dotted: string): Uint8Array {
  const [a = 0, b = 0, ...rest] = dotted.split('.').map(Number);
  const out = [a * 40 + b];
  for (const arc of rest) {
    const chunk = [arc & 0x7f];
    for (let n = Math.floor(arc / 128); n > 0; n = Math.floor(n / 128)) {
      chunk.unshift(0x80 | (n & 0x7f));
    }
    out.push(...chunk);
  }
  return der(OID, new Uint8Array(out));
}

// ---------------------------------------------------------------------------
// Key model

const RSA_ENCRYPTION = '1.2.840.113549.1.1.1';
const RSA_PSS = '1.2.840.113549.1.1.10';
const EC_PUBLIC_KEY = '1.2.840.10045.2.1';
const ED25519 = '1.3.101.112';
const ED448 = '1.3.101.113';
/** Key types `cryptography` loads but no JWS algorithm uses (DSA, X25519, X448, DH). */
const UNUSABLE = new Set(['1.2.840.10040.4.1', '1.3.101.110', '1.3.101.111', '1.2.840.10046.2.1']);

/** WebCrypto name and `cryptography` name of each JWS curve. */
export const CURVES = new Map([
  ['1.2.840.10045.3.1.7', { web: 'P-256', name: 'secp256r1' }],
  ['1.3.132.0.34', { web: 'P-384', name: 'secp384r1' }],
  ['1.3.132.0.35', { web: 'P-521', name: 'secp521r1' }],
]);

export type KeyKind = 'rsa' | 'ec' | 'ed25519' | 'ed448' | 'unusable';

export interface LoadedKey {
  readonly kind: KeyKind;
  readonly isPrivate: boolean;
  /** PKCS#8 for private keys, SPKI for public keys. */
  readonly der: Uint8Array;
  /** The curve OID of an EC key. */
  readonly curve?: string;
  /** The modulus size of an RSA key. */
  readonly bits?: number;
}

function intBits(body: Uint8Array): number {
  let i = 0;
  while (i < body.length - 1 && body[i] === 0) {
    i++;
  }
  const lead = body[i] ?? 0;
  return (body.length - i - 1) * 8 + (lead === 0 ? 0 : 32 - Math.clz32(lead));
}

const RSA_ALG_ID = der(SEQUENCE, oidBytes(RSA_ENCRYPTION), new Uint8Array([NULL, 0]));
const VERSION_0 = new Uint8Array([INTEGER, 1, 0]);

function rsaPrivate(pkcs1: Uint8Array): LoadedKey {
  const fields = children(expect(parseDer(pkcs1), SEQUENCE));
  const modulus = expect(fields[1], INTEGER);
  const pkcs8 = der(SEQUENCE, VERSION_0, RSA_ALG_ID, der(OCTET_STRING, pkcs1));
  return { kind: 'rsa', isPrivate: true, der: pkcs8, bits: intBits(modulus.body) };
}

function rsaPublic(pkcs1: Uint8Array): LoadedKey {
  const fields = children(expect(parseDer(pkcs1), SEQUENCE));
  const modulus = expect(fields[0], INTEGER);
  expect(fields[1], INTEGER);
  const spki = der(SEQUENCE, RSA_ALG_ID, der(BIT_STRING, new Uint8Array([0]), pkcs1));
  return { kind: 'rsa', isPrivate: false, der: spki, bits: intBits(modulus.body) };
}

function ecPrivate(sec1: Uint8Array, curveParam?: Tlv): LoadedKey {
  const fields = children(expect(parseDer(sec1), SEQUENCE));
  expect(fields[1], OCTET_STRING);
  const params = curveParam ?? children(expect(fields[2], CONTEXT_0))[0];
  const curveOid = expect(params, OID);
  const algId = der(SEQUENCE, oidBytes(EC_PUBLIC_KEY), curveOid.raw);
  const pkcs8 = der(SEQUENCE, VERSION_0, algId, der(OCTET_STRING, sec1));
  return { kind: 'ec', isPrivate: true, der: pkcs8, curve: oidString(curveOid.body) };
}

/** Classify an algorithm identifier; `null` means `cryptography` cannot load it. */
function algorithmKind(oid: string): KeyKind | null {
  if (oid === RSA_ENCRYPTION || oid === RSA_PSS) {
    return 'rsa';
  }
  if (oid === EC_PUBLIC_KEY) {
    return 'ec';
  }
  if (oid === ED25519) {
    return 'ed25519';
  }
  if (oid === ED448) {
    return 'ed448';
  }
  return UNUSABLE.has(oid) ? 'unusable' : null;
}

function pkcs8(tlv: Tlv): LoadedKey {
  const [version, algId, key] = children(tlv);
  expect(version, INTEGER);
  const [oid, params] = children(expect(algId, SEQUENCE));
  const keyOctets = expect(key, OCTET_STRING);
  const kind = algorithmKind(oidString(expect(oid, OID).body));
  switch (kind) {
    case null:
      throw new DerError('unknown key type');
    case 'rsa':
      return rsaPrivate(keyOctets.body);
    case 'ec':
      return ecPrivate(keyOctets.body, params);
    default:
      return { kind, isPrivate: true, der: tlv.raw };
  }
}

function spki(tlv: Tlv): LoadedKey {
  const [algId, bits] = children(tlv);
  const [oid, params] = children(expect(algId, SEQUENCE));
  const keyBits = expect(bits, BIT_STRING);
  const kind = algorithmKind(oidString(expect(oid, OID).body));
  switch (kind) {
    case null:
      throw new DerError('unknown key type');
    case 'rsa':
      return rsaPublic(keyBits.body.subarray(1));
    case 'ec':
      return {
        kind,
        isPrivate: false,
        der: tlv.raw,
        curve: oidString(expect(params, OID).body),
      };
    default:
      return { kind, isPrivate: false, der: tlv.raw };
  }
}

/** A DER private key: PKCS#8, or the traditional PKCS#1 RSA and SEC1 EC forms. */
function privateDer(buf: Uint8Array): LoadedKey {
  const tlv = expect(parseDer(buf), SEQUENCE);
  const fields = children(tlv);
  if (fields[1]?.tag === SEQUENCE) {
    return pkcs8(tlv);
  }
  if (fields[1]?.tag === OCTET_STRING) {
    return ecPrivate(buf);
  }
  if (fields.length === 9 && fields.every((f) => f.tag === INTEGER)) {
    return rsaPrivate(buf);
  }
  if (fields.length === 6 && fields.every((f) => f.tag === INTEGER)) {
    return { kind: 'unusable', isPrivate: true, der: buf };
  }
  throw new DerError('unknown private key format');
}

/** A DER public key: SPKI or PKCS#1 RSA. */
function publicDer(buf: Uint8Array): LoadedKey {
  const tlv = expect(parseDer(buf), SEQUENCE);
  const first = children(tlv)[0];
  return first?.tag === SEQUENCE ? spki(tlv) : rsaPublic(buf);
}

// ---------------------------------------------------------------------------
// PEM

const PEM = /-----BEGIN ([A-Z0-9 ]+)-----\r?\n([\s\S]*?)-----END \1-----/;

interface PemBlock {
  readonly label: string;
  readonly der: Uint8Array;
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += String.fromCharCode(b);
  }
  return out;
}

function readPem(text: string): PemBlock {
  const match = PEM.exec(text);
  if (match === null) {
    throw new DerError('no PEM block');
  }
  const [, label = '', body = ''] = match;
  if (body.includes(':')) {
    throw new DerError('encrypted PEM');
  }
  const der = b64decode(body.replace(/[ \t\r\n]/g, ''));
  if (der === null) {
    throw new DerError('bad base64');
  }
  return { label, der };
}

/** Python's `bytes.lstrip()` whitespace. */
const isPem = (text: string): boolean => text.replace(/^[ \t\n\r\v\f]+/, '').startsWith('-----');

const PRIVATE_LABELS = new Set(['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY']);
const PUBLIC_LABELS = new Set(['PUBLIC KEY', 'RSA PUBLIC KEY']);

function checkUsable(key: LoadedKey, what: 'private' | 'public'): LoadedKey {
  if (key.kind === 'unusable') {
    throw cryptoError(`The ${what} key type is not used by any JWS algorithm.`);
  }
  return key;
}

/** An unencrypted PEM or DER private key. */
export function loadPrivate(key: Uint8Array): LoadedKey {
  const text = latin1(key);
  let parsed: LoadedKey;
  try {
    if (isPem(text)) {
      const block = readPem(text);
      if (!PRIVATE_LABELS.has(block.label)) {
        throw new DerError(`unexpected ${block.label}`);
      }
      parsed = privateDer(block.der);
    } else {
      parsed = privateDer(key);
    }
  } catch (exc) {
    if (!(exc instanceof DerError)) {
      throw exc;
    }
    throw cryptoError("Argument 'key' is not an unencrypted PEM or DER private key.");
  }
  return checkUsable(parsed, 'private');
}

function certificateKey(der: Uint8Array): LoadedKey {
  const tbs = children(expect(children(expect(parseDer(der), SEQUENCE))[0], SEQUENCE));
  const fields = tbs[0]?.tag === CONTEXT_0 ? tbs.slice(1) : tbs;
  return spki(expect(fields[5], SEQUENCE));
}

/** A public key, a certificate, or a private key (its public half is used). */
export function loadPublic(key: Uint8Array): LoadedKey {
  const text = latin1(key);
  const pem = isPem(text);
  if (pem && text.includes('CERTIFICATE')) {
    try {
      const block = readPem(text);
      if (block.label !== 'CERTIFICATE') {
        throw new DerError(`unexpected ${block.label}`);
      }
      return checkUsable(certificateKey(block.der), 'public');
    } catch (exc) {
      if (!(exc instanceof DerError)) {
        throw exc;
      }
      throw cryptoError("Argument 'key' is not a valid PEM certificate.");
    }
  }
  if (pem && text.includes('PRIVATE KEY')) {
    return loadPrivate(key);
  }
  let parsed: LoadedKey;
  try {
    if (pem) {
      const block = readPem(text);
      if (!PUBLIC_LABELS.has(block.label)) {
        throw new DerError(`unexpected ${block.label}`);
      }
      parsed = publicDer(block.der);
    } else {
      parsed = publicDer(key);
    }
  } catch (exc) {
    if (!(exc instanceof DerError)) {
      throw exc;
    }
    throw cryptoError("Argument 'key' is not a PEM or DER public key.");
  }
  return checkUsable(parsed, 'public');
}

// ---------------------------------------------------------------------------
// WebCrypto

const subtle = (): SubtleCrypto => globalThis.crypto.subtle;

/** Copy into a fresh ArrayBuffer-backed array, as WebCrypto's typings require. */
export const buffer = (data: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(data);

/** The WebCrypto algorithm for a JWS `alg` and a checked key. */
export function webAlgorithm(
  alg: string,
  key: LoadedKey,
): RsaHashedImportParams | EcKeyImportParams | Algorithm {
  const hash = `SHA-${alg.slice(2)}`;
  if (alg.startsWith('RS')) {
    return { name: 'RSASSA-PKCS1-v1_5', hash };
  }
  if (alg.startsWith('PS')) {
    return { name: 'RSA-PSS', hash };
  }
  if (alg.startsWith('ES')) {
    return { name: 'ECDSA', namedCurve: CURVES.get(key.curve ?? '')?.web ?? '' };
  }
  return { name: key.kind === 'ed448' ? 'Ed448' : 'Ed25519' };
}

/** Import a loaded key for `usage`; a private key used to verify gives its public half. */
export async function importKey(
  alg: string,
  key: LoadedKey,
  usage: 'sign' | 'verify',
): Promise<CryptoKey> {
  const algorithm = webAlgorithm(alg, key);
  try {
    if (!key.isPrivate) {
      return await subtle().importKey('spki', buffer(key.der), algorithm, false, [usage]);
    }
    const priv = await subtle().importKey('pkcs8', buffer(key.der), algorithm, usage === 'verify', [
      'sign',
    ]);
    if (usage === 'sign') {
      return priv;
    }
    const jwk = await subtle().exportKey('jwk', priv);
    const publicFields = ['kty', 'crv', 'x', 'y', 'n', 'e'] as const;
    const pub: JsonWebKey = Object.fromEntries(
      publicFields.filter((f) => jwk[f] !== undefined).map((f) => [f, jwk[f]]),
    );
    return await subtle().importKey('jwk', pub, algorithm, false, ['verify']);
  } catch (exc) {
    const why = exc instanceof Error ? exc.message : String(exc);
    throw cryptoError(`The key cannot be used for ${alg} (${why}).`);
  }
}
