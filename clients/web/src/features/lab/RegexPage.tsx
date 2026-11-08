// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Regex lab (`#/regex?p=…&f=…`): a portable-profile pattern (PRD §4.9) run against test
 * text in a worker, with highlighted matches, the translated pattern and the timeout.
 */

import { DEFAULT_LIMITS } from '@unichef/core';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { routeQuery, useHash } from '../../app/router.js';
import { t } from '../../i18n/index.js';
import { visible } from '../../lib/format.js';
import { RegexClient, UcdError, type RegexService } from '../../lib/ucd.js';
import type { RegexRun } from '../../worker/ucd-protocol.js';
import styles from './Lab.module.css';

export const RUN_MS = 300;
export const FLAGS = ['i', 'm', 's', 'x'] as const;
/** Longer translations are cut in the viewer; `\p{…}` classes expand to thousands of ranges. */
export const MAX_SHOWN_JS = 20_000;
const MIN_TIMEOUT = 10;
const MAX_TIMEOUT = 60_000;

const DEFAULT_TEXT = 'Café · CAFÉ · café · ٣٤٥ · 🦄 unicorn';

/** Makes the page's regex service; tests supply one that runs in-process. */
export const RegexContext = createContext<() => RegexService>(() => new RegexClient());

type Result =
  | { readonly state: 'running' }
  | { readonly state: 'done'; readonly run: RegexRun; readonly text: string }
  | { readonly state: 'error'; readonly error: UcdError };

function regexHref(pattern: string, flags: string): string {
  const params = new URLSearchParams({ p: pattern });
  if (flags !== '') params.set('f', flags);
  return `#/regex?${params.toString()}`;
}

/** The test text cut into plain and matched pieces. */
function Highlight({ text, run }: { readonly text: string; readonly run: RegexRun }): ReactNode {
  const pieces: ReactNode[] = [];
  let at = 0;
  run.matches.forEach(({ at: [start, end] }, i) => {
    if (start > at) pieces.push(text.slice(at, start));
    pieces.push(
      <mark key={i} className={styles.match} data-empty={start === end || undefined}>
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  pieces.push(text.slice(at));
  return <pre className={styles.highlight}>{pieces}</pre>;
}

function MatchTable({ text, run }: { readonly text: string; readonly run: RegexRun }): ReactNode {
  const names = new Map(run.named.map(([name, index]) => [index, name]));
  const groups = Array.from({ length: run.groups }, (_, i) => i + 1);
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>{t('regex.matches')}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t('regex.span')}</th>
            <th scope="col">{t('regex.match')}</th>
            {groups.map((g) => (
              <th key={g} scope="col">
                {names.get(g) ?? g}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {run.matches.map((m, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                {m.cp[0]}–{m.cp[1]}
              </td>
              <td className={styles.mono} dir="auto">
                {m.at[0] === m.at[1] ? '∅' : visible(text.slice(m.at[0], m.at[1]))}
              </td>
              {m.groups.map((value, g) => (
                <td key={g} className={styles.mono} dir="auto">
                  {value === null ? '—' : visible(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RegexPage(): ReactNode {
  const id = useId();
  const query = routeQuery(useHash());
  const [pattern, setPattern] = useState(query.get('p') ?? '\\p{L}+');
  const [flags, setFlags] = useState(query.get('f') ?? 'i');
  const [text, setText] = useState(DEFAULT_TEXT);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_LIMITS.regexTimeoutMs);
  const [result, setResult] = useState<Result | null>(null);

  const create = useContext(RegexContext);
  const service = useRef<RegexService | null>(null);
  useEffect(() => {
    const s = create();
    service.current = s;
    return () => {
      s.dispose();
      service.current = null;
    };
  }, [create]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.history.replaceState(null, '', regexHref(pattern, flags));
      if (pattern === '') {
        setResult(null);
        return;
      }
      setResult({ state: 'running' });
      service.current?.run({ kind: 'regex', pattern, flags, text, timeoutMs }).then(
        (run) => {
          // Spans index the text that ran, which may have changed since.
          setResult({ state: 'done', run, text });
        },
        (exc: unknown) => {
          if (exc instanceof UcdError && exc.code === 'E_CANCELLED') return;
          const error =
            exc instanceof UcdError
              ? exc
              : new UcdError({ code: 'E_INTERNAL', message: String(exc), path: [] });
          setResult({ state: 'error', error });
        },
      );
    }, RUN_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [pattern, flags, text, timeoutMs]);

  const toggleFlag = (flag: string) => {
    setFlags((current) =>
      FLAGS.filter((f) => (f === flag ? !current.includes(f) : current.includes(f))).join(''),
    );
  };

  return (
    <main id="main" className={styles.page}>
      <h1 className={styles.title}>{t('regex.title')}</h1>
      <p className={styles.muted}>{t('regex.intro')}</p>
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>{t('regex.pattern')}</span>
          <input
            className={`${styles.input} ${styles.mono}`}
            spellCheck={false}
            autoComplete="off"
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value);
            }}
          />
        </label>
        <fieldset className={styles.flags}>
          <legend className={styles.label}>{t('regex.flags')}</legend>
          {FLAGS.map((flag) => (
            <label key={flag} title={t(`regex.flag.${flag}`)}>
              <input
                type="checkbox"
                checked={flags.includes(flag)}
                onChange={() => {
                  toggleFlag(flag);
                }}
              />{' '}
              <span className={styles.mono}>{flag}</span>
              <span className={styles.visuallyHidden}> {t(`regex.flag.${flag}`)}</span>
            </label>
          ))}
        </fieldset>
        <label className={styles.field}>
          <span className={styles.label}>{t('regex.timeout')}</span>
          <input
            className={styles.input}
            type="number"
            min={MIN_TIMEOUT}
            max={MAX_TIMEOUT}
            step={100}
            value={timeoutMs}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value))
                setTimeoutMs(Math.min(MAX_TIMEOUT, Math.max(MIN_TIMEOUT, Math.round(value))));
            }}
          />
        </label>
      </div>
      <label className={styles.label} htmlFor={`${id}-text`}>
        {t('regex.text')}
      </label>
      <textarea
        id={`${id}-text`}
        className={`${styles.input} ${styles.mono}`}
        rows={5}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <div className={styles.status} role="status" data-status>
        {result?.state === 'running' && <p className={styles.muted}>{t('regex.running')}</p>}
        {result?.state === 'error' && (
          <p className={styles.error}>
            <span className={styles.mono}>{result.error.code}</span> {result.error.message}
          </p>
        )}
        {result?.state === 'done' && (
          <p className={styles.muted}>
            {t('regex.count', {
              count: result.run.matches.length.toLocaleString(),
              ms: Math.round(result.run.ms),
              timeout: timeoutMs.toLocaleString(),
            })}
            {result.run.truncated && ` ${t('regex.truncated')}`}
          </p>
        )}
      </div>
      {result?.state === 'done' && (
        <>
          <h2 className={styles.subtitle}>{t('regex.highlighted')}</h2>
          <Highlight text={result.text} run={result.run} />
          {result.run.matches.length > 0 && <MatchTable text={result.text} run={result.run} />}
          <details className={styles.details}>
            <summary>
              {t('regex.translated', { length: result.run.js.length.toLocaleString() })}
            </summary>
            <pre className={styles.code}>
              {result.run.js.length > MAX_SHOWN_JS
                ? `${result.run.js.slice(0, MAX_SHOWN_JS)}…`
                : result.run.js}
            </pre>
          </details>
        </>
      )}
    </main>
  );
}
