# SPDX-License-Identifier: GPL-3.0-or-later
"""HTML character reference operations (PRD §3.8 Alpha; semantics in spec/README.md).

Named references come from the pinned WHATWG list compiled by scripts/html/build.py.
Decoding follows the HTML tokenizer's character-reference state for text content.
"""

import gzip
import json
import re
from functools import cache
from importlib.resources import files

from unichef.core.dish import MAX_CODE_POINT
from unichef.core.errors import UniChefError
from unichef.core.ops.encoding import CHECK_EVERY, W1252_DECODE
from unichef.core.registry import Args, Example, OpContext, bool_arg, enum_arg, operation
from unichef.unicode import utf8

_SPECIAL = frozenset("&<>\"'")
_ASCII_END = 0x80
_W1252_RANGE = range(0x80, 0xA0)
_SURROGATES = range(0xD800, 0xE000)
_MAX_DIGITS = 7  # 0x10FFFF has 7 hex digits; more significant digits are out of range
_NUMERIC = re.compile(r"#(?:([xX])([0-9a-fA-F]+)|([0-9]+))(;?)")
_UNKNOWN_NAMED = re.compile(r"[0-9A-Za-z]+;")


@cache
def entities() -> dict[str, str]:
    """Reference name (without ``&``) to replacement text, legacy names included."""
    raw = json.loads(
        gzip.decompress((files("unichef._data") / "html-entities.json.gz").read_bytes())
    )
    return {name: "".join(map(chr, cps)) for name, cps in raw["entities"].items()}


@cache
def _longest_name() -> int:
    return max(map(len, entities()))


@cache
def _names() -> dict[str, str]:
    """Character to its preferred name: shortest, then greatest in code-point order."""
    best: dict[str, str] = {}
    for name, text in entities().items():
        if len(text) != 1 or not name.endswith(";"):
            continue
        held = best.get(text)
        if held is None or (len(name), held) < (len(held), name):
            best[text] = name
    return best


def _bad(what: str) -> UniChefError:
    return UniChefError("E_DECODE", what)


def _numeric(value: int, ref: str, strict: bool) -> str:
    if value == 0 or value > MAX_CODE_POINT or value in _SURROGATES:
        if strict:
            raise _bad(f"&{ref} is not a valid character reference.")
        return utf8.REPLACEMENT
    return W1252_DECODE[value] if value in _W1252_RANGE else chr(value)


def _reference(text: str, i: int, strict: bool) -> tuple[str, int] | None:
    """Decode the reference whose ``&`` is at ``i``; None leaves the ``&`` literal."""
    start = i + 1
    numeric = _NUMERIC.match(text, start)
    if numeric:
        hex_mark, hex_digits, dec_digits, semicolon = numeric.groups()
        ref = text[start : numeric.end()]
        if strict and not semicolon:
            raise _bad(f"&{ref} is missing its semicolon.")
        digits = (hex_digits or dec_digits).lstrip("0")
        too_long = len(digits) > _MAX_DIGITS  # also keeps int() away from huge strings
        value = MAX_CODE_POINT + 1 if too_long else int(digits or "0", 16 if hex_mark else 10)
        return _numeric(value, ref, strict), numeric.end()
    for length in range(min(_longest_name(), len(text) - start), 0, -1):
        name = text[start : start + length]
        found = entities().get(name)
        if found is not None:
            if strict and not name.endswith(";"):
                raise _bad(f"&{name} is missing its semicolon.")
            return found, start + length
    if strict and (unknown := _UNKNOWN_NAMED.match(text, start)):
        raise _bad(f"&{unknown.group()} is not a known character reference.")
    return None


@operation(
    "html-entity-decode",
    "HTML Entity Decode",
    "Encoding",
    "string",
    "string",
    (bool_arg("strict"),),
    examples=(Example("&lt;p&gt;caf&eacute; &#x1F44B;&lt;/p&gt;", {}, "<p>café 👋</p>"),),
)
def html_entity_decode(text: str, args: Args, ctx: OpContext) -> str:
    """Decode named and numeric character references as HTML does in text content: the
    longest known name wins, legacy names may omit the semicolon, numeric references may
    omit it, 0x80-0x9F map through windows-1252, and 0, surrogates and values above
    10FFFF become U+FFFD. An ``&`` that starts no reference stays as it is. `strict`
    fails on a missing semicolon, an unknown name or an invalid code point instead."""
    strict = args.flag("strict")
    out: list[str] = []
    done = 0
    i = text.find("&")
    checked = 0
    while i != -1:
        if i - checked >= CHECK_EVERY:
            ctx.check()
            checked = i
        decoded = _reference(text, i, strict)
        if decoded is None:
            i = text.find("&", i + 1)
            continue
        out.extend((text[done:i], decoded[0]))
        done = decoded[1]
        i = text.find("&", done)
    out.append(text[done:])
    return "".join(out)


@operation(
    "html-entity-encode",
    "HTML Entity Encode",
    "Encoding",
    "string",
    "string",
    (
        enum_arg("scope", ("special", "non-ascii", "all")),
        enum_arg("format", ("named", "decimal", "hex")),
    ),
    examples=(Example("<p>café</p>", {}, "&lt;p&gt;café&lt;/p&gt;"),),
)
def html_entity_encode(text: str, args: Args, ctx: OpContext) -> str:
    """Replace characters with references. `scope` is the five HTML-special characters
    ``& < > " '``, those plus every non-ASCII character, or all characters. `named` uses
    the shortest name ending in ``;`` (hex where there is none); astral characters get
    one reference each."""
    ctx.check()
    scope = args.text("scope")
    fmt = args.text("format")
    names = _names() if fmt == "named" else {}
    out: list[str] = []
    for ch in text:
        cp = ord(ch)
        if scope == "all" or ch in _SPECIAL or (scope == "non-ascii" and cp >= _ASCII_END):
            name = names.get(ch)
            if name is not None:
                out.append(f"&{name}")
            elif fmt == "decimal":
                out.append(f"&#{cp};")
            else:
                out.append(f"&#x{cp:X};")
        else:
            out.append(ch)
    return "".join(out)
