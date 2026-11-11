# SPDX-License-Identifier: GPL-3.0-or-later
"""Extended grapheme clusters (UAX #29 §3.1.1, rules GB1-GB999; PRD §4.5)."""

from collections.abc import Callable, Iterator, Sequence
from itertools import pairwise

from unichef.unicode import props

_CONTROL = frozenset({"CR", "LF", "Control"})
_HANGUL_L_FOLLOW = frozenset({"L", "V", "LV", "LVT"})
_HANGUL_V_FOLLOW = frozenset({"V", "T"})
_HANGUL_T_LEAD = frozenset({"LVT", "T"})
_HANGUL_LV_LEAD = frozenset({"LV", "V"})
_EXTEND_OR_ZWJ = frozenset({"Extend", "ZWJ"})
_CHECK_EVERY = 65536


class _State:
    """Context carried across a scan for the rules that look further back than one char."""

    __slots__ = ("incb", "pict", "ri")

    def __init__(self) -> None:
        self.ri = 0  # Regional_Indicator run length before the current position (GB12/13)
        self.pict = 0  # 0 none, 1 ExtPict Extend*, 2 ExtPict Extend* ZWJ (GB11)
        # GB9c as of Unicode 18: Linker [Extend|Linker]* x Consonant. 2 = inside that run.
        self.incb = 0

    def advance(self, gcb: str, cp: int) -> None:
        self.ri = self.ri + 1 if gcb == "Regional_Indicator" else 0
        if props.has("ExtPict", cp) or (self.pict == 1 and gcb == "Extend"):
            self.pict = 1
        elif self.pict == 1 and gcb == "ZWJ":
            self.pict = 2
        else:
            self.pict = 0
        incb = props.get("InCB", cp)
        if incb == "Linker":
            self.incb = 2
        elif not (self.incb and incb == "Extend"):
            self.incb = 0


def _is_break(prev: str, cur: str, cp: int, state: _State) -> bool:  # noqa: PLR0911
    if prev == "CR" and cur == "LF":  # GB3
        return False
    if prev in _CONTROL or cur in _CONTROL:  # GB4, GB5
        return True
    if prev == "L" and cur in _HANGUL_L_FOLLOW:  # GB6
        return False
    if prev in _HANGUL_LV_LEAD and cur in _HANGUL_V_FOLLOW:  # GB7
        return False
    if prev in _HANGUL_T_LEAD and cur == "T":  # GB8
        return False
    if cur in _EXTEND_OR_ZWJ or cur == "SpacingMark" or prev == "Prepend":  # GB9, GB9a, GB9b
        return False
    if state.incb == 2 and props.get("InCB", cp) == "Consonant":  # noqa: PLR2004  # GB9c
        return False
    if state.pict == 2 and props.has("ExtPict", cp):  # noqa: PLR2004  # GB11
        return False
    return not (prev == cur == "Regional_Indicator" and state.ri % 2 == 1)  # GB12, GB13, GB999


def boundaries(cps: Sequence[int], check: Callable[[], None] | None = None) -> Iterator[int]:
    """Yield every grapheme boundary offset, including 0 and ``len(cps)`` (GB1, GB2)."""
    if not cps:
        return
    yield 0
    state = _State()
    prev = str(props.get("GCB", cps[0]))
    state.advance(prev, cps[0])
    for i in range(1, len(cps)):
        if check is not None and i % _CHECK_EVERY == 0:
            check()
        cp = cps[i]
        cur = str(props.get("GCB", cp))
        if _is_break(prev, cur, cp, state):
            yield i
        state.advance(cur, cp)
        prev = cur
    yield len(cps)


def graphemes(text: str, check: Callable[[], None] | None = None) -> list[str]:
    cps = [ord(ch) for ch in text]
    edges = list(boundaries(cps, check))
    return [text[a:b] for a, b in pairwise(edges)]


def count(text: str) -> int:
    return max(0, sum(1 for _ in boundaries([ord(ch) for ch in text])) - 1)
