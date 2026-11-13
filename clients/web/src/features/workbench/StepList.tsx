// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The recipe's steps, with nested step lists for flow operations. Steps reorder by drag
 * and drop (mouse, touch or keyboard) and by the Move buttons (FR-001), and show a live
 * badge from the bake's step snapshots (FR-002).
 */

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { allOperationInfo, getOperationInfo } from '@unichef/core';
import { useId, useMemo, type ReactNode } from 'react';

import { t } from '../../i18n/index.js';
import { DOCS_ELSEWHERE, opDocsHref } from '../docs/links.js';
import { sizeLabel } from '../../lib/format.js';
import { newStep, type StepModel } from '../../state/recipe.js';
import { pathKey, useApp } from '../../state/store.js';
import { ArgField } from '../args/ArgField.js';
import styles from './Workbench.module.css';

/** Adds an operation to a nested step list. */
function NestedAdd({ onAdd }: { readonly onAdd: (op: string) => void }): ReactNode {
  return (
    <select
      aria-label={t('recipe.nestedAdd')}
      className={styles.control}
      value=""
      onChange={(e) => {
        if (e.target.value !== '') onAdd(e.target.value);
      }}
    >
      <option value="">{t('recipe.nestedAdd')}</option>
      {allOperationInfo().map((op) => (
        <option key={op.id} value={op.id}>
          {op.name}
        </option>
      ))}
    </select>
  );
}

/** Type, size and time of the step's last output. */
function StepBadge({ stepKey }: { readonly stepKey: string }): ReactNode {
  const snapshot = useApp((s) => s.snapshots[stepKey]);
  const stale = useApp((s) => s.snapshotsStale);
  if (snapshot === undefined) return null;
  const size = sizeLabel(snapshot.type, snapshot.byteLength);
  return (
    <span className={styles.badge} data-stale={stale || undefined}>
      {snapshot.type}
      {size === '' ? '' : ` · ${size}`} · {snapshot.ms < 1 ? '<1' : Math.round(snapshot.ms)} ms
    </span>
  );
}

function StepCard({
  step,
  index,
  path,
}: {
  readonly step: StepModel;
  readonly index: number;
  /** This step's path in the bake: `[2]`, or `[2, 0]` inside a sub-recipe. */
  readonly path: readonly number[];
}): ReactNode {
  const id = useId();
  const op = getOperationInfo(step.op);
  const key = pathKey(path);
  const setArg = useApp((s) => s.setArg);
  const remove = useApp((s) => s.removeStep);
  const move = useApp((s) => s.moveStep);
  const toggle = useApp((s) => s.toggleDisabled);
  const select = useApp((s) => s.select);
  const selected = useApp((s) => s.selected === key);
  const error = useApp((s) => s.error);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.uid });

  const failedAt = error?.path[0];
  const topLevel = path.length === 1;
  const failed =
    error !== null && (pathKey(error.path) === key || (topLevel && failedAt === path[0]));
  const skipped = topLevel && typeof failedAt === 'number' && index > failedAt;

  return (
    <li
      ref={setNodeRef}
      className={styles.step}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-disabled={step.disabled || undefined}
      data-failed={failed || undefined}
      data-skipped={skipped || undefined}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
    >
      <div className={styles.stepHead}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={`${styles.icon} ${styles.handle}`}
          {...attributes}
          {...listeners}
          aria-label={t('recipe.drag', { index: index + 1 })}
          title={t('recipe.drag', { index: index + 1 })}
        >
          ⠿
        </button>
        <span className={styles.stepIndex}>{index + 1}</span>
        <button
          type="button"
          className={styles.stepName}
          id={`${id}-name`}
          aria-pressed={selected}
          aria-label={t('recipe.inspect', { index: index + 1, name: op.name })}
          onClick={() => {
            select(selected ? null : key);
          }}
        >
          {op.name}
        </button>
        <StepBadge stepKey={key} />
        <span className={styles.stepActions}>
          <a
            className={styles.icon}
            href={opDocsHref(op.id)}
            aria-label={t('recipe.docs', { name: op.name })}
            title={t('recipe.docs', { name: op.name })}
            {...(DOCS_ELSEWHERE ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            ?
          </a>
          <button
            type="button"
            className={styles.icon}
            aria-label={t('recipe.up')}
            title={t('recipe.up')}
            onClick={() => {
              move(step.uid, -1);
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={t('recipe.down')}
            title={t('recipe.down')}
            onClick={() => {
              move(step.uid, 1);
            }}
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-pressed={step.disabled}
            aria-label={step.disabled ? t('recipe.enable') : t('recipe.disable')}
            title={step.disabled ? t('recipe.enable') : t('recipe.disable')}
            onClick={() => {
              toggle(step.uid);
            }}
          >
            ⏻
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={t('recipe.remove')}
            title={t('recipe.remove')}
            onClick={() => {
              remove(step.uid);
            }}
          >
            ✕
          </button>
        </span>
      </div>
      {failed && <p className={styles.stepError}>{error.message}</p>}
      {skipped && <p className={styles.stepNote}>{t('recipe.skipped')}</p>}
      {op.args.length > 0 && (
        <div className={styles.args} role="group" aria-labelledby={`${id}-name`}>
          {op.args.map((spec) => (
            <ArgField
              key={spec.name}
              id={`${id}-${spec.name}`}
              spec={spec}
              value={step.args[spec.name]}
              onChange={(value) => {
                setArg(step.uid, spec.name, value);
              }}
              renderSteps={(steps, onChange) => (
                <>
                  {steps.length === 0 ? (
                    <p className={styles.empty}>{t('recipe.nestedEmpty')}</p>
                  ) : (
                    <StepList steps={steps} path={path} />
                  )}
                  <NestedAdd
                    onAdd={(opId) => {
                      onChange([...steps, newStep(opId)]);
                    }}
                  />
                </>
              )}
            />
          ))}
        </div>
      )}
    </li>
  );
}

/** Screen reader messages for drag and drop, by 1-based position rather than internal ids. */
function announcements(steps: readonly StepModel[]): Announcements {
  const at = (id: UniqueIdentifier | undefined) => steps.findIndex((s) => s.uid === id) + 1;
  return {
    onDragStart: ({ active }) => t('dnd.start', { from: at(active.id) }),
    onDragOver: ({ active, over }) =>
      over === null ? undefined : t('dnd.over', { from: at(active.id), to: at(over.id) }),
    onDragEnd: ({ active, over }) =>
      t('dnd.end', { from: at(active.id), to: over === null ? at(active.id) : at(over.id) }),
    onDragCancel: ({ active }) => t('dnd.cancel', { from: at(active.id) }),
  };
}

export function StepList({
  steps,
  path = [],
}: {
  readonly steps: readonly StepModel[];
  /** Path of the step that owns this list; empty for the recipe itself. */
  readonly path?: readonly number[];
}): ReactNode {
  const moveTo = useApp((s) => s.moveTo);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => steps.map((s) => s.uid), [steps]);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over !== null && active.id !== over.id) moveTo(String(active.id), String(over.id));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: announcements(steps),
        screenReaderInstructions: { draggable: t('dnd.instructions') },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={styles.steps}>
          {steps.map((step, i) => (
            <StepCard key={step.uid} step={step} index={i} path={[...path, i]} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
