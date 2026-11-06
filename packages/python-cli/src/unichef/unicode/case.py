# SPDX-License-Identifier: GPL-3.0-or-later
"""Full case mapping and case folding (Unicode Standard §3.13, PRD §4.5).

Never uses ``str.upper()`` and friends: Python's tables follow its bundled Unicode version.
"""

from collections.abc import Callable
from functools import cache
from typing import Literal

from unichef.unicode import data, props

type Mapping = Literal["lower", "title", "upper"]
type Locale = Literal["none", "tr", "az", "lt"]
LOCALES: tuple[Locale, ...] = ("none", "tr", "az", "lt")

_COLUMN: dict[Mapping, int] = {"lower": 1, "title": 2, "upper": 3}
_ABOVE = 230
_COMBINING_DOT_ABOVE = 0x0307
_CAPITAL_I = 0x0049
_TITLE_WORD_CHARS = frozenset(["L", "M", "N"])

type _Special = tuple[int, tuple[tuple[int, ...], ...], str | None, tuple[str, ...]]


@cache
def _maps() -> dict[str, dict[int, tuple[int, ...]]]:
    raw = data.load("core")["case"]
    return {key: data.int_map(raw[key]) for key in raw if key != "special"}


@cache
def _special() -> dict[int, list[_Special]]:
    out: dict[int, list[_Special]] = {}
    for cp, lower, title, upper, conditions in data.load("core")["case"]["special"]:
        words = conditions.split()
        language = words[0] if words and words[0].islower() else None
        context = tuple(words[1:] if language else words)
        out.setdefault(cp, []).append(
            (cp, (tuple(lower), tuple(title), tuple(upper)), language, context)
        )
    return out


# Casing contexts (Unicode Standard Table 3-17)


def _final_sigma(cps: list[int], i: int) -> bool:
    j = i - 1
    while j >= 0 and props.has("Case_Ignorable", cps[j]):
        j -= 1
    if j < 0 or not props.has("Cased", cps[j]):
        return False
    j = i + 1
    while j < len(cps) and props.has("Case_Ignorable", cps[j]):
        j += 1
    return j >= len(cps) or not props.has("Cased", cps[j])


def _scan_back(cps: list[int], i: int, hit: Callable[[int], bool]) -> bool:
    for j in range(i - 1, -1, -1):
        if hit(cps[j]):
            return True
        if props.ccc(cps[j]) in {0, _ABOVE}:
            return False
    return False


def _scan_forward(cps: list[int], i: int, hit: Callable[[int], bool], stop: set[int]) -> bool:
    for j in range(i + 1, len(cps)):
        if hit(cps[j]):
            return True
        if props.ccc(cps[j]) in stop:
            return False
    return False


def _holds(condition: str, cps: list[int], i: int) -> bool:
    negate = condition.startswith("Not_")
    name = condition.removeprefix("Not_")
    match name:
        case "Final_Sigma":
            result = _final_sigma(cps, i)
        case "After_Soft_Dotted":
            result = _scan_back(cps, i, lambda cp: props.has("Soft_Dotted", cp))
        case "More_Above":
            result = _scan_forward(cps, i, lambda cp: props.ccc(cp) == _ABOVE, {0})
        case "Before_Dot":
            result = _scan_forward(cps, i, lambda cp: cp == _COMBINING_DOT_ABOVE, {0, _ABOVE})
        case "After_I":
            result = _scan_back(cps, i, lambda cp: cp == _CAPITAL_I)
        case _:  # pragma: no cover - build.py only emits the conditions above
            raise ValueError(f"unknown casing condition {condition}")
    return result != negate


def _map_one(cps: list[int], i: int, mapping: Mapping, locale: Locale) -> tuple[int, ...]:
    cp = cps[i]
    for _, columns, language, context in _special().get(cp, ()):
        if language not in {None, locale}:
            continue
        if all(_holds(c, cps, i) for c in context):
            return columns[_COLUMN[mapping] - 1]
    return _maps()[mapping].get(cp, (cp,))


def _word_start(cps: list[int], i: int) -> bool:
    """True when no letter, mark or number precedes ``i`` (Case_Ignorable skipped)."""
    j = i - 1
    while j >= 0 and props.has("Case_Ignorable", cps[j]):
        j -= 1
    return j < 0 or props.gc(cps[j])[0] not in _TITLE_WORD_CHARS


def convert(text: str, mapping: Mapping | Literal["titlecase"], locale: Locale = "none") -> str:
    """Upper-, lower- or title-case ``text`` with full mappings and casing contexts.

    ``titlecase`` maps a cased character to titlecase when no letter, mark or number
    precedes it (case-ignorable characters such as apostrophes are skipped), and every
    other character to lowercase.
    """
    cps = [ord(ch) for ch in text]
    out: list[int] = []
    for i in range(len(cps)):
        if mapping == "titlecase":
            word = props.has("Cased", cps[i]) and _word_start(cps, i)
            out.extend(_map_one(cps, i, "title" if word else "lower", locale))
        else:
            out.extend(_map_one(cps, i, mapping, locale))
    return "".join(map(chr, out))


def upper(text: str, locale: Locale = "none") -> str:
    return convert(text, "upper", locale)


def lower(text: str, locale: Locale = "none") -> str:
    return convert(text, "lower", locale)


def title(text: str, locale: Locale = "none") -> str:
    return convert(text, "titlecase", locale)


def fold_code_point(cp: int, *, simple: bool = False, turkic: bool = False) -> tuple[int, ...]:
    maps = _maps()
    if turkic and cp in maps["foldTurkic"]:
        return maps["foldTurkic"][cp]
    if simple:
        if cp in maps["foldSimple"]:
            return maps["foldSimple"][cp]
        full = maps["fold"].get(cp)
        return full if full is not None and len(full) == 1 else (cp,)
    return maps["fold"].get(cp, (cp,))


def fold(text: str, *, simple: bool = False, locale: Locale = "none") -> str:
    """Case folding: full (C+F) by default, simple (C+S) on request, T entries for tr/az."""
    turkic = locale in {"tr", "az"}
    return "".join(
        chr(m) for ch in text for m in fold_code_point(ord(ch), simple=simple, turkic=turkic)
    )
