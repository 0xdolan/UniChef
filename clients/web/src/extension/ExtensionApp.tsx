// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The extension page (PRD §7.5): one bundle for the side panel, the Firefox sidebar and
 * the Safari popup. `#/panel` or `#/popup` sets the layout, then the default tab opens.
 */

import { TABS, type ExtSettings, type Tab } from '@ext/settings.js';
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

import { useHash } from '../app/router.js';
import { t, type MessageKey } from '../i18n/index.js';
import styles from './Extension.module.css';
import { api, useSelection, useSettings } from './host.js';
import { InspectTab } from './InspectTab.js';
import { RecipeTab } from './RecipeTab.js';
import { extView, tabHref, type Layout } from './route.js';
import { SettingsTab } from './SettingsTab.js';

const CharsPage = lazy(() =>
  import('../features/chars/CharsPage.js').then((m) => ({ default: m.CharsPage })),
);
const CharPage = lazy(() =>
  import('../features/chars/CharPage.js').then((m) => ({ default: m.CharPage })),
);

const NAV: readonly (Tab | 'settings')[] = [...TABS, 'settings'];

function applyTheme(theme: ExtSettings['theme']): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

function decode(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

/** The selection cut to `max` code points, and whether it was cut. */
export function capSelection(text: string, max: number): { text: string; cut: boolean } {
  const points = Array.from(text);
  return points.length > max
    ? { text: points.slice(0, max).join(''), cut: true }
    : { text, cut: false };
}

export function ExtensionApp(): ReactNode {
  const hash = useHash();
  const view = extView(hash);
  const settings = useSettings();
  const selection = useSelection();
  const [layout, setLayout] = useState<Layout>('panel');
  const [text, setText] = useState('');
  const [cut, setCut] = useState(false);
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (settings !== null) applyTheme(settings.theme);
  }, [settings]);

  // `#/panel` and `#/popup` only pick the layout; `replace` keeps them out of history.
  useEffect(() => {
    if (settings === null) return;
    if (view.view === 'start') setLayout(view.layout);
    if (view.view === 'start' || view.view === 'unknown') {
      window.location.replace(tabHref(settings.defaultTab));
    }
  }, [view, settings]);

  // A new selection from a page replaces the text and shows it in Inspect. Each one is
  // shown once, so that a settings change does not pull the user back to Inspect.
  useEffect(() => {
    if (selection === null || settings === null || shown.current === selection) return;
    shown.current = selection;
    const capped = capSelection(selection, settings.maxSelection);
    setText(capped.text);
    setCut(capped.cut);
    window.location.replace(tabHref('inspect'));
  }, [selection, settings]);

  if (settings === null) return <p className={styles.muted}>{t('nav.loading')}</p>;

  const active = view.view === 'char' ? 'chars' : view.view;
  return (
    <div className={`${styles.app} ${layout === 'popup' ? styles.popup : ''}`}>
      <nav aria-label={t('ext.nav')} className={styles.tabs}>
        {NAV.map((tab) => (
          <a key={tab} href={tabHref(tab)} aria-current={active === tab ? 'page' : undefined}>
            {t(`ext.tab.${tab}` as MessageKey)}
          </a>
        ))}
      </nav>
      <main id="main" className={styles.main}>
        {cut && (
          <p role="status" className={styles.notice}>
            {t('ext.selectionCut', { max: settings.maxSelection })}
          </p>
        )}
        <Suspense fallback={<p className={styles.muted}>{t('nav.loading')}</p>}>
          {view.view === 'inspect' && (
            <InspectTab
              text={text}
              onText={(next) => {
                setText(next);
                setCut(false);
              }}
            />
          )}
          {view.view === 'recipe' && <RecipeTab />}
          {view.view === 'chars' && <CharsPage />}
          {view.view === 'char' && <CharPage param={decode(view.param)} />}
          {view.view === 'settings' && <SettingsTab host={api} settings={settings} />}
        </Suspense>
      </main>
    </div>
  );
}
