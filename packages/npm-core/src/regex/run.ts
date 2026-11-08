// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Run portable regexes on the host's RegExp engine with the `v` flag (PRD §4.9).
 *
 * Spans are UTF-16 indices into the JavaScript string. They select exactly the same text
 * as Python's code-point spans; nothing here exposes them as numbers. Iteration follows
 * JavaScript's global matching: after an empty match the search resumes one code point
 * later, so both hosts report the same matches.
 *
 * Timeouts: a JavaScript RegExp search cannot be interrupted. `E_REGEX_TIMEOUT` is
 * therefore raised when a search *returns* after the bound has passed, and `finditer`
 * also checks its deadline (and cancellation) before every search. A single catastrophic
 * search still runs to completion before the error is raised, where Python's `regex`
 * stops it at the bound. This is the one known parity gap of the regex engine.
 */

import { UniChefError } from '../errors.js';
import { pyRepr } from '../ops/types.js';
import { CACHE_SIZE, lru, translate, type Translation } from './translate.js';

export type Span = readonly [number, number];

const MAX_TWO_DIGIT_GROUP = 99;
const FIRST_ASTRAL = 0x10000;

/** One match: `spans[0]` is the whole match, `spans[n]` group `n` (or null). */
export class Match {
  constructor(readonly spans: readonly (Span | null)[]) {}

  get span(): Span {
    const whole = this.spans[0];
    if (whole === undefined || whole === null) {
      throw new UniChefError('E_INTERNAL', 'A match has no span; please report this.');
    }
    return whole;
  }

  get start(): number {
    return this.span[0];
  }

  get end(): number {
    return this.span[1];
  }

  group(text: string, index = 0): string | null {
    const span = this.spans[index];
    return span === undefined || span === null ? null : text.slice(span[0], span[1]);
  }
}

export class Compiled {
  private tester: RegExp | undefined;

  constructor(
    readonly translation: Translation,
    readonly regexp: RegExp,
  ) {}

  /** The same pattern without the `d` and `g` flags, for match-or-not tests. Match indices
   * make every exec about 50 times slower, which a scan over all names cannot afford. */
  get test(): RegExp {
    this.tester ??= new RegExp(this.regexp.source, 'v');
    return this.tester;
  }

  get groups(): number {
    return this.translation.groups;
  }

  /** The group number of a named group. */
  index(name: string): number | null {
    return this.translation.groupIndex.get(name) ?? null;
  }
}

const compiled = lru(CACHE_SIZE, (key: string): Compiled => {
  const [pattern, flags] = JSON.parse(key) as [string, string];
  const translation = translate(pattern, flags);
  let regexp: RegExp;
  try {
    regexp = new RegExp(translation.js, 'dgv');
  } catch (exc) {
    /* c8 ignore next 3 -- the translator emits valid syntax */
    const why = exc instanceof Error ? exc.message : String(exc);
    throw new UniChefError('E_INTERNAL', `Translated regex failed to compile: ${why}`);
  }
  return new Compiled(translation, regexp);
});

/** Translate and compile `pattern`. Raises `E_ARG_INVALID`/`E_REGEX_UNSUPPORTED`. */
export function compileRegex(pattern: string, flags = ''): Compiled {
  return compiled(JSON.stringify([pattern, flags]));
}

function timeout(timeoutMs: number, pattern: string): UniChefError {
  return new UniChefError(
    'E_REGEX_TIMEOUT',
    `The regex ${pyRepr(Array.from(pattern).slice(0, 32).join(''))} ran longer than ${String(timeoutMs)} ms.`,
  );
}

function exec(c: Compiled, text: string, pos: number): Match | null {
  c.regexp.lastIndex = pos;
  const found = c.regexp.exec(text);
  if (found === null) {
    return null;
  }
  const indices = found.indices ?? [];
  const spans: (Span | null)[] = [];
  for (let i = 0; i <= c.groups; i++) {
    const span = indices[i];
    spans.push(span === undefined ? null : [span[0], span[1]]);
  }
  return new Match(spans);
}

/** The first match at or after `pos`. */
export function search(c: Compiled, text: string, timeoutMs: number, pos = 0): Match | null {
  const started = performance.now();
  const found = exec(c, text, pos);
  if (performance.now() - started > timeoutMs) {
    throw timeout(timeoutMs, c.translation.source);
  }
  return found;
}

/** Calls between clock reads in `predicate`. */
export const CLOCK_EVERY = 64;

/**
 * A fast "does it match anywhere" test for scanning many short strings. Reading the clock
 * costs about as much as testing a short name, so it is read once per `CLOCK_EVERY` calls,
 * and the bound applies to each such batch. A native search cannot be interrupted, so the
 * check was always made after the fact; batching keeps the bound and drops the cost.
 */
export function predicate(c: Compiled, timeoutMs: number): (text: string) => boolean {
  const re = c.test;
  let calls = 0;
  let started = 0;
  return (text) => {
    if (calls === 0) {
      started = performance.now();
    }
    const found = re.test(text);
    if (++calls === CLOCK_EVERY) {
      calls = 0;
      if (performance.now() - started > timeoutMs) {
        throw timeout(timeoutMs, c.translation.source);
      }
    }
    return found;
  };
}

/** Every match, left to right, with JavaScript's `g`-flag stepping. The bound covers the
 * whole iteration, not each search. */
export function* finditer(
  c: Compiled,
  text: string,
  timeoutMs: number,
  check?: () => void,
): Generator<Match> {
  const deadline = performance.now() + timeoutMs;
  let pos = 0;
  while (pos <= text.length) {
    check?.();
    if (performance.now() >= deadline) {
      throw timeout(timeoutMs, c.translation.source);
    }
    const found = exec(c, text, pos);
    if (performance.now() > deadline) {
      throw timeout(timeoutMs, c.translation.source);
    }
    if (found === null) {
      return;
    }
    yield found;
    const { start, end } = found;
    pos = end > start ? end : end + ((text.codePointAt(end) ?? 0) >= FIRST_ASTRAL ? 2 : 1);
  }
}

const isAsciiDigit = (ch: string): boolean => ch.length === 1 && ch >= '0' && ch <= '9';

function groupNumber(template: string, at: number, groups: number): [number | null, number] {
  const first = Number(template[at]);
  const second = template[at + 1] ?? '';
  if (isAsciiDigit(second)) {
    const two = first * 10 + Number(second);
    if (two >= 1 && two <= Math.min(groups, MAX_TWO_DIGIT_GROUP)) {
      return [two, 2];
    }
  }
  return first >= 1 && first <= groups ? [first, 1] : [null, 0];
}

/**
 * Expand a replacement template in JavaScript syntax.
 *
 * `$$` is a dollar, `$&` the match, `$1`-`$99` a group, `$<name>` a named group; a group
 * that did not participate gives "". Anything else is literal.
 */
export function expand(template: string, match: Match, text: string, c: Compiled): string {
  const out: string[] = [];
  let i = 0;
  const n = template.length;
  while (i < n) {
    const ch = template[i] ?? '';
    const nxt = template[i + 1] ?? '';
    if (ch !== '$' || nxt === '') {
      out.push(ch);
      i += 1;
    } else if (nxt === '$') {
      out.push('$');
      i += 2;
    } else if (nxt === '&') {
      out.push(text.slice(match.start, match.end));
      i += 2;
    } else if (isAsciiDigit(nxt)) {
      const [index, used] = groupNumber(template, i + 1, c.groups);
      if (index === null) {
        out.push('$');
        i += 1;
      } else {
        out.push(match.group(text, index) ?? '');
        i += 1 + used;
      }
    } else if (nxt === '<' && c.translation.names.length > 0 && template.indexOf('>', i) > 0) {
      const end = template.indexOf('>', i);
      const index = c.index(template.slice(i + 2, end));
      out.push(index === null ? '' : (match.group(text, index) ?? ''));
      i = end + 1;
    } else {
      out.push('$');
      i += 1;
    }
  }
  return out.join('');
}
