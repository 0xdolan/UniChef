// SPDX-License-Identifier: GPL-3.0-or-later
/** BakeClient: stale results, cancellation and the watchdog (PRD §6.4). */

import { DEFAULT_LIMITS, makeDish } from '@unichef/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BakeClient, CANCEL_GRACE_MS } from '../src/worker/client.js';
import type { FromWorker } from '../src/worker/protocol.js';
import { fakeWorkers } from './fake-worker.js';

const recipe = { version: 1, steps: [] };
const options = { snapshots: false, limits: DEFAULT_LIMITS };
const BAKE_MS = 1000;

function setup() {
  const workers = fakeWorkers();
  const messages: FromWorker[] = [];
  const restarts: [number, string, boolean][] = [];
  const client = new BakeClient(workers.create, {
    onMessage: (m) => messages.push(m),
    onRestart: (id, error, retry) => restarts.push([id, error.code, retry]),
  });
  const bake = () => client.bake(recipe, makeDish('string', 'x'), options, BAKE_MS);
  const done = (id: number): FromWorker => ({
    kind: 'done',
    id,
    output: makeDish('string', `out${id}`),
    warnings: [],
    ms: 1,
  });
  return { workers, messages, restarts, client, bake, done };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('BakeClient', () => {
  it('delivers the result of the current bake', () => {
    const { workers, messages, bake, done } = setup();
    const id = bake();
    workers.all[0]?.emit(done(id));
    expect(messages).toEqual([done(id)]);
  });

  it('cancels the previous bake and drops its late result', () => {
    const { workers, messages, bake, done } = setup();
    const first = bake();
    const second = bake();
    const worker = workers.all[0];
    expect(worker?.sent.map((m) => m.kind)).toEqual(['bake', 'cancel', 'bake']);
    worker?.emit({
      kind: 'error',
      id: first,
      error: { code: 'E_CANCELLED', message: '', path: [] },
    });
    worker?.emit(done(second));
    expect(messages).toEqual([done(second)]);
  });

  it('transfers the input bytes', () => {
    const { workers, client } = setup();
    const posted = vi.spyOn(workers.all[0] as never, 'postMessage');
    const bytes = new Uint8Array([1, 2]);
    const dish = makeDish('bytes', bytes);
    client.bake(recipe, dish, options, BAKE_MS);
    expect(posted).toHaveBeenCalledWith(expect.objectContaining({ kind: 'bake' }), [bytes.buffer]);
  });

  it('restarts the worker when a bake runs past its budget', () => {
    const { workers, restarts, bake } = setup();
    const id = bake();
    vi.advanceTimersByTime(BAKE_MS);
    expect(workers.all[0]?.terminated).toBe(true);
    expect(workers.all).toHaveLength(2);
    expect(restarts).toEqual([[id, 'E_LIMIT', false]]);
  });

  it('does not fire the watchdog once the bake has answered', () => {
    const { workers, restarts, bake, done } = setup();
    workers.all[0]?.emit(done(bake()));
    vi.advanceTimersByTime(BAKE_MS * 2);
    expect(restarts).toEqual([]);
    expect(workers.all).toHaveLength(1);
  });

  it('restarts a worker stuck on a cancelled bake and asks to retry the new one', () => {
    const { workers, restarts, bake } = setup();
    bake();
    const second = bake();
    vi.advanceTimersByTime(CANCEL_GRACE_MS);
    expect(workers.all).toHaveLength(2);
    expect(restarts).toEqual([[second, 'E_CANCELLED', true]]);
  });

  it('keeps the worker when the cancelled bake answers in time', () => {
    const { workers, restarts, bake } = setup();
    const first = bake();
    bake();
    workers.all[0]?.emit({
      kind: 'error',
      id: first,
      error: { code: 'E_CANCELLED', message: '', path: [] },
    });
    vi.advanceTimersByTime(CANCEL_GRACE_MS);
    expect(restarts).toEqual([]);
    expect(workers.all).toHaveLength(1);
  });

  it('ignores messages from a terminated worker', () => {
    const { workers, messages, bake, done } = setup();
    const id = bake();
    vi.advanceTimersByTime(BAKE_MS);
    workers.all[0]?.emit(done(id));
    expect(messages).toEqual([]);
  });
});
