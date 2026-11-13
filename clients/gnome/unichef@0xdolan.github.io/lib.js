// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The logic of the GNOME Shell extension that does not touch GNOME APIs, so it runs and is
 * tested under Node too. Everything here works on the JSON envelope the `unichef` CLI
 * prints with `--format json` (PRD §5.4).
 */

/* global TextDecoder, TextEncoder -- GJS and Node provide them. */

/** The web app the popup's footer opens. */
export const WEB_APP_URL = 'https://0xdolan.github.io/unichef/';

/** Largest input the popup sends to the CLI, in UTF-8 bytes. */
export const MAX_INPUT_BYTES = 1024 * 1024;

/** How many characters the Character tab lists. */
export const MAX_CHARACTERS = 200;

/** The argv that lists every operation. */
export function opsArgv(cli) {
  return [cli, '--format', 'json', '--quiet', 'ops'];
}

/** The argv that runs operation `id` on stdin with its default arguments. */
export function opArgv(cli, id) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error(`Invalid operation id ${id}.`);
  return [cli, '--format', 'json', '--quiet', '-i', '-', 'op', id];
}

/** The argv that analyses every code point on stdin. */
export function inspectArgv(cli) {
  return [cli, '--format', 'json', '--quiet', '-i', '-', 'inspect'];
}

/** Parse the CLI's JSON envelope; a non-envelope becomes an error envelope. */
export function parseEnvelope(stdout, stderr = '') {
  try {
    const env = JSON.parse(stdout);
    if (env !== null && typeof env === 'object' && typeof env.ok === 'boolean') return env;
  } catch {
    // fall through
  }
  const detail = stderr.trim() || stdout.trim() || 'no output';
  return { ok: false, result: null, warnings: [], error: { code: 'E_CLI', message: detail } };
}

function tableRows(env) {
  const value = env.result?.value;
  if (!Array.isArray(value?.columns) || !Array.isArray(value?.rows)) return null;
  return { columns: value.columns, rows: value.rows };
}

/** The operations as `{id, name, category, summary}`, from `unichef ops`. */
export function parseOps(env) {
  const table = env.ok ? tableRows(env) : null;
  if (table === null) return [];
  const at = (name) => table.columns.indexOf(name);
  const [id, name, category, summary] = ['id', 'name', 'category', 'summary'].map(at);
  if (id < 0 || name < 0) return [];
  return table.rows.map((r) => ({
    id: String(r[id]),
    name: String(r[name]),
    category: category < 0 ? '' : String(r[category]),
    summary: summary < 0 ? '' : String(r[summary]),
  }));
}

/**
 * The operations that match `query`, best first: an id or name that starts with the query,
 * then one that contains it, then a summary that contains it.
 */
export function filterOps(ops, query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (q === '') return ops.slice(0, limit);
  const scored = [];
  for (const op of ops) {
    const id = op.id.toLowerCase();
    const name = op.name.toLowerCase();
    let score;
    if (id.startsWith(q) || name.startsWith(q)) score = 0;
    else if (id.includes(q) || name.includes(q)) score = 1;
    else if (op.summary.toLowerCase().includes(q)) score = 2;
    else continue;
    scored.push([score, op]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
  return scored.slice(0, limit).map(([, op]) => op);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decode standard padded Base64. */
export function base64Bytes(text) {
  const clean = text.replace(/=+$/, '');
  const out = [];
  let acc = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('Invalid Base64 in the CLI output.');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * The text the Convert tab shows for an envelope: `{ok, text, note}`. Bytes that are valid
 * UTF-8 show as text, other bytes as hex; tables as tab-separated lines.
 */
export function formatResult(env) {
  const warnings = (env.warnings ?? []).map((w) => `${w.code}: ${w.message}`);
  if (!env.ok) {
    const e = env.error ?? { code: 'E_CLI', message: 'unknown error' };
    return { ok: false, text: `${e.code}: ${e.message}`, note: warnings.join('\n') };
  }
  const result = env.result ?? { type: 'string', value: '' };
  let text;
  let note = warnings;
  switch (result.type) {
    case 'string':
      text = String(result.value);
      break;
    case 'bytes': {
      const bytes = base64Bytes(String(result.base64 ?? ''));
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        text = hex(bytes);
        note = [`Not UTF-8 text; showing ${bytes.length} bytes as hex.`, ...note];
      }
      break;
    }
    case 'table': {
      const table = tableRows(env);
      text =
        table === null ? '' : [table.columns, ...table.rows].map((r) => r.join('\t')).join('\n');
      break;
    }
    default:
      text = JSON.stringify(result.value, null, 2);
  }
  return { ok: true, text, note: note.join('\n') };
}

/** The Character tab rows `{cp, char, name, gc}` from `unichef inspect`. */
export function parseCharacters(env) {
  const table = env.ok ? tableRows(env) : null;
  if (table === null) return [];
  const at = (name) => table.columns.indexOf(name);
  const [cp, char, name, gc] = ['cp', 'char', 'name', 'gc'].map(at);
  return table.rows.slice(0, MAX_CHARACTERS).map((r) => ({
    cp: String(r[cp]),
    char: String(r[char]),
    name: String(r[name]),
    gc: String(r[gc]),
  }));
}

/** Show control, format and separator characters as their code point, not raw. */
export function visibleChar(row) {
  return /^(C|Z)/.test(row.gc) ? `⟨${row.cp}⟩` : row.char;
}

/** The input as `U+XXXX` code points, separated by spaces. */
export function asCodePoints(text) {
  return Array.from(
    text,
    (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
  ).join(' ');
}

/** The input as `\uXXXX` escapes, with surrogate pairs for astral characters (JSON, JS, Java). */
export function asUnicodeEscapes(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += `\\u${text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return out;
}

/** UTF-8 length of `text`, to enforce MAX_INPUT_BYTES before spawning the CLI. */
export function utf8Length(text) {
  return new TextEncoder().encode(text).length;
}
