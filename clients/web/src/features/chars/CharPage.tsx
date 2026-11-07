// SPDX-License-Identifier: GPL-3.0-or-later
/** One character (`#/char/U+0645`): every §4.6 field, aliases and escapes (FR-005). */

import { useState, type ReactNode } from 'react';

import { t, type MessageKey } from '../../i18n/index.js';
import { charHref, cpLabel } from '../../lib/ucd.js';
import styles from './Chars.module.css';
import { blockSlug, useLookup } from './lookup.js';

const MAX_CODE_POINT = 0x10ffff;

const LABELS: Readonly<Record<string, MessageKey>> = {
  cp: 'char.field.cp',
  char: 'char.field.char',
  name: 'char.field.name',
  gc: 'char.field.gc',
  block: 'char.field.block',
  script: 'char.field.script',
  scx: 'char.field.scx',
  age: 'char.field.age',
  bidi: 'char.field.bidi',
  ea: 'char.field.ea',
  utf8: 'char.field.utf8',
  utf16: 'char.field.utf16',
  decomposition: 'char.field.decomposition',
  flags: 'char.field.flags',
};

const label = (field: string): string => {
  const key = LABELS[field];
  return key === undefined ? field : t(key);
};

/** `U+0645` → 0x645; anything else, or past U+10FFFF, is null. */
export function parseCodePoint(param: string): number | null {
  const match = /^U\+([0-9A-F]{1,6})$/i.exec(param);
  if (match === null) return null;
  const cp = parseInt(match[1] ?? '', 16);
  return cp <= MAX_CODE_POINT ? cp : null;
}

function Value({ field, value }: { readonly field: string; readonly value: string }): ReactNode {
  if (value === '') return <span className={styles.muted}>—</span>;
  if (field === 'block') return <a href={`#/blocks/${blockSlug(value)}`}>{value}</a>;
  if (field === 'script') return <a href={`#/scripts/${value}`}>{value}</a>;
  return value;
}

function Copy({ format, text }: { readonly format: string; readonly text: string }): ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={t('char.copy', { format })}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
        });
      }}
    >
      {copied ? t('output.copied') : t('char.copyShort')}
    </button>
  );
}

export function CharPage({ param }: { readonly param: string }): ReactNode {
  const cp = parseCodePoint(param);
  const lookup = useLookup(cp === null ? null : { kind: 'char', cp });

  if (cp === null || lookup?.state === 'error') {
    return (
      <main id="main" className={styles.page}>
        <p>{t('char.invalid', { param })}</p>
        <a href="#/chars">{t('chars.title')}</a>
      </main>
    );
  }
  if (lookup?.state !== 'done') {
    return (
      <main id="main" className={styles.page}>
        <p className={styles.muted}>{t('chars.searching')}</p>
      </main>
    );
  }

  const { fields, aliases, escapes } = lookup.value;
  const field = (name: string): string => fields.find(([f]) => f === name)?.[1] ?? '';
  return (
    <main id="main" className={styles.page}>
      <nav className={styles.pager} aria-label={t('char.pager')}>
        {cp > 0 && <a href={charHref(cp - 1)}>← {cpLabel(cp - 1)}</a>}
        {cp < MAX_CODE_POINT && <a href={charHref(cp + 1)}>{cpLabel(cp + 1)} →</a>}
      </nav>
      <div className={styles.charHead}>
        <span className={styles.bigGlyph} aria-hidden="true">
          {field('char')}
        </span>
        <h1 className={styles.title}>
          <span className={styles.cpText}>{cpLabel(cp)}</span> {field('name')}
        </h1>
      </div>

      <h2 className={styles.subtitle}>{t('char.properties')}</h2>
      <dl className={styles.fields}>
        {fields.map(([name, value]) => (
          <div key={name}>
            <dt>{label(name)}</dt>
            <dd>
              <Value field={name} value={value} />
            </dd>
          </div>
        ))}
      </dl>

      {aliases.length > 0 && (
        <>
          <h2 className={styles.subtitle}>{t('char.aliases')}</h2>
          <ul className={styles.plain}>
            {aliases.map(({ alias, type }) => (
              <li key={`${type}:${alias}`}>
                {alias} <span className={styles.muted}>({type})</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className={styles.subtitle}>{t('char.escapes')}</h2>
      <table className={styles.table}>
        <tbody>
          {escapes.map(([format, text]) => (
            <tr key={format}>
              <th scope="row">{format}</th>
              <td>
                <code>{text}</code>
              </td>
              <td>
                <Copy format={format} text={text} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
