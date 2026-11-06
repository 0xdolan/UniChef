# SPDX-License-Identifier: GPL-3.0-or-later
"""Text operations (PRD §3.8 Alpha; semantics in spec/README.md).

Lines are separated by LF only. A final LF ends the last line rather than starting an
empty one, and line operations keep it. Strings compare by code point, never by the
host's collation. Whitespace is the Unicode White_Space property.
"""

import re
from collections.abc import Callable
from typing import Any

from unichef.core.errors import UniChefError
from unichef.core.registry import (
    JS_SAFE_INTEGER,
    Args,
    OpContext,
    bool_arg,
    enum_arg,
    int_arg,
    operation,
    regex_arg,
    string_arg,
)
from unichef.regex import run
from unichef.unicode import case, props, segment, utf8

MAX_GROUP = 99
_NUMBER = re.compile(r"[ \t]*([+-]?[0-9]+(?:\.[0-9]+)?)")


def _lines(text: str) -> tuple[list[str], str]:
    """Split into lines; the second item is the final LF, if any."""
    if not text:
        return [], ""
    if text.endswith("\n"):
        return text[:-1].split("\n"), "\n"
    return text.split("\n"), ""


def _units(text: str, unit: str, ctx: OpContext) -> list[str]:
    if unit == "graphemes":
        return segment.graphemes(text, ctx.check)
    return list(text)


def _bad(message: str) -> UniChefError:
    return UniChefError("E_ARG_INVALID", message)


# ---------------------------------------------------------------------------
# Regex operations


@operation(
    "find-replace",
    "Find / replace",
    "Text",
    "string",
    "string",
    (
        regex_arg("pattern"),
        string_arg("flags"),
        string_arg("replacement"),
        bool_arg("literal"),
        bool_arg("global", True),
    ),
)
def find_replace(text: str, args: Args, ctx: OpContext) -> str:
    """Replace matches of `pattern` with `replacement`. As a regex, the replacement uses
    JavaScript syntax: `$$`, `$&`, `$1`-`$99` and `$<name>`; empty matches are replaced
    too. With `literal`, both are plain text and the pattern must not be empty."""
    pattern = args.text("pattern")
    replacement = args.text("replacement")
    if args.flag("literal"):
        if not pattern:
            raise _bad("A literal pattern must not be empty.")
        return text.replace(pattern, replacement, -1 if args.flag("global") else 1)
    compiled = run.compile_regex(pattern, args.text("flags"))
    timeout = ctx.limits.regex_timeout_ms
    if args.flag("global"):
        matches = list(run.finditer(compiled, text, timeout, ctx.check))
    else:
        first = run.search(compiled, text, timeout)
        matches = [] if first is None else [first]
    out: list[str] = []
    done = 0
    for match in matches:
        out.extend((text[done : match.start], run.expand(replacement, match, text, compiled)))
        done = match.end
    out.append(text[done:])
    return "".join(out)


@operation(
    "regex-extract",
    "Regex extract",
    "Text",
    "string",
    "string",
    (
        regex_arg("pattern"),
        string_arg("flags"),
        int_arg("group", 0, 0, MAX_GROUP),
        string_arg("separator", "\n"),
    ),
)
def regex_extract(text: str, args: Args, ctx: OpContext) -> str:
    """List every match of `pattern` (or its capture group `group`), joined by
    `separator`. Empty matches count; a group that did not participate gives ""."""
    compiled = run.compile_regex(args.text("pattern"), args.text("flags"))
    group = args.integer("group")
    if group > compiled.groups:
        raise _bad(
            f"The pattern has {compiled.groups} capture group(s); there is no group {group}."
        )
    matches = run.finditer(compiled, text, ctx.limits.regex_timeout_ms, ctx.check)
    return args.text("separator").join(m.group(text, group) or "" for m in matches)


# ---------------------------------------------------------------------------
# Splitting and joining


@operation(
    "split",
    "Split",
    "Text",
    "string",
    "string",
    (string_arg("delimiter", ","), string_arg("join", "\n")),
)
def split(text: str, args: Args, _ctx: OpContext) -> str:
    """Split on the literal `delimiter` and join the parts with `join`."""
    delimiter = args.text("delimiter")
    if not delimiter:
        raise _bad("The delimiter must not be empty.")
    return args.text("join").join(text.split(delimiter))


@operation("join", "Join lines", "Text", "string", "string", (string_arg("delimiter", ","),))
def join(text: str, args: Args, _ctx: OpContext) -> str:
    """Join the lines with `delimiter`. A final LF is dropped."""
    lines, _ = _lines(text)
    return args.text("delimiter").join(lines)


@operation(
    "reverse",
    "Reverse",
    "Text",
    "bytes",
    "bytes",
    (enum_arg("unit", ("graphemes", "code-points", "bytes")),),
)
def reverse(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Reverse the order of graphemes (default), code points or bytes. The first two
    decode UTF-8 first, replacing ill-formed sequences with U+FFFD."""
    unit = args.text("unit")
    if unit == "bytes":
        return data[::-1]
    parts = _units(utf8.decode(data, ctx.check), unit, ctx)
    return utf8.encode("".join(reversed(parts)))


# ---------------------------------------------------------------------------
# Line operations


def _number_key(line: str) -> tuple[int, float]:
    found = _NUMBER.match(line)
    return (0, float(found.group(1))) if found else (1, 0.0)


_SORT_KEYS: dict[str, Callable[[str], Any]] = {
    "code-point": lambda line: line,
    "case-insensitive": case.fold,
    "numeric": _number_key,
    "length": len,
}


@operation(
    "sort-lines",
    "Sort lines",
    "Text",
    "string",
    "string",
    (
        enum_arg("key", tuple(_SORT_KEYS)),
        enum_arg("order", ("ascending", "descending")),
    ),
)
def sort_lines(text: str, args: Args, _ctx: OpContext) -> str:
    """Stable sort of the lines. `code-point` compares code points; `case-insensitive`
    compares full case folds; `numeric` compares a leading decimal number, with lines
    that have none after the rest; `length` counts code points. `descending` reverses
    the order of the keys, keeping equal lines in input order."""
    lines, end = _lines(text)
    key = _SORT_KEYS[args.text("key")]
    ordered = sorted(lines, key=key, reverse=args.text("order") == "descending")
    return "\n".join(ordered) + end


@operation(
    "unique-lines",
    "Unique lines",
    "Text",
    "string",
    "string",
    (bool_arg("ignore_case"), bool_arg("count")),
)
def unique_lines(text: str, args: Args, _ctx: OpContext) -> str:
    """Keep the first of each set of equal lines, in input order. `ignore_case` compares
    full case folds; `count` prefixes each line with its number of copies and a tab."""
    lines, end = _lines(text)
    seen: dict[str, list[str | int]] = {}
    for line in lines:
        key = case.fold(line) if args.flag("ignore_case") else line
        entry = seen.setdefault(key, [line, 0])
        entry[1] = int(entry[1]) + 1
    if args.flag("count"):
        return "\n".join(f"{n}\t{line}" for line, n in seen.values()) + end
    return "\n".join(str(line) for line, _ in seen.values()) + end


def _take(text: str, args: Args, ctx: OpContext, *, last: bool) -> str:
    count = args.integer("count")
    unit = args.text("unit")
    if unit == "lines":
        lines, end = _lines(text)
        if count >= len(lines):
            return text
        kept = lines[len(lines) - count :] if last else lines[:count]
        return "\n".join(kept) + end if kept else ""
    parts = _units(text, unit, ctx)
    return "".join(parts[len(parts) - count :] if last else parts[:count]) if count else ""


_TAKE_ARGS = (
    int_arg("count", 10, 0, JS_SAFE_INTEGER),
    enum_arg("unit", ("lines", "graphemes", "code-points")),
)


@operation("head", "Head", "Text", "string", "string", _TAKE_ARGS)
def head(text: str, args: Args, ctx: OpContext) -> str:
    """The first `count` lines (keeping a final LF), graphemes or code points."""
    return _take(text, args, ctx, last=False)


@operation("tail", "Tail", "Text", "string", "string", _TAKE_ARGS)
def tail(text: str, args: Args, ctx: OpContext) -> str:
    """The last `count` lines (keeping a final LF), graphemes or code points."""
    return _take(text, args, ctx, last=True)


def _strip(text: str, side: str) -> str:
    start, end = 0, len(text)
    if side in {"both", "start"}:
        while start < end and props.has("White_Space", ord(text[start])):
            start += 1
    if side in {"both", "end"}:
        while end > start and props.has("White_Space", ord(text[end - 1])):
            end -= 1
    return text[start:end]


@operation(
    "trim",
    "Trim",
    "Text",
    "string",
    "string",
    (enum_arg("side", ("both", "start", "end")), bool_arg("lines")),
)
def trim(text: str, args: Args, _ctx: OpContext) -> str:
    """Remove White_Space characters from the start, end or both ends of the text, or
    of every line with `lines` (a final LF is kept)."""
    side = args.text("side")
    if not args.flag("lines"):
        return _strip(text, side)
    lines, end = _lines(text)
    return "\n".join(_strip(line, side) for line in lines) + end
