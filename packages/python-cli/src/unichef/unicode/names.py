# SPDX-License-Identifier: GPL-3.0-or-later
"""Character names, aliases and labels (PRD §4.3, Unicode Standard §4.8)."""

from bisect import bisect_left, bisect_right
from collections.abc import Iterator
from dataclasses import dataclass
from functools import cache

from unichef.unicode import data, props

# Hangul syllable composition constants (Unicode Standard §3.12).
S_BASE = 0xAC00
L_COUNT, V_COUNT, T_COUNT = 19, 21, 28
N_COUNT = V_COUNT * T_COUNT
S_COUNT = L_COUNT * N_COUNT

_ASCII_UPPER = str.maketrans("abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
_HANGUL_O_E = "HANGULJUNGSEONGO-E"
_HANGUL_O_E_CP = 0x1180


@dataclass(slots=True, frozen=True)
class Alias:
    alias: str
    type: str


@dataclass(slots=True, frozen=True)
class _NameRange:
    start: int
    end: int
    rule: str
    prefix: str


@cache
def _tables() -> tuple[list[int], list[str], list[_NameRange], dict[str, list[str]]]:
    raw = data.load("names")
    cps = [cp for cp, _ in raw["names"]]
    names = [name for _, name in raw["names"]]
    ranges = [_NameRange(*r) for r in raw["ranges"]]
    return cps, names, ranges, raw["jamo"]


def _range_for(cp: int) -> _NameRange | None:
    for r in _tables()[2]:
        if r.start <= cp <= r.end:
            return r
    return None


def _hangul_name(prefix: str, cp: int) -> str:
    jamo = _tables()[3]
    index = cp - S_BASE
    lead, rest = divmod(index, N_COUNT)
    vowel, trail = divmod(rest, T_COUNT)
    return prefix + jamo["L"][lead] + jamo["V"][vowel] + jamo["T"][trail]


def name(cp: int) -> str:
    """The Name property, or ``""`` for code points without one."""
    algorithmic = _range_for(cp)
    if algorithmic is not None:
        if algorithmic.rule == "NR1":
            return _hangul_name(algorithmic.prefix, cp)
        return f"{algorithmic.prefix}{cp:04X}"
    cps, names, _, _ = _tables()
    i = bisect_right(cps, cp) - 1
    return names[i] if i >= 0 and cps[i] == cp else ""


@cache
def _aliases() -> dict[int, tuple[Alias, ...]]:
    out: dict[int, list[Alias]] = {}
    for cp, alias, kind in data.load("names")["aliases"]:
        out.setdefault(cp, []).append(Alias(alias, kind))
    return {cp: tuple(a) for cp, a in out.items()}


def aliases(cp: int) -> tuple[Alias, ...]:
    return _aliases().get(cp, ())


@cache
def _all_names() -> tuple[list[int], list[str]]:
    """Every named code point (explicit and algorithmic), ascending, with its name."""
    cps, names, ranges, _ = _tables()
    pairs = list(zip(cps, names, strict=True))
    pairs += [(cp, name(cp)) for r in ranges for cp in range(r.start, r.end + 1)]
    pairs.sort()
    return [cp for cp, _ in pairs], [text for _, text in pairs]


def iter_names(within: data.Ranges) -> Iterator[tuple[int, str]]:
    """Every ``(cp, name)`` with a non-empty Name inside ``within``, ascending."""
    cps, names = _all_names()
    for start, end in within:
        lo = bisect_left(cps, start)
        hi = bisect_right(cps, end)
        yield from zip(cps[lo:hi], names[lo:hi], strict=True)


def iter_aliases(within: data.Ranges) -> Iterator[tuple[int, Alias]]:
    """Every ``(cp, alias)`` inside ``within``."""
    for cp, found in _aliases().items():
        if data.contains(within, cp):
            for alias in found:
                yield cp, alias


def label(cp: int) -> str:
    """The name, or a display label such as ``<control-0007>`` (never a real name)."""
    found = name(cp)
    if found:
        return found
    category = props.gc(cp)
    if category == "Cc":
        kind = "control"
    elif category == "Co":
        kind = "private-use"
    elif category == "Cs":
        kind = "surrogate"
    elif props.has("Noncharacter_Code_Point", cp):
        kind = "noncharacter"
    else:
        kind = "reserved"
    return f"<{kind}-{cp:04X}>"


def preferred(cp: int) -> str:
    """The name for display: a correction alias wins, then the name, then a control alias."""
    found = aliases(cp)
    for alias in found:
        if alias.type == "correction":
            return alias.alias
    current = name(cp)
    if current:
        return current
    for alias in found:
        if alias.type == "control":
            return alias.alias
    return label(cp)


# Reverse lookup (UAX44-LM2)


def loose_name(text: str) -> str:
    """UAX44-LM2: ignore case, whitespace, underscores and medial hyphens (except O-E)."""
    upper = text.translate(_ASCII_UPPER)
    kept: list[str] = []
    for i, ch in enumerate(upper):
        if ch in " \t\n\r\f\v_":
            continue
        medial = 0 < i < len(upper) - 1 and upper[i - 1] != " " and upper[i + 1] != " "
        if ch == "-" and medial:
            continue
        kept.append(ch)
    key = "".join(kept)
    spaced = "".join(ch for ch in upper if ch not in " \t\n\r\f\v_")
    return _HANGUL_O_E if spaced == _HANGUL_O_E else key


@cache
def _reverse() -> dict[str, int]:
    cps, names, ranges, _ = _tables()
    index = {loose_name(n): cp for cp, n in zip(cps, names, strict=True)}
    for cp, found in _aliases().items():
        for alias in found:
            index.setdefault(loose_name(alias.alias), cp)
    for r in ranges:
        if r.rule == "NR1":
            for cp in range(r.start, r.end + 1):
                index[loose_name(_hangul_name(r.prefix, cp))] = cp
    index[_HANGUL_O_E] = _HANGUL_O_E_CP
    return index


def lookup(text: str) -> int | None:
    """Find the code point whose name or alias loosely matches ``text``."""
    key = loose_name(text)
    found = _reverse().get(key)
    if found is not None:
        return found
    for r in _tables()[2]:
        if r.rule != "NR2":
            continue
        prefix = loose_name(r.prefix + "0")[:-1]
        digits = key[len(prefix) :]
        if (
            key.startswith(prefix)
            and 4 <= len(digits) <= 6  # noqa: PLR2004
            and all(ch in "0123456789ABCDEF" for ch in digits)
        ):
            cp = int(digits, 16)
            if r.start <= cp <= r.end and f"{cp:04X}" == digits:
                return cp
    return None
