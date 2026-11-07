// SPDX-License-Identifier: GPL-3.0-or-later

import { lazy, Suspense, type ReactNode } from 'react';

import { Workbench } from '../features/workbench/Workbench.js';
import { t, type MessageKey } from '../i18n/index.js';
import styles from './App.module.css';
import { useRoute } from './router.js';

// The character pages load on first visit, so the workbench's bundle stays small.
const CharsPage = lazy(() =>
  import('../features/chars/CharsPage.js').then((m) => ({ default: m.CharsPage })),
);
const CharPage = lazy(() =>
  import('../features/chars/CharPage.js').then((m) => ({ default: m.CharPage })),
);
const BlocksPage = lazy(() =>
  import('../features/chars/BlocksPage.js').then((m) => ({ default: m.BlocksPage })),
);
const ScriptsPage = lazy(() =>
  import('../features/chars/ScriptsPage.js').then((m) => ({ default: m.ScriptsPage })),
);
const RegexPage = lazy(() =>
  import('../features/lab/RegexPage.js').then((m) => ({ default: m.RegexPage })),
);
const PlaygroundPage = lazy(() =>
  import('../features/lab/PlaygroundPage.js').then((m) => ({ default: m.PlaygroundPage })),
);
const RecipesPage = lazy(() =>
  import('../features/recipes/RecipesPage.js').then((m) => ({ default: m.RecipesPage })),
);
const AboutPage = lazy(() =>
  import('../features/lab/AboutPage.js').then((m) => ({ default: m.AboutPage })),
);

const NAV: readonly (readonly [string, MessageKey, readonly string[]])[] = [
  ['#/', 'nav.workbench', ['']],
  ['#/chars', 'nav.chars', ['chars', 'char']],
  ['#/blocks', 'nav.blocks', ['blocks']],
  ['#/scripts', 'nav.scripts', ['scripts']],
  ['#/regex', 'nav.regex', ['regex']],
  ['#/playground', 'nav.playground', ['playground']],
  ['#/recipes', 'nav.recipes', ['recipes']],
  ['#/about', 'nav.about', ['about']],
];

function decode(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

function Page({ section, param }: { readonly section: string; readonly param: string }): ReactNode {
  switch (section) {
    case '':
      return <Workbench />;
    case 'chars':
      return <CharsPage />;
    case 'char':
      return <CharPage param={param} />;
    case 'blocks':
      return <BlocksPage param={param} />;
    case 'scripts':
      return <ScriptsPage param={param} />;
    case 'regex':
      return <RegexPage />;
    case 'playground':
      return <PlaygroundPage param={param} />;
    case 'recipes':
      return <RecipesPage />;
    case 'about':
      return <AboutPage />;
    default:
      return (
        <main id="main" className={styles.notFound}>
          <p>{t('nav.notFound')}</p>
          <a href="#/">{t('nav.home')}</a>
        </main>
      );
  }
}

export function App(): ReactNode {
  const route = useRoute();
  // `/blocks/Basic_Latin` → section `blocks`, param `Basic_Latin`.
  const [, section = '', ...rest] = route.split('/');
  const param = decode(rest.join('/'));
  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#main">
        {t('app.skip')}
      </a>
      <header className={styles.header}>
        <span className={styles.logo}>{t('app.title')}</span>
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map(([href, key, sections]) => (
            <a
              key={href}
              href={href}
              aria-current={sections.includes(section) ? 'page' : undefined}
            >
              {t(key)}
            </a>
          ))}
        </nav>
      </header>
      <Suspense
        fallback={
          <main id="main" className={styles.notFound}>
            <p>{t('nav.loading')}</p>
          </main>
        }
      >
        <Page section={section} param={param} />
      </Suspense>
    </div>
  );
}
