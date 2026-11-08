// SPDX-License-Identifier: GPL-3.0-or-later
/** The regex lab, playground, recipe gallery and About pages. */

import { resolve } from 'node:path';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { allOperations, bake, makeDish, parseRecipe, VERSION } from '@unichef/core';
import { UCD_VERSION } from '@unichef/core/unicode/index.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App.js';
import { RegexContext } from '../src/features/lab/RegexPage.js';
import { GALLERY } from '../src/features/recipes/gallery.js';
import { REGEX_GRACE_MS, RegexClient, UcdError, type RegexService } from '../src/lib/ucd.js';
import { toWorkerError } from '../src/worker/protocol.js';
import { handle, MAX_MATCHES } from '../src/worker/ucd.js';
import type { FromUcd, ToUcd } from '../src/worker/ucd-protocol.js';
import { collectLicences } from '../vite.licenses.js';
import { fakeWorkers } from './fake-worker.js';
import { useDiskData } from './ucd-data.js';

beforeAll(() => {
  useDiskData();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.location.hash = '';
});

const regex = (pattern: string, text: string, flags = '') =>
  handle({ kind: 'regex', pattern, flags, text, timeoutMs: 2000 });

/** Runs regexes in-process, with the worker's error mapping. */
const inProcessRegex = (): RegexService => ({
  run: (request) =>
    handle(request).catch((exc: unknown) => {
      throw new UcdError(toWorkerError(exc));
    }),
  dispose: () => undefined,
});

function open(hash: string) {
  window.location.hash = hash;
  render(
    <RegexContext.Provider value={inProcessRegex}>
      <App />
    </RegexContext.Provider>,
  );
}

describe('regex worker', () => {
  it('reports code-point spans past astral characters, and group values', async () => {
    const run = await regex('(?<word>\\p{L})(\\d)?', 'x🦄é1');
    expect(run.matches.map((m) => m.cp)).toEqual([
      [0, 1],
      [2, 4],
    ]);
    expect(run.matches[1]?.at).toEqual([3, 5]);
    expect(run.matches.map((m) => m.groups)).toEqual([
      ['x', null],
      ['é', '1'],
    ]);
    expect(run.named).toEqual([['word', 1]]);
    expect(run.js).toMatch(/^\(\?<word>\[/);
  });

  it('uses Unicode simple case folding for the i flag', async () => {
    const run = await regex('straße', 'STRASSE · STRAẞE', 'i');
    expect(run.matches.map((m) => m.cp)).toEqual([[10, 16]]);
  });

  it('stops listing at the cap and says so', async () => {
    const run = await regex('a', 'a'.repeat(MAX_MATCHES + 5));
    expect(run.matches).toHaveLength(MAX_MATCHES);
    expect(run.truncated).toBe(true);
  });

  it('rejects constructs outside the portable profile', async () => {
    await expect(regex('(?>a)', 'a')).rejects.toMatchObject({ code: 'E_REGEX_UNSUPPORTED' });
  });
});

describe('regex client watchdog', () => {
  /** A worker port that records requests and never answers unless told to. */
  function silentPorts() {
    const ports: { sent: ToUcd[]; terminated: boolean; reply: (m: FromUcd) => void }[] = [];
    const create = () => {
      let listener: ((event: MessageEvent<FromUcd>) => void) | null = null;
      const port = {
        sent: [] as ToUcd[],
        terminated: false,
        reply: (m: FromUcd) => listener?.({ data: m } as MessageEvent<FromUcd>),
        postMessage(message: ToUcd) {
          port.sent.push(message);
        },
        addEventListener(_type: 'message', l: (event: MessageEvent<FromUcd>) => void) {
          listener = l;
        },
        terminate() {
          port.terminated = true;
        },
      };
      ports.push(port);
      return port;
    };
    return { ports, create };
  }

  const request = { kind: 'regex', pattern: 'a', flags: '', text: 'a', timeoutMs: 100 } as const;

  it('terminates a worker that overruns the timeout and starts a fresh one', async () => {
    vi.useFakeTimers();
    const { ports, create } = silentPorts();
    const client = new RegexClient(create);
    const run = client.run(request);
    const failed = expect(run).rejects.toMatchObject({ code: 'E_REGEX_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(request.timeoutMs + REGEX_GRACE_MS);
    await failed;
    expect(ports[0]?.terminated).toBe(true);
    void client.run(request).catch(() => undefined);
    expect(ports).toHaveLength(2);
    client.dispose();
  });

  it('replaces a run in flight instead of queueing behind it', async () => {
    const { ports, create } = silentPorts();
    const client = new RegexClient(create);
    const first = client.run(request);
    const second = client.run({ ...request, pattern: 'b' });
    await expect(first).rejects.toMatchObject({ code: 'E_CANCELLED' });
    expect(ports[0]?.terminated).toBe(true);
    const id = ports[1]?.sent[0]?.id ?? 0;
    const result = { js: 'b', named: [], groups: 0, matches: [], truncated: false, ms: 1 };
    ports[1]?.reply({ id, ok: true, result });
    await expect(second).resolves.toEqual(result);
    client.dispose();
  });
});

describe('regex lab page', () => {
  it('highlights matches, lists them and shows the translated pattern', async () => {
    open('#/regex?p=%5Cp%7BLu%7D%2B&f=');
    expect(await screen.findByText(/2 matches · \d+ ms of a 2,000 ms timeout/)).toBeTruthy();
    expect(screen.getAllByText('C', { selector: 'mark' })).toHaveLength(1);
    expect(screen.getAllByText('CAFÉ', { selector: 'mark' })).toHaveLength(1);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText(/Translated pattern \(\d[\d,]* characters\)/)).toBeTruthy();
  });

  it('shows the error code for an unsupported pattern and keeps the URL in sync', async () => {
    open('#/regex');
    const input = screen.getByRole('textbox', { name: 'Pattern' });
    fireEvent.change(input, { target: { value: 'a++' } });
    expect(await screen.findByText('E_REGEX_UNSUPPORTED')).toBeTruthy();
    expect(window.location.hash).toBe('#/regex?p=a%2B%2B&f=i');
  });

  it('toggles flags', async () => {
    open('#/regex?p=caf%C3%A9&f=');
    expect(await screen.findByText(/^1 matches/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ignore case/ }));
    expect(await screen.findByText(/^3 matches/)).toBeTruthy();
  });
});

describe('playground (FR-030)', () => {
  it('lists every operation by category', async () => {
    open('#/playground');
    await screen.findByText(/Pick an operation/);
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('#/playground/'));
    expect(links).toHaveLength(allOperations().length);
  });

  it('generates a page for every operation from its metadata', async () => {
    const workers = fakeWorkers();
    const { PlaygroundPage } = await import('../src/features/lab/PlaygroundPage.js');
    for (const op of allOperations()) {
      const { unmount } = render(<PlaygroundPage param={op.id} createWorker={workers.create} />);
      expect(screen.getByRole('heading', { level: 1, name: op.name })).toBeTruthy();
      expect(screen.getByText(op.description)).toBeTruthy();
      unmount();
    }
  });

  it('bakes the step in its own worker and links to the workbench', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const workers = fakeWorkers();
    window.location.hash = '#/playground/to-hex';
    const { PlaygroundPage } = await import('../src/features/lab/PlaygroundPage.js');
    render(<PlaygroundPage param="to-hex" createWorker={workers.create} />);
    await act(() => vi.advanceTimersByTimeAsync(400));
    const sent = workers.all[0]?.lastBake();
    expect(sent?.recipe).toMatchObject({ steps: [{ op: 'to-hex' }] });
    act(() => {
      workers.all[0]?.emit({
        kind: 'done',
        id: sent?.id ?? 0,
        output: makeDish('string', '48 c3 a9'),
        warnings: [],
        ms: 1,
      });
    });
    expect(screen.getByText('48 c3 a9')).toBeTruthy();
    const link = await screen.findByRole('link', { name: 'Open in the workbench' });
    expect(link.getAttribute('href')).toMatch(/^#\/\?r=[\w-]+&i=[\w-]+$/);
  });

  it('SEC-007: leaves the key out of its workbench link', async () => {
    const workers = fakeWorkers();
    window.location.hash = '#/playground/hmac';
    const { PlaygroundPage } = await import('../src/features/lab/PlaygroundPage.js');
    const { decodeState } = await import('../src/lib/share.js');
    render(<PlaygroundPage param="hmac" createWorker={workers.create} />);
    // The example's key is "secret".
    fireEvent.click(screen.getByRole('button', { name: /^message → / }));
    const link = await screen.findByRole('link', { name: 'Open in the workbench' });
    await waitFor(async () => {
      const state = await decodeState(link.getAttribute('href') ?? '');
      expect(JSON.stringify(state?.recipe)).toContain('<redacted>');
    });
    const state = await decodeState(link.getAttribute('href') ?? '');
    expect(JSON.stringify(state?.recipe)).not.toContain('"secret"');
  });

  it('keeps example labels to one short line', async () => {
    const { clip } = await import('../src/features/lab/PlaygroundPage.js');
    expect(clip('Hello')).toBe('Hello');
    expect(clip('index\tcp\nchar')).toBe('index cp char');
    const long = clip('👋'.repeat(40));
    expect(Array.from(long)).toHaveLength(32);
    expect(long.endsWith('…')).toBe(true);
  });

  it('says when the operation does not exist', async () => {
    open('#/playground/no-such-op');
    expect(await screen.findByText('There is no operation “no-such-op”.')).toBeTruthy();
  });
});

describe('recipe gallery', () => {
  it('holds valid recipes, each with a sample input that bakes cleanly', async () => {
    expect(GALLERY.length).toBeGreaterThanOrEqual(10);
    for (const entry of GALLERY) {
      expect(entry.input, entry.id).not.toBe('');
      const result = await bake(parseRecipe(entry.recipe), makeDish('string', entry.input));
      expect(result.warnings, entry.id).toEqual([]);
    }
  });

  it('opens each recipe in the workbench through a shared link', async () => {
    open('#/recipes');
    await screen.findByRole('heading', { level: 1, name: 'Recipes' });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(GALLERY.length);
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /^Open in the workbench/ })).toHaveLength(
        GALLERY.length,
      );
    });
  });
});

describe('about page', () => {
  it('shows the versions and the shipped packages', async () => {
    open('#/about');
    expect(await screen.findByText(VERSION)).toBeTruthy();
    expect(screen.getByText(UCD_VERSION)).toBeTruthy();
    expect(screen.getByText(/^react \d/)).toBeTruthy();
  });

  it('lists runtime dependencies only, with their licence texts', () => {
    const names = collectLicences(resolve('package.json')).map((l) => l.name);
    expect(names).toEqual(expect.arrayContaining(['react', 'zustand', '@noble/hashes']));
    expect(
      names.some((n) => n.startsWith('@types/') || n === 'vite' || n === '@unichef/core'),
    ).toBe(false);
    for (const licence of collectLicences(resolve('package.json'))) {
      expect(licence.text, licence.name).not.toBe('');
    }
  });
});
