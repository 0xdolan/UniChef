// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Uploads a zip to Microsoft Edge Add-ons and submits it for certification (PRD §7.6), with
 * the Edge Add-ons API v1.1 (API key and client ID from Partner Center → Publish API):
 *
 *     EDGE_CLIENT_ID=… EDGE_API_KEY=… EDGE_PRODUCT_ID=… \
 *       node build/edge.ts --zip dist/unichef-edge-<v>.zip [--notes "…"]
 *
 * The product must already exist: the API cannot create one (docs/extensions/publishing.md).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import type { Fetch } from './cws.ts';

const API = 'https://api.addons.microsoftedge.microsoft.com';
const POLL_MS = 5_000;
const POLL_LIMIT = 120;

export interface EdgeOptions {
  readonly clientId: string;
  readonly apiKey: string;
  readonly productId: string;
  readonly zip: Uint8Array<ArrayBuffer>;
  readonly notes: string;
  readonly fetch?: Fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly log?: (line: string) => void;
}

/** The operation id from a 202 response's Location header (its last path segment). */
async function operationId(res: Response, what: string): Promise<string> {
  if (res.status !== 202) {
    throw new Error(`${what}: HTTP ${String(res.status)} ${await res.text()}`);
  }
  const id = res.headers.get('Location')?.split('/').filter(Boolean).pop();
  if (id === undefined) throw new Error(`${what}: no operation id in the Location header.`);
  return id;
}

/** Polls an operation until it leaves InProgress; throws unless it Succeeded. */
async function waitFor(
  http: Fetch,
  url: string,
  headers: Record<string, string>,
  sleep: (ms: number) => Promise<void>,
  what: string,
): Promise<Record<string, unknown>> {
  for (let i = 0; i < POLL_LIMIT; i++) {
    const res = await http(url, { headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`${what}: HTTP ${String(res.status)} ${text}`);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`${what}: the response is not JSON: ${text}`);
    }
    const status = body['status'];
    if (status === 'Succeeded') return body;
    if (status === 'Failed') throw new Error(`${what}: Failed: ${JSON.stringify(body)}`);
    // InProgress, or a status this script does not know yet: keep waiting.
    await sleep(POLL_MS);
  }
  throw new Error(`${what}: still in progress after ${String((POLL_LIMIT * POLL_MS) / 1000)} s.`);
}

/** Uploads the package, waits for it, submits it, and waits for the submission. */
export async function publishEdge(o: EdgeOptions): Promise<void> {
  const http = o.fetch ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = o.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  const auth = { Authorization: `ApiKey ${o.apiKey}`, 'X-ClientID': o.clientId };
  const product = `${API}/v1/products/${encodeURIComponent(o.productId)}`;

  const uploadOp = await operationId(
    await http(`${product}/submissions/draft/package`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/zip' },
      body: o.zip,
    }),
    'upload',
  );
  await waitFor(
    http,
    `${product}/submissions/draft/package/operations/${uploadOp}`,
    auth,
    sleep,
    'upload',
  );
  log('uploaded the package');

  const publishOp = await operationId(
    await http(`${product}/submissions`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: o.notes }),
    }),
    'publish',
  );
  await waitFor(http, `${product}/submissions/operations/${publishOp}`, auth, sleep, 'publish');
  log('submitted for certification');
}

function need(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === '') throw new Error(`${name} is not set.`);
  return v.trim();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { zip: { type: 'string' }, notes: { type: 'string', default: '' } },
  });
  if (values.zip === undefined) throw new Error('--zip is required.');
  await publishEdge({
    clientId: need('EDGE_CLIENT_ID'),
    apiKey: need('EDGE_API_KEY'),
    productId: need('EDGE_PRODUCT_ID'),
    zip: readFileSync(values.zip),
    notes: values.notes,
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((exc: unknown) => {
    process.stderr.write(`edge: ${exc instanceof Error ? exc.message : String(exc)}\n`);
    process.exit(1);
  });
}
