# SPDX-License-Identifier: GPL-3.0-or-later
"""Text clean-up, casing and line operations (PRD §3.8, 1.1; semantics in spec/README.md).

Behaviour follows CyberChef v11.5.0 (Apache-2.0) where it is Unicode-correct: casing uses
UniChef's UCD case mappings per code point, letters are General_Category L*, and lines
are separated by LF with a final LF kept, as in the other text operations.
"""

import re

from unichef.core.errors import UniChefError
from unichef.core.registry import (
    JS_SAFE_INTEGER,
    Args,
    Example,
    OpContext,
    bool_arg,
    enum_arg,
    int_arg,
    operation,
    string_arg,
)
from unichef.unicode import case, props

MAX_CASINGS = 16
CHECK_EVERY = 4096
# JavaScript's \s: White_Space plus U+FEFF, without U+0085 (CyberChef's regexes use it).
_JS_SPACE = r"\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
_TAG = re.compile(r"<[^>]+>")
_INDENT = re.compile(r"\n[ \f\t]+")
_FIRST_BLANK = re.compile(rf"^[{_JS_SPACE}]*\n")
_BLANK_RUN = re.compile(rf"(?:\n[{_JS_SPACE}]*){{2,}}")
_LINE_NUMBER = re.compile(rf"(?:^|(?<=\n))[ \t]{{0,5}}[0-9]+[{_JS_SPACE}:|\-,.)\]]")


def _lines(text: str) -> tuple[list[str], str]:
    """Split into lines; the second item is the final LF, if any."""
    if not text:
        return [], ""
    if text.endswith("\n"):
        return text[:-1].split("\n"), "\n"
    return text.split("\n"), ""


# ---------------------------------------------------------------------------
# Casing


@operation(
    "swap-case",
    "Swap case",
    "Text",
    "string",
    "string",
    (),
    examples=(Example("Hello, Wörld", {}, "hELLO, wÖRLD"),),
)
def swap_case(text: str, _args: Args, ctx: OpContext) -> str:
    """Upper-case every character that changes when upper-cased, and lower-case the
    rest, one code point at a time with full case mappings (`ß` becomes `SS`)."""
    out: list[str] = []
    for i, ch in enumerate(text):
        if i % CHECK_EVERY == 0:
            ctx.check()
        up = case.upper(ch)
        out.append(case.lower(ch) if up == ch else up)
    return "".join(out)


@operation(
    "alternating-caps",
    "Alternating caps",
    "Text",
    "string",
    "string",
    (),
    examples=(Example("Hello world", {}, "hElLo WoRlD"),),
)
def alternating_caps(text: str, _args: Args, ctx: OpContext) -> str:
    """Lower-case the first letter, upper-case the next, and so on. Only letters
    (General_Category L*) take part; other characters are copied and do not break the
    alternation."""
    out: list[str] = []
    lower_next = True
    for i, ch in enumerate(text):
        if i % CHECK_EVERY == 0:
            ctx.check()
        if props.gc(ord(ch)).startswith("L"):
            out.append(case.lower(ch) if lower_next else case.upper(ch))
            lower_next = not lower_next
        else:
            out.append(ch)
    return "".join(out)


@operation(
    "get-all-casings",
    "Get all casings",
    "Text",
    "string",
    "string",
    (),
    examples=(Example("ab", {}, "ab\nAb\naB\nAB"),),
)
def get_all_casings(text: str, _args: Args, ctx: OpContext) -> str:
    """Every combination of upper and lower case, one per line. The input is
    lower-cased, then line k upper-cases the code points whose bit is set in k (the
    first code point is bit 0). At most 16 code points."""
    chars = list(case.lower(text))
    if len(chars) > MAX_CASINGS:
        raise UniChefError("E_LIMIT", f"Get all casings takes at most {MAX_CASINGS} code points.")
    uppers = [case.upper(ch) for ch in chars]
    out: list[str] = []
    for k in range(1 << len(chars)):
        if k % CHECK_EVERY == 0:
            ctx.check()
        out.append("".join(uppers[j] if k >> j & 1 else ch for j, ch in enumerate(chars)))
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Clean-up


@operation(
    "remove-null-bytes",
    "Remove null bytes",
    "Text",
    "bytes",
    "bytes",
    (),
    examples=(Example("a\x00b\x00", {}, "ab"),),
)
def remove_null_bytes(data: bytes, _args: Args, _ctx: OpContext) -> bytes:
    """Remove every 0x00 byte."""
    return data.replace(b"\x00", b"")


@operation(
    "remove-ansi-escape-codes",
    "Remove ANSI escape codes",
    "Text",
    "string",
    "string",
    (),
    examples=(Example("\x1b[1;31mred\x1b[0m", {}, "red"),),
)
def remove_ansi_escape_codes(text: str, _args: Args, _ctx: OpContext) -> str:
    """Remove ANSI control sequences (ESC `[`, parameter bytes, intermediate bytes and a
    final byte), such as colour and cursor codes."""
    return _ANSI.sub("", text)


def _remove_all(pattern: re.Pattern[str], text: str, ctx: OpContext) -> str:
    while True:
        ctx.check()
        stripped = pattern.sub("", text)
        if len(stripped) == len(text):
            return stripped
        text = stripped


@operation(
    "strip-html-tags",
    "Strip HTML tags",
    "Text",
    "string",
    "string",
    (bool_arg("remove_indentation", True), bool_arg("remove_line_breaks", True)),
    examples=(Example("<p>Hello <b>world</b></p>", {}, "Hello world"),),
)
def strip_html_tags(text: str, args: Args, ctx: OpContext) -> str:
    """Remove everything from `<` to the next `>`, repeating until none is left. Then
    `remove_indentation` drops spaces and tabs after each line feed, and
    `remove_line_breaks` drops a blank first line and folds runs of blank lines into
    one line feed. The result is text, not safe HTML."""
    text = _remove_all(_TAG, text, ctx)
    if args.flag("remove_indentation"):
        text = _INDENT.sub("\n", text)
    if args.flag("remove_line_breaks"):
        text = _BLANK_RUN.sub("\n", _FIRST_BLANK.sub("", text, count=1))
    return text


# ---------------------------------------------------------------------------
# Lines


@operation(
    "add-line-numbers",
    "Add line numbers",
    "Text",
    "string",
    "string",
    (int_arg("offset", 0, -JS_SAFE_INTEGER, JS_SAFE_INTEGER),),
    examples=(Example("one\ntwo", {}, "1 one\n2 two"),),
)
def add_line_numbers(text: str, args: Args, _ctx: OpContext) -> str:
    """Put the line number and a space before each line, counting from `offset` + 1.
    Numbers are right-aligned to the width of the line count. A final LF is kept."""
    lines, end = _lines(text)
    offset = args.integer("offset")
    width = len(str(len(lines)))
    return "\n".join(f"{n + 1 + offset:>{width}} {line}" for n, line in enumerate(lines)) + end


@operation(
    "remove-line-numbers",
    "Remove line numbers",
    "Text",
    "string",
    "string",
    (),
    examples=(Example("1 one\n2:two", {}, "one\ntwo"),),
)
def remove_line_numbers(text: str, _args: Args, _ctx: OpContext) -> str:
    """At the start of each line, remove up to five spaces or tabs, ASCII digits and one
    following separator: whitespace (including a line feed) or one of `:|-,.)]`."""
    return _LINE_NUMBER.sub("", text)


@operation(
    "pad-lines",
    "Pad lines",
    "Text",
    "string",
    "string",
    (
        enum_arg("position", ("start", "end")),
        int_arg("length", 5, 0, 1_000_000),
        string_arg("character", " "),
    ),
    examples=(Example("a\nb", {"length": 2, "character": "."}, "..a\n..b"),),
)
def pad_lines(text: str, args: Args, _ctx: OpContext) -> str:
    """Add `length` code points to the start or end of each line, made by repeating
    `character` and cutting it to length. A final LF is kept."""
    filler = args.text("character")
    if not filler:
        raise UniChefError("E_ARG_INVALID", "character must not be empty.")
    count = args.integer("length")
    pad = (filler * (count // len(filler) + 1))[:count]
    lines, end = _lines(text)
    if args.text("position") == "start":
        return "\n".join(pad + line for line in lines) + end
    return "\n".join(line + pad for line in lines) + end
