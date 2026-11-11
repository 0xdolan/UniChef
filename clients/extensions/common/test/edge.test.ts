// SPDX-License-Identifier: GPL-3.0-or-later
// PRD §7.6: Edge Add-ons publishing (upload package → poll operation → publish).
import { describe, expect, it } from 'vitest';

import type { Fetch } from '../build/cws.ts';
import { publishEdge } from '../build/edge.ts';

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

type Reply = [status: number, body: unknown, location?: string];

/** A fake API that answers each call with the next reply. */
function fakeApi(replies: readonly Reply[]): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...replies];
  const fetch: Fetch = (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (next === undefined) throw new Error(`unexpected call: ${url}`);
    const [status, body, location] = next;
    const headers: Record<string, string> = location === undefined ? {} : { Location: location };
    return Promise.resolve(
      new Response(body === null ? null : JSON.stringify(body), { status, headers }),
    );
  };
  return { fetch, calls };
}

const run = (fetch: Fetch): Promise<void> =>
  publishEdge({
    clientId: 'client',
    apiKey: 'key',
    productId: 'prod',
    zip: new Uint8Array([1, 2, 3]),
    notes: 'UniChef 1.0.0',
    fetch,
    sleep: () => Promise.resolve(),
    log: () => undefined,
  });

const BASE = 'https://api.addons.microsoftedge.microsoft.com/v1/products/prod';
const UPLOADED: Reply = [202, null, '/v1/products/prod/submissions/draft/package/operations/up1'];
const SUBMITTED: Reply = [202, null, '/v1/products/prod/submissions/operations/pub1'];

describe('publishEdge', () => {
  it('uploads, waits for the upload, submits, and waits for the submission', async () => {
    const api = fakeApi([
      UPLOADED,
      [200, { status: 'InProgress' }],
      [200, { status: 'Succeeded' }],
      SUBMITTED,
      [200, { status: 'InProgress' }],
      [200, { status: 'Succeeded' }],
    ]);
    await run(api.fetch);
    expect(api.calls.map((c) => c.url)).toEqual([
      `${BASE}/submissions/draft/package`,
      `${BASE}/submissions/draft/package/operations/up1`,
      `${BASE}/submissions/draft/package/operations/up1`,
      `${BASE}/submissions`,
      `${BASE}/submissions/operations/pub1`,
      `${BASE}/submissions/operations/pub1`,
    ]);
    const headers = api.calls[0]?.init?.headers as Record<string, string>;
    expect(headers).toMatchObject({
      Authorization: 'ApiKey key',
      'X-ClientID': 'client',
      'Content-Type': 'application/zip',
    });
    expect(JSON.parse(api.calls[3]?.init?.body as string)).toEqual({ notes: 'UniChef 1.0.0' });
  });

  it('stops on a failed upload, a failed submission, a missing Location or an HTTP error', async () => {
    await expect(
      run(fakeApi([UPLOADED, [200, { status: 'Failed', errorCode: 'InvalidPackage' }]]).fetch),
    ).rejects.toThrow(/upload: Failed.*InvalidPackage/);
    await expect(
      run(
        fakeApi([
          UPLOADED,
          [200, { status: 'Succeeded' }],
          SUBMITTED,
          [200, { status: 'Failed', errorCode: 'InProgressSubmission' }],
        ]).fetch,
      ),
    ).rejects.toThrow(/publish: Failed.*InProgressSubmission/);
    await expect(run(fakeApi([[202, null]]).fetch)).rejects.toThrow(/no operation id/);
    await expect(run(fakeApi([[401, { message: 'bad key' }]]).fetch)).rejects.toThrow(
      /upload: HTTP 401/,
    );
  });
});
