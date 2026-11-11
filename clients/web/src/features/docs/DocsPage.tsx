// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The docs reader (FR-014): `#/docs` is the table of contents (docs/README.md) and
 * `#/docs/<path>` any guide or reference page. The breadcrumb and the previous and next
 * links are part of each page, so following them stays inside the app.
 */

import { Fragment, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { pages } from 'virtual:docs';

import { t } from '../../i18n/index.js';
import styles from './Docs.module.css';
import type { Block, DocPage, Inline } from './tree.js';

type Loaded =
  | { readonly key: string; readonly page: DocPage }
  | { readonly key: string; readonly failed: true };

function Inlines({ nodes }: { readonly nodes: readonly Inline[] }): ReactNode {
  return nodes.map((node, i) => {
    switch (node.t) {
      case 'text':
        return <Fragment key={i}>{node.v}</Fragment>;
      case 'code':
        return (
          <code key={i} className={styles.code}>
            {node.v}
          </code>
        );
      case 'strong':
        return (
          <strong key={i}>
            <Inlines nodes={node.c} />
          </strong>
        );
      case 'em':
        return (
          <em key={i}>
            <Inlines nodes={node.c} />
          </em>
        );
      case 'del':
        return (
          <del key={i}>
            <Inlines nodes={node.c} />
          </del>
        );
      case 'link':
        return (
          <a key={i} href={node.href} rel={node.href.startsWith('#') ? undefined : 'noreferrer'}>
            <Inlines nodes={node.c} />
          </a>
        );
      case 'br':
        return <br key={i} />;
    }
  });
}

function Blocks({
  blocks,
  headingRef,
}: {
  readonly blocks: readonly Block[];
  readonly headingRef?: Ref<HTMLHeadingElement>;
}): ReactNode {
  return blocks.map((block, i) => {
    switch (block.t) {
      case 'h': {
        const Tag = `h${block.level}` as const;
        const first = block.level === 1 && headingRef !== undefined;
        return (
          <Tag key={i} ref={first ? headingRef : undefined} tabIndex={first ? -1 : undefined}>
            <Inlines nodes={block.c} />
          </Tag>
        );
      }
      case 'p':
        return (
          <p key={i}>
            <Inlines nodes={block.c} />
          </p>
        );
      case 'text':
        return <Inlines key={i} nodes={block.c} />;
      case 'list': {
        const items = block.items.map((item, j) => (
          <li key={j}>
            <Blocks blocks={item} />
          </li>
        ));
        return block.ordered ? (
          <ol key={i} start={block.start}>
            {items}
          </ol>
        ) : (
          <ul key={i}>{items}</ul>
        );
      }
      case 'pre':
        return (
          <pre key={i} className={styles.pre} data-lang={block.lang || undefined}>
            <code>{block.v}</code>
          </pre>
        );
      case 'table':
        return (
          // A wide table scrolls on its own; the page never scrolls sideways.
          <div key={i} className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {block.head.map((cell, j) => (
                    <th key={j} scope="col" data-align={block.align[j] ?? undefined}>
                      <Inlines nodes={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, j) => (
                      <td key={j} data-align={block.align[j] ?? undefined}>
                        <Inlines nodes={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'quote':
        return (
          <blockquote key={i} className={styles.quote}>
            <Blocks blocks={block.c} />
          </blockquote>
        );
      case 'hr':
        return <hr key={i} className={styles.rule} />;
    }
  });
}

export function DocsPage({ param }: { readonly param: string }): ReactNode {
  const key = param.replace(/^\/+|\/+$/g, '');
  const load = Object.hasOwn(pages, key) ? pages[key] : undefined;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const main = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const shownBefore = useRef(false);

  useEffect(() => {
    if (load === undefined) return;
    let live = true;
    load().then(
      (m) => {
        if (live) setLoaded({ key, page: m.default as DocPage });
      },
      () => {
        if (live) setLoaded({ key, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [key, load]);

  const current = loaded?.key === key ? loaded : null;
  const page = current !== null && 'page' in current ? current.page : null;

  useEffect(() => {
    if (page === null) return;
    const before = document.title;
    if (page.title) document.title = `${page.title} · UniChef`;
    if (main.current) main.current.scrollTop = 0;
    // Moving between pages announces the new one; the first page keeps the focus where it is.
    if (shownBefore.current) heading.current?.focus({ preventScroll: true });
    shownBefore.current = true;
    return () => {
      document.title = before;
    };
  }, [page]);

  let body: ReactNode;
  if (load === undefined || (current !== null && 'failed' in current)) {
    body = (
      <>
        <p>{load === undefined ? t('docs.notFound') : t('docs.failed')}</p>
        <a href="#/docs">{t('docs.contents')}</a>
      </>
    );
  } else if (page === null) {
    body = <p className={styles.muted}>{t('nav.loading')}</p>;
  } else {
    body = <Blocks blocks={page.blocks} headingRef={heading} />;
  }
  return (
    <main id="main" ref={main} className={styles.page}>
      <article className={styles.article}>{body}</article>
    </main>
  );
}
