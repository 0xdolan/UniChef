// SPDX-License-Identifier: GPL-3.0-or-later
/** An in-memory `WorkerLike` that records what it is sent and can answer on demand. */

import type { WorkerLike } from '../src/worker/client.js';
import type { FromWorker, ToWorker } from '../src/worker/protocol.js';

export class FakeWorker implements WorkerLike {
  readonly sent: ToWorker[] = [];
  terminated = false;
  private listener: ((event: MessageEvent<FromWorker>) => void) | null = null;

  postMessage(message: ToWorker): void {
    this.sent.push(message);
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<FromWorker>) => void): void {
    this.listener = listener;
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: FromWorker): void {
    this.listener?.({ data: message } as MessageEvent<FromWorker>);
  }

  /** The last bake request, which the test answers with `emit`. */
  lastBake(): Extract<ToWorker, { kind: 'bake' }> {
    const bake = this.sent.findLast((m) => m.kind === 'bake');
    if (bake?.kind !== 'bake') throw new Error('no bake was sent');
    return bake;
  }
}

/** A factory that keeps every worker it creates, newest last. */
export function fakeWorkers(): { create: () => FakeWorker; all: FakeWorker[] } {
  const all: FakeWorker[] = [];
  return {
    all,
    create: () => {
      const worker = new FakeWorker();
      all.push(worker);
      return worker;
    },
  };
}
