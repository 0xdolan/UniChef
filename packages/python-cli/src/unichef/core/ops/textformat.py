# SPDX-License-Identifier: GPL-3.0-or-later
"""Text formats: identifier cases, hexdumps, Snort hex content, string escapes, smart
characters and wrapping (PRD §3.8, 1.1).

Behaviour follows CyberChef v11.5.0 (Apache-2.0) and jsesc 3.1.0 (MIT), with the deviations
listed in spec/README.md: words are split with the pinned UCD rather than lodash, and text
is handled per code point rather than per UTF-16 code unit.
"""

import re
from collections.abc import Callable

from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    Example,
    OpContext,
    bool_arg,
    enum_arg,
    int_arg,
    operation,
)
from unichef.unicode import case, props

CHECK_EVERY = 4096
MAX_WIDTH = 65536

# ---------------------------------------------------------------------------
# Identifier cases

_APOSTROPHES = {0x27: None, 0x2019: None}
# CyberChef's "context aware" mode: identifiers outside double-quoted strings.
_IDENTIFIER = re.compile(r'\\"|"(?:\\"|[^"])*"|([A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?)')


def _kind(cp: int) -> str:
    """`u` upper or title case letter, `l` other letter, `d` number, `m` mark, `` other."""
    gc = props.gc(cp)
    if gc in ("Lu", "Lt"):
        return "u"
    return {"L": "l", "N": "d", "M": "m"}.get(gc[0], "")


def _words(text: str, ctx: OpContext) -> list[str]:
    """Split `text` into words; see "Identifier cases" in spec/README.md."""
    words: list[str] = []
    cur: list[str] = []
    last = 0  # index in `cur` of the last letter or number
    kinds: list[str] = []  # kinds of the letters and numbers in `cur`
    for i, ch in enumerate(text.translate(_APOSTROPHES)):
        if i % CHECK_EVERY == 0:
            ctx.check()
        k = _kind(ord(ch))
        if k == "m":
            if cur:
                cur.append(ch)
            continue
        if not k:
            if cur:
                words.append("".join(cur))
                cur, kinds = [], []
            continue
        if cur:
            prev = kinds[-1]
            if (k == "d") != (prev == "d") or (prev == "l" and k == "u"):
                words.append("".join(cur))
                cur, kinds = [], []
            elif k == "l" and prev == "u" and len(kinds) > 1 and kinds[-2] == "u":
                words.append("".join(cur[:last]))
                cur, kinds = cur[last:], kinds[-1:]
        last = len(cur)
        cur.append(ch)
        kinds.append(k)
    if cur:
        words.append("".join(cur))
    return words


def _apply_case(text: str, args: Args, ctx: OpContext, join: Callable[[list[str]], str]) -> str:
    def convert(s: str) -> str:
        return join(_words(s, ctx))

    if not args.flag("context_aware"):
        return convert(text)
    return _IDENTIFIER.sub(lambda m: convert(m[0]) if m[1] else m[0], text)


_CASE_ARGS = (bool_arg("context_aware"),)


@operation(
    "to-snake-case",
    "To Snake case",
    "Text",
    "string",
    "string",
    _CASE_ARGS,
    examples=(Example("parseHTTPResponse v2", {}, "parse_http_response_v_2"),),
)
def to_snake_case(text: str, args: Args, ctx: OpContext) -> str:
    """Split the text into words and join them in lower case with underscores. Words are
    runs of letters, marks and numbers, split where lower case meets upper case, before the
    last capital of an acronym and between letters and numbers; apostrophes are dropped.
    With `context_aware`, only identifiers outside double-quoted strings change."""
    return _apply_case(text, args, ctx, lambda ws: "_".join(case.lower(w) for w in ws))


@operation(
    "to-kebab-case",
    "To Kebab case",
    "Text",
    "string",
    "string",
    _CASE_ARGS,
    examples=(Example("parseHTTPResponse v2", {}, "parse-http-response-v-2"),),
)
def to_kebab_case(text: str, args: Args, ctx: OpContext) -> str:
    """Like To Snake case, but the words are joined with hyphens."""
    return _apply_case(text, args, ctx, lambda ws: "-".join(case.lower(w) for w in ws))


def _camel(words: list[str]) -> str:
    if not words:
        return ""
    return case.lower(words[0]) + "".join(case.title(w) for w in words[1:])


@operation(
    "to-camel-case",
    "To Camel case",
    "Text",
    "string",
    "string",
    _CASE_ARGS,
    examples=(Example("parseHTTPResponse v2", {}, "parseHttpResponseV2"),),
)
def to_camel_case(text: str, args: Args, ctx: OpContext) -> str:
    """Like To Snake case, but the first word is lower case and every later word is title
    case, with nothing between them."""
    return _apply_case(text, args, ctx, _camel)


# ---------------------------------------------------------------------------
# Hexdump


def _dump_char(b: int, ascii_only: bool) -> str:
    if ascii_only:
        return chr(b) if 0x20 <= b <= 0x7E else "."  # noqa: PLR2004
    return "." if b < 0x20 or 0x7F <= b <= 0x9F or b == 0xAD else chr(b)  # noqa: PLR2004


@operation(
    "to-hexdump",
    "To Hexdump",
    "Encoding",
    "bytes",
    "string",
    (
        int_arg("width", 16, 1, MAX_WIDTH),
        bool_arg("upper"),
        bool_arg("final_length"),
        bool_arg("ascii_only"),
    ),
    examples=(Example("Hi!", {}, "00000000  48 69 21" + " " * 41 + "|Hi!|"),),
)
def to_hexdump(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write `width` bytes per line: the offset, the bytes in hex and the bytes as Latin-1
    text, with controls and the soft hyphen as dots (`ascii_only` keeps only printable
    ASCII). `final_length` adds a last line with the total length."""
    width = args.integer("width")
    upper = args.flag("upper")
    ascii_only = args.flag("ascii_only")
    lines = []
    for i in range(0, len(data), width):
        if (i // width) % 256 == 0:
            ctx.check()
        chunk = data[i : i + width]
        offset = f"{i:08x}"
        digits = " ".join(f"{b:02x}" for b in chunk).ljust(width * 3)
        if upper:
            offset, digits = offset.upper(), digits.upper()
        text = "".join(_dump_char(b, ascii_only) for b in chunk)
        lines.append(f"{offset}  {digits} |{text}|")
    if args.flag("final_length") and data:
        total = f"{len(data):08x}"
        lines.append(total.upper() if upper else total)
    return "\n".join(lines)


_HEXDUMP_LINE = re.compile(
    r"(?:^|(?<=\n))[ \t\n\v\f\r]*(?:[0-9A-F]{4,16}h?:?)?[ \t]+("
    r"(?:[0-9A-F]{2} ){1,8}(?:[ \t]|[0-9A-F]{2}-)(?:[0-9A-F]{2} ){1,8}"
    r"|(?:[0-9A-F]{4} )+(?:[0-9A-F]{2})?"
    r"|(?:[0-9A-F]{2} )*[0-9A-F]{2})",
    re.IGNORECASE,
)
_NON_HEX = re.compile(r"[^0-9A-Fa-f]+")


def _hex_tokens(text: str) -> bytes:
    """CyberChef's fromHex: split on non-hex runs, read pairs, a lone last digit alone."""
    out = bytearray()
    for token in _NON_HEX.split(text):
        out.extend(int(token[j : j + 2], 16) for j in range(0, len(token), 2))
    return bytes(out)


@operation(
    "from-hexdump",
    "From Hexdump",
    "Encoding",
    "string",
    "bytes",
    (),
    examples=(Example("00000000  48 69 21" + " " * 41 + "|Hi!|", {}, "Hi!"),),
)
def from_hexdump(text: str, _args: Args, ctx: OpContext) -> bytes:
    """Read the bytes back from a hexdump in the xxd, hexdump -C, Wireshark or 010 Editor
    style: on each line, an optional offset and then the hex columns. Check the result."""
    out = bytearray()
    for n, m in enumerate(_HEXDUMP_LINE.finditer(text)):
        if n % 256 == 0:
            ctx.check()
        out.extend(_hex_tokens(m[1].replace("-", " ")))
    return bytes(out)


# ---------------------------------------------------------------------------
# Snort hex content


def _content_special(b: int, spaces: bool) -> bool:
    return not (
        (b == 0x20 and not spaces)  # noqa: PLR2004
        or 0x30 <= b <= 0x39  # noqa: PLR2004
        or 0x41 <= b <= 0x5A  # noqa: PLR2004
        or 0x61 <= b <= 0x7A  # noqa: PLR2004
    )


@operation(
    "to-hex-content",
    "To Hex Content",
    "Encoding",
    "bytes",
    "string",
    (
        enum_arg("convert", ("special", "special-and-space", "all")),
        bool_arg("spaces"),
    ),
    examples=(Example("foo=bar", {}, "foo|3d|bar"),),
)
def to_hex_content(data: bytes, args: Args, ctx: OpContext) -> str:
    """Write bytes as Snort content: ASCII letters, digits and spaces stay as they are and
    every other byte goes between pipes as hex. `special-and-space` also converts spaces,
    `all` converts everything, and `spaces` puts a space between hex bytes."""
    ctx.check()
    sep = " " if args.flag("spaces") else ""
    convert = args.text("convert")
    if convert == "all":
        return "|" + sep.join(f"{b:02x}" for b in data) + "|"
    out: list[str] = []
    run: list[str] = []
    for b in data:
        if _content_special(b, convert == "special-and-space"):
            run.append(f"{b:02x}")
            continue
        if run:
            out.append("|" + sep.join(run) + "|")
            run = []
        out.append(chr(b))
    if run:
        out.append("|" + sep.join(run) + "|")
    return "".join(out)


_HEX_CONTENT = re.compile(r"\|([0-9A-Fa-f ]{2,})\|")


@operation(
    "from-hex-content",
    "From Hex Content",
    "Encoding",
    "string",
    "bytes",
    (),
    examples=(Example("foo|3d|bar", {}, "foo=bar"),),
)
def from_hex_content(text: str, _args: Args, ctx: OpContext) -> bytes:
    """Read Snort content: hex between pipes becomes those bytes and the rest is UTF-8."""
    ctx.check()
    out = bytearray()
    pos = 0
    for m in _HEX_CONTENT.finditer(text):
        out.extend(text[pos : m.start()].encode())
        out.extend(_hex_tokens(m[1]))
        pos = m.end()
    out.extend(text[pos:].encode())
    return bytes(out)


# ---------------------------------------------------------------------------
# String escapes

_ESCAPE_SAFE = frozenset(
    [0x20, 0x21, *range(0x23, 0x27), *range(0x28, 0x5C), *range(0x5D, 0x60), *range(0x61, 0x7F)]
)
_SINGLE_ESCAPES = {"\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}
# jsesc escapes these even in minimal mode.
_JS_WHITESPACE = frozenset(
    [0xA0, 0x1680, *range(0x2000, 0x200B), 0x2028, 0x2029, 0x202F, 0x205F, 0x3000]
)
_ASCII_DIGITS = frozenset("0123456789")
_QUOTES = {"single": "'", "double": '"', "backtick": "`"}


@operation(
    "escape-string",
    "Escape String",
    "Encoding",
    "string",
    "string",
    (
        enum_arg("level", ("special", "everything", "minimal")),
        enum_arg("quote", tuple(_QUOTES)),
        bool_arg("json"),
        bool_arg("es6", default=True),
        bool_arg("upper_hex"),
    ),
    examples=(Example("Don't stop\n", {}, "Don\\'t stop\\n"),),
)
def escape_string(text: str, args: Args, ctx: OpContext) -> str:
    """Escape a string for a JavaScript literal the way jsesc does. `special` escapes all
    but printable ASCII, `everything` escapes every character and `minimal` only the quote,
    backslash, control escapes and line or paragraph separators. `json` uses \\u escapes
    and wraps the result in quotes; `es6` writes characters past U+FFFF as \\u{...}."""
    level = args.text("level")
    everything, minimal = level == "everything", level == "minimal"
    quote = _QUOTES[args.text("quote")]
    json = args.flag("json")
    es6 = args.flag("es6")
    fmt = "X" if args.flag("upper_hex") else "x"

    def u4(n: int) -> str:
        return "\\u" + format(n, fmt).rjust(4, "0")

    def one(i: int, ch: str) -> str:  # noqa: PLR0911  # mirrors jsesc's replacer
        cp = ord(ch)
        if cp > 0xFFFF:  # noqa: PLR2004
            if minimal:
                return ch
            if es6:
                return "\\u{" + format(cp, fmt) + "}"
            return u4(0xD800 + ((cp - 0x10000) >> 10)) + u4(0xDC00 + (cp & 0x3FF))
        if not everything and cp in _ESCAPE_SAFE:
            return ch
        if cp == 0 and not json and text[i + 1 : i + 2] not in _ASCII_DIGITS:
            return "\\0"
        if ch in "'\"`":
            return "\\" + ch if ch == quote or everything else ch
        if ch in _SINGLE_ESCAPES:
            return _SINGLE_ESCAPES[ch]
        if minimal and cp not in _JS_WHITESPACE:
            return ch
        digits = format(cp, fmt)
        return u4(cp) if json or len(digits) > 2 else "\\x" + digits.rjust(2, "0")  # noqa: PLR2004

    out: list[str] = []
    for i, ch in enumerate(text):
        if i % CHECK_EVERY == 0:
            ctx.check()
        out.append(one(i, ch))
    result = "".join(out)
    if quote == "`":
        result = result.replace("${", "\\${")
    return quote + result + quote if json else result


_UNESCAPE = re.compile(
    r"\\(u[dD][89abAB][0-9a-fA-F]{2}\\u[dD][c-fC-F][0-9a-fA-F]{2}"
    r"|[abfnrtv'\"]|[0-3][0-7]{2}|[0-7]{1,2}|x[0-9a-fA-F]{2}"
    r"|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]{1,6}\}|\\)"
)
_UNESCAPE_SIMPLE = {
    "\\": "\\",
    "a": "\x07",
    "b": "\b",
    "t": "\t",
    "n": "\n",
    "v": "\v",
    "f": "\f",
    "r": "\r",
    '"': '"',
    "'": "'",
}
_SURROGATE_FIRST, _SURROGATE_LAST, _MAX_CODE_POINT = 0xD800, 0xDFFF, 0x10FFFF


def _unescape_one(m: re.Match[str]) -> str:
    a = m[1]
    if a in _UNESCAPE_SIMPLE:
        return _UNESCAPE_SIMPLE[a]
    if a[0] == "x":
        return chr(int(a[1:], 16))
    if a[0] != "u":
        return chr(int(a, 8))
    if len(a) == 11:  # noqa: PLR2004 - a surrogate pair \uD8xx\uDCxx
        hi, lo = int(a[1:5], 16), int(a[7:], 16)
        return chr(0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00))
    cp = int(a[2:-1], 16) if a[1] == "{" else int(a[1:], 16)
    if cp > _MAX_CODE_POINT or _SURROGATE_FIRST <= cp <= _SURROGATE_LAST:
        raise UniChefError("E_DECODE", f"{m[0]} is not a Unicode scalar value.")
    return chr(cp)


@operation(
    "unescape-string",
    "Unescape String",
    "Encoding",
    "string",
    "string",
    (),
    examples=(Example("Don\\'t stop\\n", {}, "Don't stop\n"),),
)
def unescape_string(text: str, _args: Args, ctx: OpContext) -> str:
    """Replace backslash escapes: \\n \\r \\t \\b \\f \\v \\a, quotes and backslash, octal
    \\nnn, hex \\xnn, \\unnnn (surrogate pairs combine) and \\u{n...}. Other backslashes
    stay as they are."""
    ctx.check()
    return _UNESCAPE.sub(_unescape_one, text)


# ---------------------------------------------------------------------------
# Smart characters and wrapping

_SMART = {
    0x201C: '"',
    0x201D: '"',
    0x201E: '"',
    0x201F: '"',
    0x2033: '"',
    0x2018: "'",
    0x2019: "'",
    0x201A: "'",
    0x201B: "'",
    0x2032: "'",
    0x2010: "-",
    0x2011: "-",
    0x2012: "-",
    0x2013: "-",
    0x2014: "--",
    0x2015: "--",
    0x2026: "...",
    0x00A9: "(c)",
    0x00AE: "(r)",
    0x2122: "(tm)",
    0x2190: "<--",
    0x2192: "-->",
    0x2191: "^",
    0x2193: "v",
    0x2194: "<->",
    0x21D0: "<==",
    0x21D2: "==>",
    0x21D4: "<=>",
    0x00AB: "<<",
    0x00BB: ">>",
    0x2039: "<",
    0x203A: ">",
    0x00D7: "x",
    0x00F7: "/",
    0x00B1: "+/-",
    0x2022: "*",
    0x00B7: ".",
    0x00A0: " ",
    0x2002: " ",
    0x2003: " ",
    0x2009: " ",
    0x200A: " ",
}
_UNMAPPABLE = {"include": None, "remove": "", "replace": "."}


@operation(
    "escape-smart-characters",
    "Escape Smart Characters",
    "Text",
    "string",
    "string",
    (enum_arg("unmappable", tuple(_UNMAPPABLE)),),
    examples=(Example("“Hi” — ok…", {}, '"Hi" -- ok...'),),
)
def escape_smart_characters(text: str, args: Args, ctx: OpContext) -> str:
    """Replace typographic characters (curly quotes, dashes, ellipsis, ©, ®, ™, arrows and
    some spaces) with plain ASCII. Other non-ASCII characters are kept (`include`), removed
    (`remove`) or replaced with a dot (`replace`)."""
    ctx.check()
    other = _UNMAPPABLE[args.text("unmappable")]
    return "".join(
        ch if ord(ch) < 0x80 else _SMART.get(ord(ch), ch if other is None else other)  # noqa: PLR2004
        for ch in text
    )


@operation(
    "wrap",
    "Wrap",
    "Text",
    "string",
    "string",
    (int_arg("width", 64, 1, MAX_WIDTH),),
    examples=(Example("abcdefg", {"width": 3}, "abc\ndef\ng"),),
)
def wrap(text: str, args: Args, ctx: OpContext) -> str:
    """Break each line into lines of at most `width` characters. Existing line breaks,
    blank lines and a CR before a line feed are kept."""
    width = args.integer("width")
    out = []
    for n, line in enumerate(text.split("\n")):
        if n % CHECK_EVERY == 0:
            ctx.check()
        body, cr = (line[:-1], "\r") if line.endswith("\r") else (line, "")
        chunks = [body[i : i + width] for i in range(0, len(body), width)] or [""]
        chunks[-1] += cr
        out.append("\n".join(chunks))
    return "\n".join(out)
