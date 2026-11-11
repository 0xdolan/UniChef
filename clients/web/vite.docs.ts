// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * `virtual:docs`: the documentation in docs/ (FR-013) for the in-app reader at `#/docs`
 * (FR-014). Each page is parsed with marked at build time into the plain data of
 * `src/features/docs/tree.ts` and becomes its own lazily loaded chunk, so the app ships no
 * Markdown parser and renders no raw HTML.
 *
 * Links are rewritten here:
 * - to a page of the reader: `#/docs/<path>` (docs/learn/hashing.md → `#/docs/learn/hashing`);
 * - to the web app (share links on the Pages site): the bare fragment, `#/?r=…`;
 * - to any other file in the repository: its page on GitHub;
 * - http and https links stay as they are.
 *
 * In-page anchors cannot work with hash routing, so `#section` parts are dropped. HTML
 * (only the generator's `<!-- docs:… -->` markers) is dropped too. Any other link, and any
 * Markdown construct the reader does not know, fails the build instead of vanishing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';

import { lexer, type Token, type Tokens } from 'marked';
import type { Plugin } from 'vite';

import type { Align, Block, DocPage, Inline } from './src/features/docs/tree.js';

const ID = 'virtual:docs';
const PAGE = 'virtual:docs-page/';
/** The parts of docs/ the reader shows; links to other files go to GitHub. */
const SECTIONS = ['README.md', 'learn', 'reference'];

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith('#')) {
      const hex = name[1] === 'x' || name[1] === 'X';
      const cp = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

interface Context {
  readonly root: string;
  readonly docs: string;
  readonly pages: ReadonlySet<string>;
  readonly repoUrl: string;
  readonly pagesUrl: string;
  /** The page being converted, relative to docs/ with `/` separators. */
  readonly file: string;
}

/** The route key of a docs file: `README.md` → `''`, `learn/hashing.md` → `learn/hashing`. */
export function routeKey(file: string): string {
  return file.replace(/(^|\/)README\.md$/, '').replace(/\.md$/, '');
}

/** Where a Markdown link goes, or null when it has nowhere to go (an in-page anchor). */
export function rewriteHref(href: string, ctx: Context): string | null {
  if (href.startsWith(ctx.pagesUrl)) {
    const rest = href.slice(ctx.pagesUrl.length);
    return rest.startsWith('#/') ? rest : href;
  }
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/')) {
    throw new Error(`docs/${ctx.file}: unsupported link ${href}`);
  }
  const target = resolve(ctx.docs, dirname(ctx.file), decodeURI(href.split('#')[0] ?? ''));
  const inRepo = relative(ctx.root, target).split(sep).join('/');
  if (inRepo.startsWith('../')) throw new Error(`docs/${ctx.file}: link outside the repo ${href}`);
  const inDocs = relative(ctx.docs, target).split(sep).join('/');
  if (ctx.pages.has(inDocs)) return `#/docs/${routeKey(inDocs)}`.replace(/\/$/, '');
  return `${ctx.repoUrl}/blob/HEAD/${inRepo}`;
}

function inline(tokens: readonly Token[], ctx: Context): Inline[] {
  const out: Inline[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
      case 'escape': {
        const t = token as Tokens.Text;
        if (t.tokens) out.push(...inline(t.tokens, ctx));
        else out.push({ t: 'text', v: decodeEntities(t.text) });
        break;
      }
      case 'codespan':
        out.push({ t: 'code', v: (token as Tokens.Codespan).text });
        break;
      case 'strong':
      case 'em':
      case 'del':
        out.push({ t: token.type, c: inline((token as Tokens.Strong).tokens, ctx) });
        break;
      case 'link': {
        const link = token as Tokens.Link;
        const href = rewriteHref(link.href, ctx);
        const c = inline(link.tokens, ctx);
        if (href === null) out.push(...c);
        else out.push({ t: 'link', href, c });
        break;
      }
      case 'br':
        out.push({ t: 'br' });
        break;
      case 'html':
        break;
      default:
        throw new Error(`docs/${ctx.file}: the reader cannot show inline ${token.type}`);
    }
  }
  return out;
}

function align(value: string | null): Align {
  return value === 'left' || value === 'center' || value === 'right' ? value : null;
}

function blocks(tokens: readonly Token[], ctx: Context): Block[] {
  const out: Block[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const h = token as Tokens.Heading;
        out.push({ t: 'h', level: h.depth as 1 | 2 | 3 | 4 | 5 | 6, c: inline(h.tokens, ctx) });
        break;
      }
      case 'paragraph':
        out.push({ t: 'p', c: inline((token as Tokens.Paragraph).tokens, ctx) });
        break;
      case 'text': {
        const t = token as Tokens.Text;
        out.push({ t: 'text', c: t.tokens ? inline(t.tokens, ctx) : [{ t: 'text', v: t.text }] });
        break;
      }
      case 'list': {
        const list = token as Tokens.List;
        out.push({
          t: 'list',
          ordered: list.ordered,
          start: list.start === '' ? 1 : list.start,
          items: list.items.map((item) => blocks(item.tokens, ctx)),
        });
        break;
      }
      case 'code': {
        const code = token as Tokens.Code;
        out.push({ t: 'pre', lang: code.lang ?? '', v: code.text });
        break;
      }
      case 'table': {
        const table = token as Tokens.Table;
        out.push({
          t: 'table',
          align: table.align.map(align),
          head: table.header.map((cell) => inline(cell.tokens, ctx)),
          rows: table.rows.map((row) => row.map((cell) => inline(cell.tokens, ctx))),
        });
        break;
      }
      case 'blockquote':
        out.push({ t: 'quote', c: blocks((token as Tokens.Blockquote).tokens, ctx) });
        break;
      case 'hr':
        out.push({ t: 'hr' });
        break;
      case 'space':
      case 'html':
        break;
      default:
        throw new Error(`docs/${ctx.file}: the reader cannot show ${token.type}`);
    }
  }
  return out;
}

function plain(nodes: readonly Inline[]): string {
  return nodes
    .map((n) => ('v' in n ? n.v : 'c' in n ? plain(n.c) : ' '))
    .join('')
    .trim();
}

/** A docs file as reader data. */
export function convert(markdown: string, ctx: Context): DocPage {
  const tree = blocks(lexer(markdown), ctx);
  const h1 = tree.find((b) => b.t === 'h' && b.level === 1);
  return { title: h1 && 'c' in h1 ? plain(h1.c as Inline[]) : '', blocks: tree };
}

/** Docs file names the reader accepts; anything else fails the build. */
const SAFE_FILE = /^[a-z0-9][a-z0-9._/-]*\.md$/i;

/**
 * A value as a JavaScript literal for generated module code: JSON with the characters that
 * could end a script or a line escaped (CodeQL js/bad-code-sanitization).
 */
export function literal(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>/\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

export function listPages(docs: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    const abs = join(docs, rel);
    if (rel.endsWith('.md')) {
      if (!SAFE_FILE.test(rel) || rel.includes('..'))
        throw new Error(`docs/${rel}: unsafe file name`);
      out.push(rel);
      return;
    }
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory() || entry.name.endsWith('.md')) walk(posix.join(rel, entry.name));
    }
  };
  SECTIONS.forEach(walk);
  return out.sort();
}

export function docs(options: { root: string; repoUrl: string; pagesUrl: string }): Plugin {
  const docsDir = join(options.root, 'docs');
  return {
    name: 'unichef-docs',
    resolveId(id) {
      return id === ID || id.startsWith(PAGE) ? `\0${id}` : undefined;
    },
    load(id) {
      if (id === `\0${ID}`) {
        const files = listPages(docsDir);
        for (const f of files) this.addWatchFile(join(docsDir, f));
        const entries = files.map(
          (f) => `  ${literal(routeKey(f))}: () => import(${literal(PAGE + f)}),`,
        );
        return `export const pages = {\n${entries.join('\n')}\n};\n`;
      }
      if (!id.startsWith(`\0${PAGE}`)) return undefined;
      const file = id.slice(PAGE.length + 1);
      const pages = new Set(listPages(docsDir));
      if (!pages.has(file)) throw new Error(`virtual:docs has no page ${file}`);
      const path = join(docsDir, file);
      this.addWatchFile(path);
      const ctx = { ...options, docs: docsDir, pages, file };
      return `export default ${literal(convert(readFileSync(path, 'utf8'), ctx))};\n`;
    },
  };
}
