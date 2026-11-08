// SPDX-License-Identifier: GPL-3.0-or-later
import { generateKeyPairSync, verify } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  parseServiceAccount,
  publish,
  serviceAccountJwt,
  type Fetch,
  type ServiceAccount,
} from '../build/cws.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ACCOUNT: ServiceAccount = {
  client_email: 'publisher@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/** A fake API that answers each call with the next response in `replies`. */
function fakeApi(replies: readonly [number, unknown][]): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...replies];
  const fetch: Fetch = (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (next === undefined) throw new Error(`unexpected call: ${url}`);
    return Promise.resolve(new Response(JSON.stringify(next[1]), { status: next[0] }));
  };
  return { fetch, calls };
}

const run = (fetch: Fetch, staged = false): Promise<string> =>
  publish({
    account: ACCOUNT,
    publisherId: 'pub',
    extensionId: 'ext',
    zip: new Uint8Array([1, 2, 3]),
    expectedVersion: '0.0.99.1',
    staged,
    fetch,
    sleep: () => Promise.resolve(),
    now: () => 1_000,
    log: () => undefined,
  });

const TOKEN: [number, unknown] = [200, { access_token: 'tok' }];

describe('parseServiceAccount', () => {
  it('reads the two fields it needs', () => {
    expect(parseServiceAccount(JSON.stringify({ ...ACCOUNT, type: 'service_account' }))).toEqual(
      ACCOUNT,
    );
  });

  it('rejects text that is not a key file', () => {
    expect(() => parseServiceAccount('not json')).toThrow(/not JSON/);
    expect(() => parseServiceAccount('{"client_email":"a"}')).toThrow(/private_key/);
  });
});

describe('serviceAccountJwt', () => {
  it('signs the Chrome Web Store scope with RS256', () => {
    const [header = '', claims = '', signature = ''] = serviceAccountJwt(ACCOUNT, 1_000).split('.');
    const decode = (s: string): unknown => JSON.parse(Buffer.from(s, 'base64url').toString());
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(claims)).toEqual({
      iss: ACCOUNT.client_email,
      scope: 'https://www.googleapis.com/auth/chromewebstore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_000,
      exp: 1_600,
    });
    const ok = verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${claims}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    );
    expect(ok).toBe(true);
  });
});

describe('publish', () => {
  it('uploads, waits for the upload, then submits', async () => {
    const api = fakeApi([
      TOKEN,
      [200, { uploadState: 'IN_PROGRESS' }],
      [200, { lastAsyncUploadState: 'IN_PROGRESS' }],
      [200, { lastAsyncUploadState: 'SUCCEEDED' }],
      [200, { state: 'PENDING_REVIEW' }],
    ]);
    await expect(run(api.fetch)).resolves.toBe('PENDING_REVIEW');
    const urls = api.calls.map((c) => c.url);
    expect(urls).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/ext:upload?uploadType=media',
      'https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext:fetchStatus',
      'https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext:fetchStatus',
      'https://chromewebstore.googleapis.com/v2/publishers/pub/items/ext:publish',
    ]);
    const headers = api.calls[1]?.init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
    expect(JSON.parse(api.calls[4]?.init?.body as string)).toEqual({
      publishType: 'DEFAULT_PUBLISH',
      blockOnWarnings: true,
    });
  });

  it('asks for a staged publish', async () => {
    const api = fakeApi([
      TOKEN,
      [200, { uploadState: 'SUCCEEDED', crxVersion: '0.0.99.1' }],
      [200, { state: 'STAGED' }],
    ]);
    await expect(run(api.fetch, true)).resolves.toBe('STAGED');
    expect(JSON.parse(api.calls[2]?.init?.body as string)).toMatchObject({
      publishType: 'STAGED_PUBLISH',
    });
  });

  it('stops on a failed upload, a wrong version, a rejection or an HTTP error', async () => {
    await expect(run(fakeApi([TOKEN, [200, { uploadState: 'FAILED' }]]).fetch)).rejects.toThrow(
      /state FAILED/,
    );
    await expect(
      run(fakeApi([TOKEN, [200, { uploadState: 'SUCCEEDED', crxVersion: '9.9' }]]).fetch),
    ).rejects.toThrow(/version 9\.9/);
    await expect(
      run(
        fakeApi([TOKEN, [200, { uploadState: 'SUCCEEDED' }], [200, { state: 'REJECTED' }]]).fetch,
      ),
    ).rejects.toThrow(/REJECTED/);
    await expect(run(fakeApi([[401, { error: 'invalid_grant' }]]).fetch)).rejects.toThrow(
      /access token: HTTP 401/,
    );
  });
});
