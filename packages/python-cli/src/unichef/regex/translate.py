# SPDX-License-Identifier: GPL-3.0-or-later
"""Serialise a parsed portable regex for each host engine (PRD §4.9, §16.3).

Python's ``regex`` gets ``\\UXXXXXXXX`` escapes (it has no ``\\x{…}``, which PRD §16.3
names) and runs with ``regex.V1`` and no other flags.
JavaScript gets ``\\u{…}`` escapes and runs with the ``v`` flag only. Both serialisations
spell out every class and anchor, so neither host's Unicode tables are ever consulted.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

from unichef.regex import profile
from unichef.regex.profile import Alt, Anchor, Backref, Chars, Group, Node, Quant, Seq
from unichef.unicode import data
from unichef.unicode.data import MAX_CODE_POINT

type Target = Literal["python", "js"]

JS_FLAGS = "v"
CACHE_SIZE = 256
_ASCII_END = 0x80
_GROUP_OPEN = {
    "capture": "(", "group": "(?:", "ahead": "(?=", "not-ahead": "(?!",
    "behind": "(?<=", "not-behind": "(?<!",
}  # fmt: skip


@dataclass(slots=True, frozen=True)
class Translation:
    """A pattern in both host dialects, plus its capture-group layout."""

    source: str
    flags: str
    python: str
    js: str
    groups: int
    names: tuple[str, ...]


def _escape(cp: int, target: Target) -> str:
    if cp < _ASCII_END and chr(cp).isalnum():
        return chr(cp)
    return f"\\U{cp:08X}" if target == "python" else f"\\u{{{cp:X}}}"


def _class(ranges: Sequence[tuple[int, int]], target: Target) -> str:
    if not ranges:
        return "(?!)"
    if len(ranges) == 1 and ranges[0][0] == ranges[0][1]:
        return _escape(ranges[0][0], target)
    if tuple(ranges) == ((0, MAX_CODE_POINT),):
        return f"[{_escape(0, target)}-{_escape(MAX_CODE_POINT, target)}]"
    inverse = data.complement(list(ranges))
    negate = len(inverse) < len(ranges)
    body = "".join(
        _escape(a, target) if a == b else f"{_escape(a, target)}-{_escape(b, target)}"
        for a, b in (inverse if negate else ranges)
    )
    return f"[^{body}]" if negate else f"[{body}]"


def _anchor(kind: profile.AnchorKind, target: Target) -> str:
    if kind == "start":
        return "^"
    if kind == "end":
        return "\\Z" if target == "python" else "$"
    if kind in {"line-start", "line-end"}:
        other = _class(data.complement(profile.LINE_TERMINATORS), target)
        return f"(?<!{other})" if kind == "line-start" else f"(?!{other})"
    w = _class(profile.word(), target)
    if kind == "word":
        return f"(?:(?<={w})(?!{w})|(?<!{w})(?={w}))"
    return f"(?:(?<={w})(?={w})|(?<!{w})(?!{w}))"


def _atomic(node: Node, target: Target) -> str:
    text = serialise(node, target)
    return text if isinstance(node, Chars | Group | Backref) else f"(?:{text})"


def serialise(node: Node, target: Target) -> str:  # noqa: PLR0911, PLR0912
    """Serialise one node (and its children) for ``target``."""
    match node:
        case Chars(ranges):
            return _class(ranges, target)
        case Seq(items):
            return "".join(
                f"(?:{serialise(item, target)})"
                if isinstance(item, Alt)
                else serialise(item, target)
                for item in items
            )
        case Alt(branches):
            return "|".join(serialise(branch, target) for branch in branches)
        case Group(kind, body, name):
            head = f"(?<{name}>" if name is not None else _GROUP_OPEN[kind]
            return f"{head}{serialise(body, target)})"
        case Quant(body, low, high, lazy):
            if (low, high) == (0, None):
                count = "*"
            elif (low, high) == (1, None):
                count = "+"
            elif (low, high) == (0, 1):
                count = "?"
            elif high is None:
                count = f"{{{low},}}"
            else:
                count = f"{{{low}}}" if low == high else f"{{{low},{high}}}"
            return f"{_atomic(body, target)}{count}{'?' if lazy else ''}"
        case Backref(ref):
            if target == "python":
                return f"\\g<{ref}>"
            return f"(?:\\k<{ref}>)" if isinstance(ref, str) else f"(?:\\{ref})"
        case Anchor(kind):
            return _anchor(kind, target)


@lru_cache(maxsize=CACHE_SIZE)
def translate(pattern: str, flags: str = "") -> Translation:
    """Parse, check and serialise ``pattern`` for both engines (LRU-cached)."""
    parsed = profile.parse(pattern, flags)
    return Translation(
        source=pattern,
        flags=parsed.flags,
        python=serialise(parsed.root, "python"),
        js=serialise(parsed.root, "js"),
        groups=parsed.groups,
        names=parsed.names,
    )
