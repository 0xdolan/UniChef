// SPDX-License-Identifier: GPL-3.0-or-later
/** Settings (PRD §7.1), saved to `storage.sync` so they follow the browser profile. */

import type { ExtApi } from '@ext/browser.js';
import { send } from '@ext/messages.js';
import {
  MAX_SELECTION_RANGE,
  TABS,
  THEMES,
  saveSettings,
  type ExtSettings,
  type Tab,
  type Theme,
} from '@ext/settings.js';
import { useId, useState, type ReactNode } from 'react';

import { t, type MessageKey } from '../i18n/index.js';
import styles from './Extension.module.css';

export function SettingsTab({
  host,
  settings,
}: {
  readonly host: ExtApi | undefined;
  readonly settings: ExtSettings;
}): ReactNode {
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  const save = (next: ExtSettings): void => {
    if (host === undefined) return;
    setError(null);
    saveSettings(host, next)
      .then(() => send(host, { type: 'settings/changed', settings: next }))
      .catch((exc: unknown) => {
        setError(exc instanceof Error ? exc.message : String(exc));
      });
  };

  return (
    <form
      className={styles.stack}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <label htmlFor={`${id}-theme`} className={styles.label}>
        {t('ext.settings.theme')}
      </label>
      <select
        id={`${id}-theme`}
        value={settings.theme}
        onChange={(e) => {
          save({ ...settings, theme: e.target.value as Theme });
        }}
      >
        {THEMES.map((theme) => (
          <option key={theme} value={theme}>
            {t(`ext.theme.${theme}` as MessageKey)}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-tab`} className={styles.label}>
        {t('ext.settings.defaultTab')}
      </label>
      <select
        id={`${id}-tab`}
        value={settings.defaultTab}
        onChange={(e) => {
          save({ ...settings, defaultTab: e.target.value as Tab });
        }}
      >
        {TABS.map((tab) => (
          <option key={tab} value={tab}>
            {t(`ext.tab.${tab}` as MessageKey)}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-max`} className={styles.label}>
        {t('ext.settings.maxSelection')}
      </label>
      <input
        id={`${id}-max`}
        type="number"
        min={MAX_SELECTION_RANGE[0]}
        max={MAX_SELECTION_RANGE[1]}
        step={1000}
        defaultValue={settings.maxSelection}
        onBlur={(e) => {
          const value = e.target.valueAsNumber;
          if (
            Number.isInteger(value) &&
            value >= MAX_SELECTION_RANGE[0] &&
            value <= MAX_SELECTION_RANGE[1]
          ) {
            save({ ...settings, maxSelection: value });
          } else {
            setError(
              t('ext.settings.maxRange', {
                min: MAX_SELECTION_RANGE[0],
                max: MAX_SELECTION_RANGE[1],
              }),
            );
          }
        }}
      />
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
