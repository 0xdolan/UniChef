// SPDX-License-Identifier: GPL-3.0-or-later
import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { Dish } from '../src/dish/types.js';
import { ofBytes } from '../src/dish/types.js';
import { UniChefError } from '../src/errors.js';
import { adler32Update, crc32Update } from '../src/ops/hashing.js';
import { children, loadPrivate, loadPublic, oidString, parseDer } from '../src/ops/jwt-keys.js';
import { runOperation } from '../src/recipe/run.js';

const enc = new TextEncoder();

interface KeyArg {
  encoding: string;
  value: string;
}
const utf8Key = (s: string | Buffer): KeyArg => ({ encoding: 'utf8', value: s.toString() });
const hexKey = (b: Buffer | Uint8Array): KeyArg => ({
  encoding: 'hex',
  value: Buffer.from(b).toString('hex'),
});

async function sign(alg: string, key: KeyArg): Promise<Dish> {
  const json: Dish = { type: 'json', value: new Map([['sub', 'x']]) };
  return (await runOperation('jwt-sign', { algorithm: alg, key }, json)).dish;
}

async function verify(alg: string, key: KeyArg, token: Dish): Promise<Dish> {
  return (await runOperation('jwt-verify', { algorithm: alg, key }, token)).dish;
}

async function signVerify(alg: string, signKey: KeyArg, verifyKey: KeyArg): Promise<void> {
  const out = await verify(alg, verifyKey, await sign(alg, signKey));
  expect(out.value).toEqual(new Map([['sub', 'x']]));
}

async function code(p: Promise<unknown>): Promise<string> {
  return p.then(
    () => 'ok',
    (exc: unknown) => (exc instanceof UniChefError ? exc.code : String(exc)),
  );
}

const pem = (label: string, body: string): Uint8Array =>
  enc.encode(`-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`);

describe('checksums', () => {
  it('match zlib check values and continue across chunks', () => {
    const data = enc.encode('123456789');
    expect(crc32Update(data).toString(16)).toBe('cbf43926');
    expect(crc32Update(data.subarray(5), crc32Update(data.subarray(0, 5)))).toBe(crc32Update(data));
    const big = new Uint8Array(20000).fill(0xff);
    expect(adler32Update(big.subarray(7000), adler32Update(big.subarray(0, 7000)))).toBe(
      adler32Update(big),
    );
  });
});

describe('DER helpers', () => {
  it('reads OIDs and rejects malformed input', () => {
    expect(oidString(Uint8Array.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d]))).toBe('1.2.840.113549');
    expect(() => oidString(new Uint8Array())).toThrow();
    expect(() => parseDer(Uint8Array.from([0x30, 0x05, 0x00]))).toThrow();
    expect(() => parseDer(Uint8Array.from([0x30, 0x00, 0x00]))).toThrow();
    expect(() => parseDer(Uint8Array.from([0x30, 0x80]))).toThrow();
    expect(() => parseDer(Uint8Array.from([0x30, 0x82, 0x01]))).toThrow();
    expect(() => parseDer(Uint8Array.from([0x1f, 0x00]))).toThrow();
    expect([...parseDer(Uint8Array.from([0x04, 0x81, 0x01, 0x07])).body]).toEqual([7]);
    expect(children(parseDer(Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x05])))).toHaveLength(1);
  });
});

describe('JWT key formats', () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const ed = generateKeyPairSync('ed25519');

  it('accepts PKCS#1 and SEC1 PEM and DER keys', async () => {
    const pkcs1 = rsa.privateKey.export({ type: 'pkcs1', format: 'pem' });
    const rsaPub = rsa.publicKey.export({ type: 'pkcs1', format: 'pem' });
    await signVerify('RS256', utf8Key(pkcs1), utf8Key(rsaPub));
    await signVerify('PS384', utf8Key(pkcs1), utf8Key(pkcs1));

    const sec1 = ec.privateKey.export({ type: 'sec1', format: 'pem' });
    const ecDer = ec.publicKey.export({ type: 'spki', format: 'der' });
    await signVerify('ES256', utf8Key(sec1), hexKey(ecDer));
    const sec1Der = ec.privateKey.export({ type: 'sec1', format: 'der' });
    await signVerify('ES256', hexKey(sec1Der), utf8Key(sec1));

    const rsaDer = rsa.privateKey.export({ type: 'pkcs1', format: 'der' });
    const rsaPubDer = rsa.publicKey.export({ type: 'pkcs1', format: 'der' });
    await signVerify('RS512', hexKey(rsaDer), hexKey(rsaPubDer));

    const edDer = ed.privateKey.export({ type: 'pkcs8', format: 'der' });
    const edPem = ed.privateKey.export({ type: 'pkcs8', format: 'pem' });
    await signVerify('EdDSA', hexKey(edDer), utf8Key(edPem));
  });

  it('refuses unusable, encrypted and malformed keys', async () => {
    const dsa = generateKeyPairSync('dsa', { modulusLength: 1024, divisorLength: 160 });
    const dsaDer = new Uint8Array(dsa.privateKey.export({ type: 'pkcs8', format: 'der' }));
    expect(() => loadPrivate(dsaDer)).toThrow(/not used by any JWS/);
    const x25519 = generateKeyPairSync('x25519');
    const xPub = new Uint8Array(x25519.publicKey.export({ type: 'spki', format: 'der' }));
    expect(() => loadPublic(xPub)).toThrow(/not used by any JWS/);

    const encrypted = rsa.privateKey.export({
      type: 'pkcs1',
      format: 'pem',
      cipher: 'aes-128-cbc',
      passphrase: 'pw',
    });
    expect(() => loadPrivate(enc.encode(encrypted.toString()))).toThrow(/unencrypted/);
    expect(() => loadPrivate(pem('FOO', 'AAAA'))).toThrow(/unencrypted/);
    expect(() => loadPrivate(enc.encode('-----no pem'))).toThrow(/unencrypted/);
    expect(() => loadPrivate(pem('PRIVATE KEY', '!!'))).toThrow(/unencrypted/);
    expect(() => loadPrivate(Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x00]))).toThrow(
      /unencrypted/,
    );
    expect(() => loadPublic(pem('PRIVATE KEY', 'AA=='))).toThrow(/unencrypted/);
    expect(() => loadPublic(pem('FOO', 'AAAA'))).toThrow(/public key/);
    expect(() => loadPublic(pem('X CERTIFICATE', 'AAAA'))).toThrow(/certificate/);
    // SPKI with an unknown algorithm OID (1.2.3).
    const unknown = Uint8Array.from([
      0x30, 0x09, 0x30, 0x04, 0x06, 0x02, 0x2a, 0x03, 0x03, 0x01, 0x00,
    ]);
    expect(() => loadPublic(unknown)).toThrow(/public key/);

    // Bytes that parse but WebCrypto refuses: an EC point that is not on the curve.
    const token = await sign(
      'ES256',
      utf8Key(ec.privateKey.export({ type: 'pkcs8', format: 'pem' })),
    );
    const bad = new Uint8Array(ec.publicKey.export({ type: 'spki', format: 'der' }));
    bad[bad.length - 1] = (bad.at(-1) ?? 0) ^ 1;
    expect(await code(verify('ES256', hexKey(bad), token))).toBe('E_CRYPTO');
  });
});

describe('cancellation', () => {
  it('is checked by hashing, checksums, XOR and AES', async () => {
    const controller = new AbortController();
    controller.abort();
    const key = utf8Key('0123456789abcdef');
    const cases: [string, Record<string, unknown>][] = [
      ['sha2', {}],
      ['crc32', {}],
      ['xor', { key }],
      ['aes-encrypt', { key, iv: key }],
      ['aes-decrypt', { key, iv: key, mode: 'gcm' }],
    ];
    for (const [op, args] of cases) {
      const run = runOperation(op, args, ofBytes(new Uint8Array(32)), {
        signal: controller.signal,
      });
      expect(await code(run)).toBe('E_CANCELLED');
    }
  });
});
