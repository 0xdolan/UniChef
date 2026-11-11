// SPDX-License-Identifier: GPL-3.0-or-later
/** The docs reader: build-time conversion and link rewriting, and the page (FR-014). */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { allOperations } from '@unichef/core';
import { act, cleanup, render, screen } from '@testing-library/react';
import { pages } from 'virtual:docs';
import { afterEach, describe, expect, it } from 'vitest';

import constants from '../../../project.constants.json';
import { DocsPage } from '../src/features/docs/DocsPage.js';
import { opDocsHref } from '../src/features/docs/links.js';
import type { Block, DocPage, Inline } from '../src/features/docs/tree.js';
import { convert, listPages, rewriteHref, routeKey } from '../vite.docs.js';

afterEach(cleanup);

const ROOT = join(__dirname, '..', '..', '..');
const DOCS = join(ROOT, 'docs');
const files = listPages(DOCS);
const ctx = (file: string) => ({
  root: ROOT,
  docs: DOCS,
  pages: new Set(files),
  repoUrl: constants.REPO_URL,
  pagesUrl: constants.PAGES_URL,
  file,
});

function links(blocks: readonly Block[]): string[] {
  const fromInline = (nodes: readonly Inline[]): string[] =>
    nodes.flatMap((n) =>
      n.t === 'link' ? [n.href, ...fromInline(n.c)] : 'c' in n ? fromInline(n.c) : [],
    );
  return blocks.flatMap((b) => {
    switch (b.t) {
      case 'h':
      case 'p':
      case 'text':
        return fromInline(b.c);
      case 'list':
        return b.items.flatMap(links);
      case 'quote':
        return links(b.c);
      case 'table':
        return [...b.head, ...b.rows.flat()].flatMap(fromInline);
      default:
        return [];
    }
  });
}

describe('docs conversion (FR-014)', () => {
  it('FR-014: maps docs files to reader routes', () => {
    expect(routeKey('README.md')).toBe('');
    expect(routeKey('reference/README.md')).toBe('reference');
    expect(routeKey('learn/hashing.md')).toBe('learn/hashing');
    expect(Object.keys(pages).sort()).toEqual(files.map(routeKey).sort());
  });

  it('FR-014: rewrites links for the hash router', () => {
    const c = ctx('learn/hashing.md');
    expect(rewriteHref('../reference/ops/md5.md', c)).toBe('#/docs/reference/ops/md5');
    expect(rewriteHref('../README.md', c)).toBe('#/docs');
    expect(rewriteHref('../reference/README.md#ops', c)).toBe('#/docs/reference');
    expect(rewriteHref('#top', c)).toBeNull();
    expect(rewriteHref(`${constants.PAGES_URL}#/?r=abc`, c)).toBe('#/?r=abc');
    expect(rewriteHref('../roadmap.md', c)).toBe(`${constants.REPO_URL}/blob/HEAD/docs/roadmap.md`);
    expect(rewriteHref('https://www.rfc-editor.org/rfc/rfc1321', c)).toBe(
      'https://www.rfc-editor.org/rfc/rfc1321',
    );
    expect(() => rewriteHref('javascript:alert(1)', c)).toThrow(/unsupported link/);
    expect(() => rewriteHref('../../../outside.md', c)).toThrow(/outside the repo/);
  });

  it('FR-014: drops HTML, decodes entities and refuses what it cannot show', () => {
    const page = convert(
      '# T &amp; U\n\n<!-- docs:nav -->\n\nA <b>x</b> `<i>`\n',
      ctx('README.md'),
    );
    expect(page.title).toBe('T & U');
    expect(page.blocks).toEqual([
      { t: 'h', level: 1, c: [{ t: 'text', v: 'T & U' }] },
      {
        t: 'p',
        c: [
          { t: 'text', v: 'A ' },
          { t: 'text', v: 'x' },
          { t: 'text', v: ' ' },
          { t: 'code', v: '<i>' },
        ],
      },
    ]);
    expect(() => convert('![logo](a.png)', ctx('README.md'))).toThrow(/cannot show inline image/);
  });

  it('FR-014: converts every page, and every reader link has a page', () => {
    const keys = new Set(files.map(routeKey));
    for (const file of files) {
      const page = convert(readFileSync(join(DOCS, file), 'utf8'), ctx(file));
      expect(page.title, file).not.toBe('');
      for (const href of links(page.blocks).filter((h) => h.startsWith('#/docs'))) {
        expect(keys.has(href.replace(/^#\/docs\/?/, '')), `${file} → ${href}`).toBe(true);
      }
    }
  });

  it('FR-014: has a reference page for every operation', () => {
    for (const op of allOperations()) {
      expect(Object.hasOwn(pages, opDocsHref(op.id).replace('#/docs/', '')), op.id).toBe(true);
    }
  });
});

describe('docs reader (FR-014)', () => {
  async function show(param: string): Promise<void> {
    render(<DocsPage param={param} />);
    await act(async () => {
      await (pages[param]?.() ?? Promise.resolve());
    });
  }

  it('FR-014: shows the contents with links to every guide and operation', async () => {
    await show('');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('UniChef documentation');
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('#/docs/learn/hashing');
    expect(hrefs).toContain('#/docs/reference/ops/to-base64');
    expect(document.title).toBe('UniChef documentation · UniChef');
  });

  it('FR-014: shows an operation page with breadcrumb, tables, code and previous/next', async () => {
    await show('reference/ops/to-base64');
    const page = (await pages['reference/ops/to-base64']?.())?.default as DocPage;
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(page.title);
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('#/docs');
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeTruthy();
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    const code = [...document.querySelectorAll('pre code')].map((el) => el.textContent);
    expect(code.some((text) => text.startsWith('unichef op to-base64'))).toBe(true);
    const nav = screen.getAllByRole('link').map((a) => a.textContent);
    expect(nav.some((text) => text.startsWith('←'))).toBe(true);
    expect(nav.some((text) => text.endsWith('→'))).toBe(true);
    // The example link opens the workbench in this app, not on the Pages site.
    const open = screen.getByRole('link', { name: 'open this example in UniChef' });
    expect(open.getAttribute('href')).toMatch(/^#\/\?r=/);
  });

  it('FR-014: says when a page does not exist', () => {
    render(<DocsPage param="learn/nope" />);
    expect(screen.getByText('There is no docs page here.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to the docs contents' }).getAttribute('href')).toBe(
      '#/docs',
    );
  });
});
