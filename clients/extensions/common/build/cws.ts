// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Uploads a zip to the Chrome Web Store and submits it for review (PRD §7.6), with the
 * Chrome Web Store API v2 and a service account (v1.1 was retired on 15 October 2026):
 *
 *     CWS_SERVICE_ACCOUNT='<key JSON>' CWS_PUBLISHER_ID=… CWS_EXTENSION_ID=… \
 *       node build/cws.ts --zip dist/unichef-chrome-<v>.zip [--staged]
 *
 * The item must already exist: the API cannot create one (docs/extensions/publishing.md).
 * Brave and Edge users install from the Chrome Web Store too.
 */

import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { manifestFor } from './build.ts';

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://chromewebstore.googleapis.com';
const POLL_MS = 5_000;
const POLL_LIMIT = 60;

export interface ServiceAccount {
  readonly client_email: string;
  readonly private_key: string;
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export function parseServiceAccount(json: string): ServiceAccount {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error('CWS_SERVICE_ACCOUNT is not JSON; paste the whole key file.');
  }
  const o = v as Partial<Record<keyof ServiceAccount, unknown>>;
  if (typeof o.client_email !== 'string' || typeof o.private_key !== 'string') {
    throw new Error('CWS_SERVICE_ACCOUNT has no client_email or private_key.');
  }
  return { client_email: o.client_email, private_key: o.private_key };
}

const b64url = (data: string | Buffer): string => Buffer.from(data).toString('base64url');

/** The signed JWT a service account trades for an access token (RFC 7523). */
export function serviceAccountJwt(account: ServiceAccount, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 600,
    }),
  );
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), account.private_key);
  return `${header}.${claims}.${b64url(signature)}`;
}

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) throw new Error(`${what}: HTTP ${String(res.status)} ${text}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${what}: the response is not JSON: ${text}`);
  }
}

export interface PublishOptions {
  readonly account: ServiceAccount;
  readonly publisherId: string;
  readonly extensionId: string;
  readonly zip: Uint8Array<ArrayBuffer>;
  readonly expectedVersion: string;
  readonly staged: boolean;
  readonly fetch?: Fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly log?: (line: string) => void;
}

/** Uploads, waits for the upload to finish, then submits; returns the item state. */
export async function publish(o: PublishOptions): Promise<string> {
  const http = o.fetch ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = o.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  const now = o.now ?? (() => Math.floor(Date.now() / 1000));

  const token = await json(
    await http(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: serviceAccountJwt(o.account, now()),
      }).toString(),
    }),
    'access token',
  );
  if (typeof token['access_token'] !== 'string') throw new Error('access token: none returned.');
  const auth = { Authorization: `Bearer ${token['access_token']}` };
  const item = `publishers/${o.publisherId}/items/${o.extensionId}`;

  const upload = await json(
    await http(`${API}/upload/v2/${item}:upload?uploadType=media`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/zip' },
      body: o.zip,
    }),
    'upload',
  );
  let state = upload['uploadState'];
  for (let i = 0; state === 'IN_PROGRESS' && i < POLL_LIMIT; i++) {
    await sleep(POLL_MS);
    const status = await json(
      await http(`${API}/v2/${item}:fetchStatus`, { headers: auth }),
      'fetchStatus',
    );
    state = status['lastAsyncUploadState'];
  }
  if (state !== 'SUCCEEDED') {
    throw new Error(`upload: state ${String(state)}: ${JSON.stringify(upload)}`);
  }
  const version = upload['crxVersion'];
  if (typeof version === 'string' && version !== o.expectedVersion) {
    throw new Error(`upload: the store read version ${version}, expected ${o.expectedVersion}.`);
  }
  log(`uploaded version ${o.expectedVersion}`);

  const published = await json(
    await http(`${API}/v2/${item}:publish`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publishType: o.staged ? 'STAGED_PUBLISH' : 'DEFAULT_PUBLISH',
        blockOnWarnings: true,
      }),
    }),
    'publish',
  );
  const itemState = String(published['state']);
  if (itemState === 'REJECTED' || itemState === 'CANCELLED') {
    throw new Error(`publish: ${itemState}: ${JSON.stringify(published)}`);
  }
  log(`submitted: ${itemState}`);
  return itemState;
}

function need(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === '') throw new Error(`${name} is not set.`);
  return v.trim();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { zip: { type: 'string' }, staged: { type: 'boolean', default: false } },
  });
  if (values.zip === undefined) throw new Error('--zip is required.');
  const version = manifestFor('chrome')['version'];
  if (typeof version !== 'string') throw new Error('The Chrome manifest has no version.');
  await publish({
    account: parseServiceAccount(need('CWS_SERVICE_ACCOUNT')),
    publisherId: need('CWS_PUBLISHER_ID'),
    extensionId: need('CWS_EXTENSION_ID'),
    zip: readFileSync(values.zip),
    expectedVersion: version,
    staged: values.staged,
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((exc: unknown) => {
    process.stderr.write(`cws: ${exc instanceof Error ? exc.message : String(exc)}\n`);
    process.exit(1);
  });
}
