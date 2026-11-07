// SPDX-License-Identifier: GPL-3.0-or-later
/** Character lookups for the Chars, Blocks and Scripts pages, run inside `ucd.worker.ts`. */

import { makeDish, runOperation, type Table } from '@unichef/core';
import { ESCAPE_FORMATS } from '@unichef/core/ops/unicode.js';
import { data, names, props, query, ready } from '@unichef/core/unicode/index.js';

import type {
  BlockInfo,
  CharCell,
  CharDetail,
  ScriptChars,
  ScriptInfo,
  SearchResult,
  UcdRequest,
  UcdResult,
} from './ucd-protocol.js';

const QUERY_SYNTAX = /[=<>~&|!()]/;
const REGEX_SPECIAL = /[.^$*+?()[\]{}|\\/]/g;
const SURROGATES: readonly [number, number] = [0xd800, 0xdfff];

/** Plain words search names, case-insensitively, as `unichef search` does. */
export function expandQuery(text: string): string {
  return QUERY_SYNTAX.test(text) ? text : `name~/${text.trim().replace(REGEX_SPECIAL, '\\$&')}/i`;
}

const size = (ranges: data.Ranges): number =>
  ranges.reduce((n, [start, end]) => n + end - start + 1, 0);

const isSurrogate = (cp: number): boolean => cp >= SURROGATES[0] && cp <= SURROGATES[1];

async function analyse(text: string): Promise<Table> {
  const result = await runOperation(
    'analyse-characters',
    { granularity: 'codepoint' },
    makeDish('string', text),
  );
  return result.dish.value as Table;
}

async function cells(codePoints: readonly number[]): Promise<CharCell[]> {
  // Surrogates go one at a time: next to each other, a high and a low one would pair up.
  const runs: number[][] = [];
  for (const cp of codePoints) {
    const last = runs.at(-1);
    if (last === undefined || isSurrogate(cp) || isSurrogate(last[0] ?? 0)) runs.push([cp]);
    else last.push(cp);
  }
  const out: CharCell[] = [];
  for (const run of runs) {
    const table = await analyse(String.fromCodePoint(...run));
    table.rows.forEach((row, i) => {
      out.push({
        cp: run[i] ?? 0,
        glyph: String(row[2]),
        name: String(row[3]),
        gc: String(row[4]),
      });
    });
  }
  return out;
}

async function char(cp: number): Promise<CharDetail> {
  const text = String.fromCodePoint(cp);
  const table = await analyse(text);
  const row = table.rows[0] ?? [];
  const fields = table.columns
    .map((column, i) => [column, String(row[i] ?? '')] as const)
    .filter(([column]) => column !== 'index');
  const escapes: (readonly [string, string])[] = [];
  for (const format of ESCAPE_FORMATS) {
    const result = await runOperation(
      'escape-unicode',
      { format, scope: 'all' },
      makeDish('string', text),
    );
    escapes.push([format, result.dish.value as string]);
  }
  return { cp, text, fields, aliases: names.aliases(cp), escapes };
}

function blocks(): BlockInfo[] {
  const unassigned = props.rangesFor('gc', 'Cn');
  return data.load('core').blocks.map(({ start, end, name }) => ({
    start,
    end,
    name,
    assigned: end - start + 1 - size(data.intersect([[start, end]], unassigned)),
  }));
}

/** ISO 15924 code → long name (the longest alias), as `unichef script list` shows them. */
function scriptNames(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [alias, code] of Object.entries(data.load('core').aliases.values.sc ?? {})) {
    if (alias.length > (out.get(code) ?? '').length) out.set(code, alias);
  }
  return out;
}

function scripts(): ScriptInfo[] {
  return [...scriptNames()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([code, name]) => ({ code, name, count: size(props.rangesFor('sc', code)) }));
}

function script(name: string, extensions: boolean): ScriptChars {
  const code = props.resolveValue('sc', name);
  const ranges = extensions ? props.scxRanges(code) : props.rangesFor('sc', code);
  return { code, name: scriptNames().get(code) ?? code, codePoints: [...data.codePoints(ranges)] };
}

function search(text: string): SearchResult {
  const expanded = expandQuery(text);
  const found = query.query(expanded);
  return {
    codePoints: found.codePoints,
    total: found.total,
    truncated: found.truncated,
    exact: expanded === text ? null : names.lookup(text),
  };
}

/** Answer one request. Throws `UniChefError` for a bad query or an unknown script. */
export async function handle<R extends UcdRequest>(request: R): Promise<UcdResult<R>>;
export async function handle(request: UcdRequest): Promise<UcdResult<UcdRequest>> {
  await ready();
  switch (request.kind) {
    case 'search':
      return search(request.query);
    case 'blocks':
      return blocks();
    case 'scripts':
      return scripts();
    case 'script':
      return script(request.code, request.extensions);
    case 'cells':
      return cells(request.codePoints);
    case 'char':
      return char(request.cp);
  }
}
