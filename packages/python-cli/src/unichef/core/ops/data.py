# SPDX-License-Identifier: GPL-3.0-or-later
"""Data operations: JSON, CSV, URLs and query strings (PRD §3.8 Beta; spec/README.md)."""

import re
from collections.abc import Callable

from unichef.core.dish import JsonValue, format_float, json_dumps
from unichef.core.errors import UniChefError
from unichef.core.registry import Args, Example, OpContext, bool_arg, enum_arg, operation
from unichef.unicode import utf8

CHECK_EVERY = 4096  # values or records between cancellation checks
_INDENTS = {"2": "  ", "4": "    ", "tab": "\t"}
_DELIMITERS = {"comma": ",", "semicolon": ";", "tab": "\t"}
_LINE_ENDINGS = {"crlf": "\r\n", "lf": "\n"}
_URI = re.compile(r"(?:([^:/?#]+):)?(?://([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?", re.DOTALL)
_SCHEME = re.compile(r"[A-Za-z][A-Za-z0-9+.\-]*")
_ASCII_WS = " \t\n\f\r"
_MAX_PORT = 65535
_PORT_DIGITS = 5
_PERCENT = re.compile(rb"%([0-9A-Fa-f]{2})")


def _ticker(ctx: OpContext) -> Callable[[], None]:
    count = 0

    def tick() -> None:
        nonlocal count
        count += 1
        if count % CHECK_EVERY == 0:
            ctx.check()

    return tick


# ---------------------------------------------------------------------------
# JSON


@operation(
    "json-beautify",
    "JSON Beautify",
    "Data",
    "json",
    "string",
    (enum_arg("indent", tuple(_INDENTS), "2"), bool_arg("sort_keys")),
    examples=(Example('{"b":[1,2],"a":{}}', {}, '{\n  "b": [\n    1,\n    2\n  ],\n  "a": {}\n}'),),
)
def json_beautify(value: JsonValue, args: Args, ctx: OpContext) -> str:
    """Write JSON with one value per line, like `JSON.stringify(v, null, indent)`.
    `sort_keys` orders object keys by code point."""
    indent = _INDENTS[args.text("indent")]
    sort = args.flag("sort_keys")
    tick = _ticker(ctx)
    parts: list[str] = []

    def emit(v: JsonValue, depth: int) -> None:
        tick()
        inner = "\n" + indent * (depth + 1)
        if isinstance(v, list):
            if not v:
                parts.append("[]")
                return
            parts.append("[")
            for i, item in enumerate(v):
                parts.append("," + inner if i else inner)
                emit(item, depth + 1)
            parts.append("\n" + indent * depth + "]")
        elif isinstance(v, dict):
            if not v:
                parts.append("{}")
                return
            parts.append("{")
            keys = sorted(v) if sort else list(v)
            for i, key in enumerate(keys):
                parts.append("," + inner if i else inner)
                parts.append(json_dumps(key) + ": ")
                emit(v[key], depth + 1)
            parts.append("\n" + indent * depth + "}")
        else:
            parts.append(json_dumps(v))

    emit(value, 0)
    return "".join(parts)


@operation(
    "json-minify",
    "JSON Minify",
    "Data",
    "json",
    "string",
    examples=(Example('{\n  "a": [1, 2.50, "x"]\n}', {}, '{"a":[1,2.5,"x"]}'),),
)
def json_minify(value: JsonValue, _args: Args, _ctx: OpContext) -> str:
    """Write JSON with no whitespace, keeping key order."""
    return json_dumps(value)


# ---------------------------------------------------------------------------
# CSV (RFC 4180)


def _cell(v: JsonValue) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return format_float(v)
    if isinstance(v, str):
        return v
    return json_dumps(v)


def _quote(field: str, delimiter: str) -> str:
    if delimiter in field or '"' in field or "\r" in field or "\n" in field:
        return '"' + field.replace('"', '""') + '"'
    return field


def _not_table() -> UniChefError:
    return UniChefError(
        "E_INPUT_TYPE", "The JSON value must be an array of objects or an array of arrays."
    )


@operation(
    "json-to-csv",
    "JSON to CSV",
    "Data",
    "json",
    "string",
    (
        enum_arg("delimiter", tuple(_DELIMITERS), "comma"),
        enum_arg("line_ending", tuple(_LINE_ENDINGS), "crlf"),
    ),
    examples=(
        Example(
            '[{"name":"Zoë","note":"a, b"},{"name":"Ali","age":30}]',
            {"line_ending": "lf"},
            'name,note,age\nZoë,"a, b",\nAli,,30\n',
        ),
    ),
)
def json_to_csv(value: JsonValue, args: Args, ctx: OpContext) -> str:
    """Write an array of objects (with a header row) or an array of arrays as CSV.
    Every record ends with the line ending."""
    delimiter = _DELIMITERS[args.text("delimiter")]
    eol = _LINE_ENDINGS[args.text("line_ending")]
    if not isinstance(value, list):
        raise _not_table()
    tick = _ticker(ctx)
    rows: list[list[str]] = []
    if all(isinstance(item, dict) for item in value):
        columns: dict[str, None] = {}
        for item in value:
            columns.update(dict.fromkeys(item))  # type: ignore[arg-type]
        if value:
            rows.append(list(columns))
        for item in value:
            tick()
            rows.append([_cell(item.get(col)) for col in columns])  # type: ignore[union-attr]
    elif all(isinstance(item, list) for item in value):
        for item in value:
            tick()
            rows.append([_cell(c) for c in item])  # type: ignore[union-attr]
    else:
        raise _not_table()
    return "".join(delimiter.join(_quote(f, delimiter) for f in row) + eol for row in rows)


def _csv_error(record: int, what: str) -> UniChefError:
    return UniChefError("E_DECODE", f"CSV record {record}: {what}")


def _quoted(text: str, i: int, delimiter: str, record: int) -> tuple[str, int]:
    """Read the quoted field whose opening quote is at ``i``; return it and the next index."""
    parts: list[str] = []
    i += 1
    while True:
        j = text.find('"', i)
        if j < 0:
            raise _csv_error(record, "a quoted field is not closed.")
        parts.append(text[i:j])
        if not text.startswith('""', j):
            break
        parts.append('"')
        i = j + 2
    i = j + 1
    if i < len(text) and text[i] not in (delimiter, "\r", "\n"):
        raise _csv_error(record, "text follows a closing quote.")
    return "".join(parts), i


def parse_csv(text: str, delimiter: str, ctx: OpContext) -> list[list[str]]:
    """Split RFC 4180 text into records. CRLF, LF and CR all end a record."""
    if text.startswith("\ufeff"):
        text = text[1:]
    n = len(text)
    if n == 0:
        return []
    stop = re.compile("[" + re.escape(delimiter) + '\r\n"]')
    tick = _ticker(ctx)
    records: list[list[str]] = []
    record: list[str] = []
    i = 0
    while True:
        if i < n and text[i] == '"':
            value, i = _quoted(text, i, delimiter, len(records) + 1)
            record.append(value)
        else:
            m = stop.search(text, i)
            j = n if m is None else m.start()
            if j < n and text[j] == '"':
                raise _csv_error(len(records) + 1, "a quote appears inside an unquoted field.")
            record.append(text[i:j])
            i = j
        if i >= n:
            records.append(record)
            return records
        if text[i] == delimiter:
            i += 1
            continue
        i += 2 if text.startswith("\r\n", i) else 1
        records.append(record)
        record = []
        tick()
        if i >= n:
            return records


@operation(
    "csv-to-json",
    "CSV to JSON",
    "Data",
    "string",
    "json",
    (enum_arg("delimiter", tuple(_DELIMITERS), "comma"), bool_arg("header", default=True)),
    examples=(
        Example(
            'name,note\r\nZoë,"say ""hi"""\r\n',
            {},
            '[{"name":"Zoë","note":"say \\"hi\\""}]',
        ),
    ),
)
def csv_to_json(text: str, args: Args, ctx: OpContext) -> JsonValue:
    """Parse RFC 4180 CSV. With `header`, the first record names the fields of an object
    per record; otherwise each record is an array. Cells stay strings."""
    records = parse_csv(text, _DELIMITERS[args.text("delimiter")], ctx)
    if not args.flag("header"):
        return list(records)  # type: ignore[arg-type]
    if not records:
        return []
    header = records[0]
    seen: set[str] = set()
    for name in header:
        if name in seen:
            ctx.warn("W_DUPLICATE_KEY", f"Duplicate CSV column {json_dumps(name)[:66]}.")
        seen.add(name)
    out: list[JsonValue] = []
    for number, record in enumerate(records[1:], start=2):
        if len(record) != len(header):
            raise _csv_error(
                number,
                f"it has {len(record)} {'field' if len(record) == 1 else 'fields'} "
                f"but the header has {len(header)}.",
            )
        obj: dict[str, JsonValue] = {}
        for name, cell in zip(header, record, strict=True):
            obj.pop(name, None)  # a repeated column takes the last value and position
            obj[name] = cell
        out.append(obj)
    return out


# ---------------------------------------------------------------------------
# URLs (RFC 3986) and query strings (application/x-www-form-urlencoded)


def _url_error(what: str) -> UniChefError:
    return UniChefError("E_DECODE", f"The URL {what}")


def _host_port(hostport: str) -> tuple[str, int | None]:
    if hostport.startswith("["):
        close = hostport.find("]")
        if close < 0:
            raise _url_error("has a [ without a closing ].")
        host, rest = hostport[: close + 1], hostport[close + 1 :]
        if rest and not rest.startswith(":"):
            raise _url_error("has text after the ] of its host.")
        port = rest[1:] if rest else ""
    else:
        host, _, port = hostport.partition(":")
    if not port:
        return host, None
    digits = port.lstrip("0")
    if not port.isascii() or not port.isdigit() or len(digits) > _PORT_DIGITS:
        raise _url_error("port is not a number from 0 to 65535.")
    number = int(port)
    if number > _MAX_PORT:
        raise _url_error("port is not a number from 0 to 65535.")
    return host, number


@operation(
    "parse-url",
    "Parse URL",
    "Data",
    "string",
    "json",
    examples=(
        Example(
            "https://zoë:pw@example.com:8443/a/b?q=1#top",
            {},
            '{"scheme":"https","username":"zoë","password":"pw","host":"example.com",'
            '"port":8443,"path":"/a/b","query":"q=1","fragment":"top"}',
        ),
    ),
)
def parse_url(text: str, _args: Args, _ctx: OpContext) -> JsonValue:
    """Split a URL into its RFC 3986 parts without decoding or normalising them.
    An absent part is null; surrounding ASCII whitespace is ignored."""
    m = _URI.fullmatch(text.strip(_ASCII_WS))
    if m is None:  # pragma: no cover  # every group is optional, so the pattern always matches
        raise _url_error("cannot be split.")
    scheme, authority, path, query, fragment = m.groups()
    if scheme is not None and not _SCHEME.fullmatch(scheme):
        raise _url_error("scheme must start with a letter and use only A-Z, a-z, 0-9, +, - or .")
    username = password = host = None
    port: int | None = None
    if authority is not None:
        userinfo, at, hostport = authority.rpartition("@")
        if at:
            username, colon, pw = userinfo.partition(":")
            password = pw if colon else None
        host, port = _host_port(hostport)
    return {
        "scheme": scheme,
        "username": username,
        "password": password,
        "host": host,
        "port": port,
        "path": path,
        "query": query,
        "fragment": fragment,
    }


def percent_decode(text: str) -> str:
    """Decode %XX escapes as UTF-8 bytes; a malformed escape stays literal."""
    if "%" not in text:
        return text
    raw = _PERCENT.sub(lambda m: bytes.fromhex(m[1].decode("ascii")), utf8.encode(text))
    return utf8.decode(raw)


@operation(
    "parse-query-string",
    "Parse Query String",
    "Data",
    "string",
    "json",
    (enum_arg("output", ("object", "pairs"), "object"), bool_arg("plus_as_space", default=True)),
    examples=(
        Example(
            "?q=caf%C3%A9+au+lait&tag=a&tag=b&x", {}, '{"q":"café au lait","tag":["a","b"],"x":""}'
        ),
    ),
)
def parse_query_string(text: str, args: Args, ctx: OpContext) -> JsonValue:
    """Split `name=value` pairs on `&` and percent-decode them as UTF-8. A leading `?` is
    ignored. In `object` output a repeated name collects its values into an array."""
    plus = args.flag("plus_as_space")
    tick = _ticker(ctx)
    pairs: list[tuple[str, str]] = []
    for piece in text.removeprefix("?").split("&"):
        if not piece:
            continue
        tick()
        name, _, value = piece.partition("=")
        if plus:
            name, value = name.replace("+", " "), value.replace("+", " ")
        pairs.append((percent_decode(name), percent_decode(value)))
    if args.text("output") == "pairs":
        return [[name, value] for name, value in pairs]
    out: dict[str, JsonValue] = {}
    for name, value in pairs:
        held = out.get(name)
        if held is None:
            out[name] = value
        elif isinstance(held, list):
            held.append(value)
        else:
            out[name] = [held, value]
    return out
