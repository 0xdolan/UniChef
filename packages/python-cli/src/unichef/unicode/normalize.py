# SPDX-License-Identifier: GPL-3.0-or-later
"""Unicode normalization forms NFC, NFD, NFKC and NFKD (UAX #15, PRD §4.4).

Built only from ``ucd-core``: decompositions, canonical combining classes and
Full_Composition_Exclusion. Hangul syllables are handled algorithmically.
"""

from collections.abc import Callable
from functools import cache
from typing import Literal

from unichef.unicode import data, props
from unichef.unicode.names import N_COUNT, S_BASE, S_COUNT, T_COUNT

type Form = Literal["NFC", "NFD", "NFKC", "NFKD"]
FORMS: tuple[Form, ...] = ("NFC", "NFD", "NFKC", "NFKD")

L_BASE, V_BASE, T_BASE = 0x1100, 0x1161, 0x11A7
_L_END, _V_END, _T_END = L_BASE + 19, V_BASE + 21, T_BASE + T_COUNT
_ASCII_END = 0x80


type _Decomp = dict[int, tuple[int, ...]]


@cache
def _decompositions() -> tuple[_Decomp, _Decomp]:
    """Single-level canonical and compatibility (canonical included) mappings."""
    canonical: _Decomp = {}
    compat: _Decomp = {}
    for key, (tag, cps) in data.load("core")["decomp"].items():
        cp = int(key)
        compat[cp] = tuple(cps)
        if tag == "":
            canonical[cp] = tuple(cps)
    return canonical, compat


def _expand(single: _Decomp) -> _Decomp:
    def full(cp: int) -> tuple[int, ...]:
        mapping = single.get(cp)
        return (cp,) if mapping is None else tuple(p for m in mapping for p in full(m))

    return {cp: full(cp) for cp in single}


@cache
def _full_tables() -> tuple[_Decomp, _Decomp]:
    """Full (recursive) canonical and compatibility decompositions, computed once."""
    canonical, compat = _decompositions()
    return _expand(canonical), _expand(compat)


def _full(cp: int, compat: bool) -> tuple[int, ...]:
    """The full decomposition of one code point."""
    if S_BASE <= cp < S_BASE + S_COUNT:
        index = cp - S_BASE
        lead, rest = divmod(index, N_COUNT)
        vowel, trail = divmod(rest, T_COUNT)
        parts = (L_BASE + lead, V_BASE + vowel)
        return (*parts, T_BASE + trail) if trail else parts
    return _full_tables()[1 if compat else 0].get(cp, (cp,))


@cache
def _exclusions() -> data.RangeSet:
    return data.RangeSet(data.load("core")["compExcl"])


@cache
def _compositions() -> dict[tuple[int, int], int]:
    excluded = _exclusions()
    return {
        (pair[0], pair[1]): cp
        for cp, pair in _decompositions()[0].items()
        if len(pair) == 2 and cp not in excluded  # noqa: PLR2004
    }


def _reorder(cps: list[int]) -> None:
    """Canonical ordering: stable-sort each run of non-starters by ccc, in place."""
    i = 0
    n = len(cps)
    while i < n:
        if props.ccc(cps[i]) == 0:
            i += 1
            continue
        j = i
        while j < n and props.ccc(cps[j]) != 0:
            j += 1
        if j - i > 1:
            cps[i:j] = sorted(cps[i:j], key=props.ccc)
        i = j


def _compose_pair(first: int, second: int) -> int | None:
    if L_BASE <= first < _L_END and V_BASE <= second < _V_END:
        return S_BASE + ((first - L_BASE) * 21 + (second - V_BASE)) * T_COUNT
    if (
        S_BASE <= first < S_BASE + S_COUNT
        and (first - S_BASE) % T_COUNT == 0
        and T_BASE < second < _T_END
    ):
        return first + (second - T_BASE)
    return _compositions().get((first, second))


def _compose(cps: list[int]) -> list[int]:
    """Canonical composition (UAX #15 §1.3, D117)."""
    if not cps:
        return cps
    out: list[int] = []
    starter = -1  # index in ``out`` of the last starter, or -1
    last_ccc = -1
    for cp in cps:
        cc = props.ccc(cp)
        if starter >= 0 and (last_ccc < cc or (last_ccc == 0 and len(out) - 1 == starter)):
            composed = _compose_pair(out[starter], cp)
            if composed is not None:
                out[starter] = composed
                continue
        if cc == 0:
            starter = len(out)
        last_ccc = cc
        out.append(cp)
    return out


def decompose(cps: list[int], compat: bool, check: Callable[[], None] | None = None) -> list[int]:
    out: list[int] = []
    for i, cp in enumerate(cps):
        if check is not None and i % 65536 == 0:
            check()
        out.extend(_full(cp, compat))
    _reorder(out)
    return out


def normalize_code_points(
    form: Form, cps: list[int], check: Callable[[], None] | None = None
) -> list[int]:
    decomposed = decompose(cps, form in {"NFKC", "NFKD"}, check)
    return _compose(decomposed) if form in {"NFC", "NFKC"} else decomposed


def normalize(form: Form, text: str, check: Callable[[], None] | None = None) -> str:
    """Normalize ``text``; lone surrogates pass through unchanged."""
    if all(ord(ch) < _ASCII_END for ch in text):
        return text
    cps = [ord(ch) for ch in text]
    return "".join(map(chr, normalize_code_points(form, cps, check)))
