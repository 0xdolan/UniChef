# SPDX-License-Identifier: GPL-3.0-or-later
"""Run portable regexes on the ``regex`` module (PRD §4.9).

Offsets are code points (Python string indices). Iteration follows JavaScript's global
matching: after an empty match the search resumes one code point later, so both hosts
report the same matches. ``TimeoutError`` from ``regex`` becomes ``E_REGEX_TIMEOUT``.
"""

import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import regex

from unichef.core.errors import UniChefError
from unichef.regex.translate import CACHE_SIZE, Translation, translate

type Span = tuple[int, int]
_MS = 1000.0
_MAX_TWO_DIGIT_GROUP = 99
_DIGIT_BASE = 10


@dataclass(slots=True, frozen=True)
class Match:
    """One match: ``spans[0]`` is the whole match, ``spans[n]`` group ``n`` (or None)."""

    spans: tuple[Span | None, ...]

    @property
    def start(self) -> int:
        return self.span[0]

    @property
    def end(self) -> int:
        return self.span[1]

    @property
    def span(self) -> Span:
        whole = self.spans[0]
        assert whole is not None
        return whole

    def group(self, text: str, index: int = 0) -> str | None:
        span = self.spans[index]
        return None if span is None else text[span[0] : span[1]]


@dataclass(slots=True, frozen=True)
class Compiled:
    translation: Translation
    pattern: Any  # regex.Pattern; the module ships without type information

    @property
    def groups(self) -> int:
        return self.translation.groups

    def index(self, name: str) -> int | None:
        """The group number of a named group."""
        index: int | None = self.pattern.groupindex.get(name)
        return index


@lru_cache(maxsize=CACHE_SIZE)
def compile_regex(pattern: str, flags: str = "") -> Compiled:
    """Translate and compile ``pattern``. Raises ``E_ARG_INVALID``/``E_REGEX_UNSUPPORTED``."""
    translation = translate(pattern, flags)
    try:
        compiled = regex.compile(translation.python, regex.V1)
    except regex.error as exc:  # pragma: no cover - the translator emits valid syntax
        raise UniChefError("E_INTERNAL", f"Translated regex failed to compile: {exc}") from exc
    return Compiled(translation, compiled)


def _timeout(timeout_ms: int, pattern: str) -> UniChefError:
    return UniChefError(
        "E_REGEX_TIMEOUT",
        f"The regex {pattern[:32]!r} ran longer than {timeout_ms} ms.",
    )


def _to_match(found: Any, groups: int) -> Match:  # noqa: ANN401 - regex.Match is untyped
    return Match(tuple(None if found.start(i) < 0 else found.span(i) for i in range(groups + 1)))


def search(compiled: Compiled, text: str, timeout_ms: int, pos: int = 0) -> Match | None:
    """The first match at or after ``pos``."""
    try:
        found = compiled.pattern.search(text, pos, timeout=timeout_ms / _MS)
    except TimeoutError as exc:
        raise _timeout(timeout_ms, compiled.translation.source) from exc
    return None if found is None else _to_match(found, compiled.groups)


def predicate(compiled: Compiled, timeout_ms: int) -> Callable[[str], bool]:
    """A fast "does it match anywhere" test for scanning many short strings."""
    search = compiled.pattern.search
    seconds = timeout_ms / _MS

    def test(text: str) -> bool:
        try:
            # Positional (pos, endpos, concurrent, partial, timeout), keeping the GIL: on short
            # names the keyword form and GIL release cost more than the search (NFR-004).
            # The timeout still interrupts a runaway search.
            return search(text, None, None, False, False, seconds) is not None
        except TimeoutError as exc:
            raise _timeout(timeout_ms, compiled.translation.source) from exc

    return test


def finditer(
    compiled: Compiled,
    text: str,
    timeout_ms: int,
    check: Callable[[], None] | None = None,
) -> Iterator[Match]:
    """Every match, left to right, with JavaScript's ``g``-flag stepping.

    ``timeout_ms`` bounds the whole iteration, not each search.
    """
    deadline = time.monotonic() + timeout_ms / _MS
    pos = 0
    while pos <= len(text):
        if check is not None:
            check()
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise _timeout(timeout_ms, compiled.translation.source)
        try:
            found = compiled.pattern.search(text, pos, timeout=remaining)
        except TimeoutError as exc:
            raise _timeout(timeout_ms, compiled.translation.source) from exc
        if found is None:
            return
        match = _to_match(found, compiled.groups)
        yield match
        pos = match.end if match.end > match.start else match.end + 1


def expand(template: str, match: Match, text: str, compiled: Compiled) -> str:
    """Expand a replacement template in JavaScript syntax.

    ``$$`` is a dollar, ``$&`` the match, ``$1``-``$99`` a group, ``$<name>`` a named
    group; a group that did not participate gives "". Anything else is literal.
    """
    out: list[str] = []
    i = 0
    n = len(template)
    while i < n:
        ch = template[i]
        nxt = template[i + 1] if i + 1 < n else ""
        if ch != "$" or not nxt:
            out.append(ch)
            i += 1
        elif nxt == "$":
            out.append("$")
            i += 2
        elif nxt == "&":
            out.append(text[match.start : match.end])
            i += 2
        elif nxt.isascii() and nxt.isdigit():
            index, used = _group_number(template, i + 1, compiled.groups)
            if index is None:
                out.append("$")
                i += 1
            else:
                out.append(match.group(text, index) or "")
                i += 1 + used
        elif nxt == "<" and compiled.translation.names and (end := template.find(">", i)) > 0:
            index = compiled.index(template[i + 2 : end])
            out.append("" if index is None else match.group(text, index) or "")
            i = end + 1
        else:
            out.append("$")
            i += 1
    return "".join(out)


def _group_number(template: str, at: int, groups: int) -> tuple[int | None, int]:
    first = int(template[at])
    second = template[at + 1 : at + 2]
    if second.isascii() and second.isdigit():
        two = first * _DIGIT_BASE + int(second)
        if 1 <= two <= min(groups, _MAX_TWO_DIGIT_GROUP):
            return two, 2
    return (first, 1) if 1 <= first <= groups else (None, 0)
