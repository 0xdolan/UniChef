// SPDX-License-Identifier: GPL-3.0-or-later
/** Data ops (PRD §3.8 Beta): JSON, CSV, URLs and query strings. Semantics in spec/README.md. */

import { formatFloat, jsonDumps } from '../dish/json.js';
import type { JsonObject, JsonValue } from '../dish/types.js';
import { decode as utf8Decode, encode as utf8Encode } from '../dish/utf8.js';
import { UniChefError } from '../errors.js';
import { compareCodePoints } from './text.js';
import { boolArg, defineOp, enumArg, type OpContext, type Operation } from './types.js';

const CHECK_EVERY = 4096; // values or records between cancellation checks
const INDENTS: Readonly<Record<string, string>> = { '2': '  ', '4': '    ', tab: '\t' };
const DELIMITERS: Readonly<Record<string, string>> = { comma: ',', semicolon: ';', tab: '\t' };
const LINE_ENDINGS: Readonly<Record<string, string>> = { crlf: '\r\n', lf: '\n' };
const URI = /^(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#([\s\S]*))?$/;
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const EDGE_WS = /^[ \t\n\f\r]+|[ \t\n\f\r]+$/g;
const MAX_PORT = 65535;
const PORT_DIGITS = 5;
const PERCENT = 0x25;

function ticker(ctx: OpContext): () => void {
  let count = 0;
  return () => {
    count++;
    if (count % CHECK_EVERY === 0) {
      ctx.check();
    }
  };
}

const lookup = (table: Readonly<Record<string, string>>, key: string): string => table[key] ?? '';

// ---------------------------------------------------------------------------
// JSON

export const jsonBeautify = defineOp({
  id: 'json-beautify',
  name: 'JSON Beautify',
  category: 'Data',
  description:
    'Write JSON with one value per line, like `JSON.stringify(v, null, indent)`. ' +
    '`sort_keys` orders object keys by code point.',
  inputType: 'json',
  outputType: 'string',
  args: [enumArg('indent', Object.keys(INDENTS), '2'), boolArg('sort_keys')],
  examples: [
    {
      input: '{"b":[1,2],"a":{}}',
      args: {},
      output: '{\n  "b": [\n    1,\n    2\n  ],\n  "a": {}\n}',
    },
  ],
  run(value, args, ctx) {
    const indent = lookup(INDENTS, args.text('indent'));
    const sort = args.flag('sort_keys');
    const tick = ticker(ctx);
    const parts: string[] = [];
    const emit = (v: JsonValue, depth: number): void => {
      tick();
      const inner = '\n' + indent.repeat(depth + 1);
      if (Array.isArray(v)) {
        if (v.length === 0) {
          parts.push('[]');
          return;
        }
        parts.push('[');
        v.forEach((item, i) => {
          parts.push(i > 0 ? ',' + inner : inner);
          emit(item, depth + 1);
        });
        parts.push('\n' + indent.repeat(depth) + ']');
      } else if (v instanceof Map) {
        if (v.size === 0) {
          parts.push('{}');
          return;
        }
        parts.push('{');
        const keys = [...v.keys()];
        if (sort) {
          keys.sort(compareCodePoints);
        }
        keys.forEach((key, i) => {
          parts.push(i > 0 ? ',' + inner : inner, jsonDumps(key) + ': ');
          emit(v.get(key) ?? null, depth + 1);
        });
        parts.push('\n' + indent.repeat(depth) + '}');
      } else {
        parts.push(jsonDumps(v));
      }
    };
    emit(value, 0);
    return parts.join('');
  },
});

export const jsonMinify = defineOp({
  id: 'json-minify',
  name: 'JSON Minify',
  category: 'Data',
  description: 'Write JSON with no whitespace, keeping key order.',
  inputType: 'json',
  outputType: 'string',
  examples: [{ input: '{\n  "a": [1, 2.50, "x"]\n}', args: {}, output: '{"a":[1,2.5,"x"]}' }],
  run: (value) => jsonDumps(value),
});

// ---------------------------------------------------------------------------
// CSV (RFC 4180)

function cell(v: JsonValue | undefined): string {
  if (v === undefined || v === null) {
    return '';
  }
  if (typeof v === 'boolean') {
    return v ? 'true' : 'false';
  }
  if (typeof v === 'bigint') {
    return v.toString();
  }
  if (typeof v === 'number') {
    return formatFloat(v);
  }
  if (typeof v === 'string') {
    return v;
  }
  return jsonDumps(v);
}

function quote(field: string, delimiter: string): string {
  if (field.includes(delimiter) || /["\r\n]/.test(field)) {
    return '"' + field.replaceAll('"', '""') + '"';
  }
  return field;
}

const notTable = (): UniChefError =>
  new UniChefError(
    'E_INPUT_TYPE',
    'The JSON value must be an array of objects or an array of arrays.',
  );

export const jsonToCsv = defineOp({
  id: 'json-to-csv',
  name: 'JSON to CSV',
  category: 'Data',
  description:
    'Write an array of objects (with a header row) or an array of arrays as CSV. ' +
    'Every record ends with the line ending.',
  inputType: 'json',
  outputType: 'string',
  args: [
    enumArg('delimiter', Object.keys(DELIMITERS), 'comma'),
    enumArg('line_ending', Object.keys(LINE_ENDINGS), 'crlf'),
  ],
  examples: [
    {
      input: '[{"name":"Zoë","note":"a, b"},{"name":"Ali","age":30}]',
      args: { line_ending: 'lf' },
      output: 'name,note,age\nZoë,"a, b",\nAli,,30\n',
    },
  ],
  run(value, args, ctx) {
    const delimiter = lookup(DELIMITERS, args.text('delimiter'));
    const eol = lookup(LINE_ENDINGS, args.text('line_ending'));
    if (!Array.isArray(value)) {
      throw notTable();
    }
    const tick = ticker(ctx);
    const rows: string[][] = [];
    if (value.every((item) => item instanceof Map)) {
      const objects = value;
      const columns = new Set<string>();
      for (const item of objects) {
        for (const key of item.keys()) {
          columns.add(key);
        }
      }
      if (objects.length > 0) {
        rows.push([...columns]);
      }
      for (const item of objects) {
        tick();
        rows.push(Array.from(columns, (col) => cell(item.get(col))));
      }
    } else if (value.every((item) => Array.isArray(item))) {
      for (const item of value as JsonValue[][]) {
        tick();
        rows.push(item.map(cell));
      }
    } else {
      throw notTable();
    }
    return rows.map((row) => row.map((f) => quote(f, delimiter)).join(delimiter) + eol).join('');
  },
});

const csvError = (record: number, what: string): UniChefError =>
  new UniChefError('E_DECODE', `CSV record ${String(record)}: ${what}`);

/** Read the quoted field whose opening quote is at `start`; return it and the next index. */
function quoted(text: string, start: number, delimiter: string, record: number): [string, number] {
  const parts: string[] = [];
  let i = start + 1;
  let j: number;
  for (;;) {
    j = text.indexOf('"', i);
    if (j < 0) {
      throw csvError(record, 'a quoted field is not closed.');
    }
    parts.push(text.slice(i, j));
    if (!text.startsWith('""', j)) {
      break;
    }
    parts.push('"');
    i = j + 2;
  }
  i = j + 1;
  if (i < text.length && ![delimiter, '\r', '\n'].includes(text.charAt(i))) {
    throw csvError(record, 'text follows a closing quote.');
  }
  return [parts.join(''), i];
}

/** Split RFC 4180 text into records. CRLF, LF and CR all end a record. */
export function parseCsv(input: string, delimiter: string, ctx: OpContext): string[][] {
  const text = input.startsWith('\ufeff') ? input.slice(1) : input;
  const n = text.length;
  if (n === 0) {
    return [];
  }
  const stop = new RegExp(`[${delimiter === '\t' ? '\\t' : delimiter}\\r\\n"]`, 'g');
  const tick = ticker(ctx);
  const records: string[][] = [];
  let record: string[] = [];
  let i = 0;
  for (;;) {
    if (i < n && text.charAt(i) === '"') {
      const [value, next] = quoted(text, i, delimiter, records.length + 1);
      record.push(value);
      i = next;
    } else {
      stop.lastIndex = i;
      const m = stop.exec(text);
      const j = m === null ? n : m.index;
      if (j < n && text.charAt(j) === '"') {
        throw csvError(records.length + 1, 'a quote appears inside an unquoted field.');
      }
      record.push(text.slice(i, j));
      i = j;
    }
    if (i >= n) {
      records.push(record);
      return records;
    }
    if (text.charAt(i) === delimiter) {
      i++;
      continue;
    }
    i += text.startsWith('\r\n', i) ? 2 : 1;
    records.push(record);
    record = [];
    tick();
    if (i >= n) {
      return records;
    }
  }
}

export const csvToJson = defineOp({
  id: 'csv-to-json',
  name: 'CSV to JSON',
  category: 'Data',
  description:
    'Parse RFC 4180 CSV. With `header`, the first record names the fields of an object ' +
    'per record; otherwise each record is an array. Cells stay strings.',
  inputType: 'string',
  outputType: 'json',
  args: [enumArg('delimiter', Object.keys(DELIMITERS), 'comma'), boolArg('header', true)],
  examples: [
    {
      input: 'name,note\r\nZoë,"say ""hi"""\r\n',
      args: {},
      output: '[{"name":"Zoë","note":"say \\"hi\\""}]',
    },
  ],
  run(text, args, ctx) {
    const records = parseCsv(text, lookup(DELIMITERS, args.text('delimiter')), ctx);
    if (!args.flag('header')) {
      return records;
    }
    const [header, ...body] = records;
    if (header === undefined) {
      return [];
    }
    const seen = new Set<string>();
    for (const name of header) {
      if (seen.has(name)) {
        ctx.warn('W_DUPLICATE_KEY', `Duplicate CSV column ${jsonDumps(name).slice(0, 66)}.`);
      }
      seen.add(name);
    }
    return body.map((record, k) => {
      if (record.length !== header.length) {
        const fields = record.length === 1 ? 'field' : 'fields';
        throw csvError(
          k + 2,
          `it has ${String(record.length)} ${fields} but the header has ${String(header.length)}.`,
        );
      }
      const obj: JsonObject = new Map();
      header.forEach((name, c) => {
        obj.delete(name); // a repeated column takes the last value and position
        obj.set(name, record[c] ?? '');
      });
      return obj;
    });
  },
});

// ---------------------------------------------------------------------------
// URLs (RFC 3986) and query strings (application/x-www-form-urlencoded)

const urlError = (what: string): UniChefError => new UniChefError('E_DECODE', `The URL ${what}`);
const badPort = (): UniChefError => urlError('port is not a number from 0 to 65535.');

function hostPort(hostport: string): [string, number | null] {
  let host: string;
  let port: string;
  if (hostport.startsWith('[')) {
    const close = hostport.indexOf(']');
    if (close < 0) {
      throw urlError('has a [ without a closing ].');
    }
    host = hostport.slice(0, close + 1);
    const rest = hostport.slice(close + 1);
    if (rest && !rest.startsWith(':')) {
      throw urlError('has text after the ] of its host.');
    }
    port = rest.slice(1);
  } else {
    const colon = hostport.indexOf(':');
    host = colon < 0 ? hostport : hostport.slice(0, colon);
    port = colon < 0 ? '' : hostport.slice(colon + 1);
  }
  if (!port) {
    return [host, null];
  }
  if (!/^[0-9]+$/.test(port) || port.replace(/^0+/, '').length > PORT_DIGITS) {
    throw badPort();
  }
  const number = Number(port);
  if (number > MAX_PORT) {
    throw badPort();
  }
  return [host, number];
}

export const parseUrl = defineOp({
  id: 'parse-url',
  name: 'Parse URL',
  category: 'Data',
  description:
    'Split a URL into its RFC 3986 parts without decoding or normalising them. ' +
    'An absent part is null; surrounding ASCII whitespace is ignored.',
  inputType: 'string',
  outputType: 'json',
  examples: [
    {
      input: 'https://zoë:pw@example.com:8443/a/b?q=1#top',
      args: {},
      output:
        '{"scheme":"https","username":"zoë","password":"pw","host":"example.com",' +
        '"port":8443,"path":"/a/b","query":"q=1","fragment":"top"}',
    },
  ],
  run(text) {
    const m = URI.exec(text.replace(EDGE_WS, ''));
    if (m === null) {
      throw urlError('cannot be split.'); // every group is optional, so this cannot happen
    }
    const [, scheme, authority, path = '', query, fragment] = m;
    if (scheme !== undefined && !SCHEME.test(scheme)) {
      throw urlError('scheme must start with a letter and use only A-Z, a-z, 0-9, +, - or .');
    }
    let username: string | null = null;
    let password: string | null = null;
    let host: string | null = null;
    let port: number | null = null;
    if (authority !== undefined) {
      const at = authority.lastIndexOf('@');
      if (at >= 0) {
        const userinfo = authority.slice(0, at);
        const colon = userinfo.indexOf(':');
        username = colon < 0 ? userinfo : userinfo.slice(0, colon);
        password = colon < 0 ? null : userinfo.slice(colon + 1);
      }
      [host, port] = hostPort(authority.slice(at + 1));
    }
    return new Map<string, JsonValue>([
      ['scheme', scheme ?? null],
      ['username', username],
      ['password', password],
      ['host', host],
      ['port', port],
      ['path', path],
      ['query', query ?? null],
      ['fragment', fragment ?? null],
    ]);
  },
});

const isHex = (b: number | undefined): boolean =>
  b !== undefined &&
  ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66));

/** Decode %XX escapes as UTF-8 bytes; a malformed escape stays literal. */
export function percentDecode(text: string): string {
  if (!text.includes('%')) {
    return text;
  }
  const raw = utf8Encode(text);
  const out = new Uint8Array(raw.length);
  let k = 0;
  for (let i = 0; i < raw.length;) {
    const b = raw[i] ?? 0;
    if (b === PERCENT && isHex(raw[i + 1]) && isHex(raw[i + 2])) {
      out[k++] = parseInt(String.fromCharCode(raw[i + 1] ?? 0, raw[i + 2] ?? 0), 16);
      i += 3;
    } else {
      out[k++] = b;
      i++;
    }
  }
  return utf8Decode(out.subarray(0, k));
}

export const parseQueryString = defineOp({
  id: 'parse-query-string',
  name: 'Parse Query String',
  category: 'Data',
  description:
    'Split `name=value` pairs on `&` and percent-decode them as UTF-8. A leading `?` is ' +
    'ignored. In `object` output a repeated name collects its values into an array.',
  inputType: 'string',
  outputType: 'json',
  args: [enumArg('output', ['object', 'pairs'], 'object'), boolArg('plus_as_space', true)],
  examples: [
    {
      input: '?q=caf%C3%A9+au+lait&tag=a&tag=b&x',
      args: {},
      output: '{"q":"café au lait","tag":["a","b"],"x":""}',
    },
  ],
  run(text, args, ctx) {
    const plus = args.flag('plus_as_space');
    const tick = ticker(ctx);
    const pairs: [string, string][] = [];
    for (const piece of (text.startsWith('?') ? text.slice(1) : text).split('&')) {
      if (!piece) {
        continue;
      }
      tick();
      const eq = piece.indexOf('=');
      let name = eq < 0 ? piece : piece.slice(0, eq);
      let value = eq < 0 ? '' : piece.slice(eq + 1);
      if (plus) {
        name = name.replaceAll('+', ' ');
        value = value.replaceAll('+', ' ');
      }
      pairs.push([percentDecode(name), percentDecode(value)]);
    }
    if (args.text('output') === 'pairs') {
      return pairs.map(([name, value]) => [name, value]);
    }
    const out: JsonObject = new Map();
    for (const [name, value] of pairs) {
      const held = out.get(name);
      if (held === undefined) {
        out.set(name, value);
      } else if (Array.isArray(held)) {
        held.push(value);
      } else {
        out.set(name, [held, value]);
      }
    }
    return out;
  },
});

export const DATA_OPS: readonly Operation[] = [
  jsonBeautify,
  jsonMinify,
  jsonToCsv,
  csvToJson,
  parseUrl,
  parseQueryString,
];
