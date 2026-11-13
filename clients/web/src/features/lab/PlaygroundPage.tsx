// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Generated operation demos (`#/playground`, `#/playground/<op-id>`). Each page is built
 * from the op's metadata: description, types, the schema-driven argument form and its
 * examples (FR-030). No op needs page code of its own.
 */

import {
  DEFAULT_LIMITS,
  allOperationInfo,
  hasOperationInfo,
  getOperationInfo,
  type OperationInfo,
} from '@unichef/core';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { BAKE_MS, createBakeWorker } from '../../lib/baker.js';
import { dishText } from '../../lib/format.js';
import {
  newStep,
  recipeDoc,
  redactSecrets,
  stepsFromDoc,
  type StepModel,
} from '../../state/recipe.js';
import { useApp } from '../../state/store.js';
import { BakeClient, type WorkerLike } from '../../worker/client.js';
import { ArgField } from '../args/ArgField.js';
import styles from './Lab.module.css';
import { useWorkbenchHref } from './links.js';

export const RUN_MS = 300;
const LABEL_CHARS = 32;

/** One line of at most `LABEL_CHARS` code points, for an example button. */
export function clip(text: string): string {
  const chars = Array.from(text.replace(/\s+/g, ' '));
  return chars.length > LABEL_CHARS
    ? `${chars.slice(0, LABEL_CHARS - 1).join('')}…`
    : chars.join('');
}

/** Starting input when an op has no examples. */
export function sampleInput(op: OperationInfo): string {
  return op.inputType === 'json' ? '{"sub": "demo", "name": "Zoë"}' : 'Héllo, wörld! 👋';
}

type Output =
  | { readonly state: 'running' }
  | { readonly state: 'done'; readonly text: string; readonly ms: number }
  | { readonly state: 'error'; readonly code: string; readonly message: string };

/** Bakes the one-step recipe in a worker of its own whenever it or the input changes. */
function usePlaygroundBake(
  step: StepModel,
  input: string,
  create: () => WorkerLike,
): Output | null {
  const [output, setOutput] = useState<Output | null>(null);
  const [client, setClient] = useState<BakeClient | null>(null);

  useEffect(() => {
    const c = new BakeClient(create, {
      onMessage: (message) => {
        if (message.kind === 'done')
          setOutput({ state: 'done', text: dishText(message.output), ms: message.ms });
        else if (message.kind === 'error') setOutput({ state: 'error', ...message.error });
      },
      onRestart: (_id, error) => {
        setOutput({ state: 'error', ...error });
      },
    });
    setClient(c);
    return () => {
      c.dispose();
    };
  }, [create]);

  useEffect(() => {
    if (client === null) return;
    const timer = setTimeout(() => {
      setOutput({ state: 'running' });
      client.bake(
        recipeDoc([step]),
        { type: 'string', value: input },
        { snapshots: false, limits: DEFAULT_LIMITS },
        BAKE_MS,
      );
    }, RUN_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [client, step, input]);

  return output;
}

function Demo({
  op,
  create,
}: {
  readonly op: OperationInfo;
  readonly create: () => WorkerLike;
}): ReactNode {
  const id = useId();
  const [step, setStep] = useState(() => newStep(op.id));
  const [input, setInput] = useState(() => op.examples[0]?.input ?? sampleInput(op));
  const output = usePlaygroundBake(step, input, create);
  // The link is shareable, so keys and IVs stay out of it unless the user opted in (SEC-007).
  const shareSecrets = useApp((s) => s.shareSecrets);
  const doc = useMemo(
    () => recipeDoc(shareSecrets ? [step] : redactSecrets([step])),
    [step, shareSecrets],
  );
  const href = useWorkbenchHref(doc, input);

  return (
    <>
      <p>{op.description}</p>
      <dl className={styles.facts}>
        <dt>{t('playground.id')}</dt>
        <dd className={styles.mono}>{op.id}</dd>
        <dt>{t('playground.category')}</dt>
        <dd>{op.category}</dd>
        <dt>{t('playground.types')}</dt>
        <dd className={styles.mono}>
          {op.inputType} → {op.outputType}
        </dd>
      </dl>

      {op.examples.length > 0 && (
        <>
          <h2 className={styles.subtitle}>{t('playground.examples')}</h2>
          <ul className={styles.chips}>
            {op.examples.map((example, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={styles.button}
                  title={`${example.input} → ${example.output}`}
                  onClick={() => {
                    const [loaded] = stepsFromDoc({
                      version: 1,
                      steps: [{ op: op.id, args: example.args }],
                    });
                    if (loaded !== undefined) setStep(loaded);
                    setInput(example.input);
                  }}
                >
                  {clip(example.input)} → {clip(example.output)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {op.args.length > 0 && (
        <>
          <h2 className={styles.subtitle}>{t('playground.args')}</h2>
          <div className={styles.args}>
            {op.args.map((spec) => (
              <ArgField
                key={spec.name}
                id={`${id}-${spec.name}`}
                spec={spec}
                value={step.args[spec.name]}
                onChange={(value) => {
                  setStep((s) => ({ ...s, args: { ...s.args, [spec.name]: value } }));
                }}
                renderSteps={() => <p className={styles.muted}>{t('playground.nested')}</p>}
              />
            ))}
          </div>
        </>
      )}

      <label className={styles.subtitle} htmlFor={`${id}-input`}>
        {t('input.title')}
      </label>
      <textarea
        id={`${id}-input`}
        className={`${styles.input} ${styles.mono}`}
        rows={4}
        spellCheck={false}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
        }}
      />
      <h2 className={styles.subtitle}>{t('output.title')}</h2>
      <div role="status" data-status className={styles.status}>
        {output?.state === 'running' && <p className={styles.muted}>{t('bake.baking')}</p>}
        {output?.state === 'done' && (
          <p className={styles.muted}>{t('bake.done', { ms: Math.round(output.ms) })}</p>
        )}
        {output?.state === 'error' && (
          <p className={styles.error}>
            <span className={styles.mono}>{output.code}</span> {output.message}
          </p>
        )}
      </div>
      <pre className={styles.output}>{output?.state === 'done' ? output.text : ''}</pre>
      {href !== null && (
        <a className={styles.button} href={href}>
          {t('playground.open')}
        </a>
      )}
    </>
  );
}

function Index(): ReactNode {
  const groups = new Map<string, OperationInfo[]>();
  for (const op of allOperationInfo()) {
    const group = groups.get(op.category);
    if (group === undefined) groups.set(op.category, [op]);
    else group.push(op);
  }
  return (
    <>
      <p className={styles.muted}>{t('playground.intro')}</p>
      {[...groups].map(([category, ops]) => (
        <section key={category}>
          <h2 className={styles.subtitle}>{category}</h2>
          <ul className={styles.chips}>
            {ops.map((op) => (
              <li key={op.id}>
                <a href={`#/playground/${op.id}`}>{op.name}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function PlaygroundPage({
  param,
  createWorker = createBakeWorker,
}: {
  readonly param: string;
  readonly createWorker?: () => WorkerLike;
}): ReactNode {
  const op = param !== '' && hasOperationInfo(param) ? getOperationInfo(param) : null;
  return (
    <main id="main" className={styles.page}>
      {op !== null && (
        <nav aria-label={t('nav.breadcrumb')}>
          <a href="#/playground">{t('playground.title')}</a>
        </nav>
      )}
      <h1 className={styles.title}>{op?.name ?? t('playground.title')}</h1>
      {param !== '' && op === null && (
        <p className={styles.error}>{t('playground.unknown', { id: param })}</p>
      )}
      {op === null ? <Index /> : <Demo key={op.id} op={op} create={createWorker} />}
    </main>
  );
}
