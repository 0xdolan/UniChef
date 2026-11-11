# SPDX-License-Identifier: GPL-3.0-or-later
"""UTS #39 confusable skeletons, identifier status and type, script resolution (PRD §4.7)."""

from functools import cache

from unichef.unicode import data, props
from unichef.unicode.normalize import decompose

COMMON = "Zyyy"
INHERITED = "Zinh"


@cache
def _confusables() -> dict[int, tuple[int, ...]]:
    return data.int_map(data.load("security")["confusables"])


def prototype(cp: int) -> tuple[int, ...] | None:
    """The confusables.txt (MA) prototype for ``cp``, or None if it has no mapping."""
    return _confusables().get(cp)


def skeleton(text: str) -> str:
    """UTS #39 §4: NFD, map each code point through confusables.txt, NFD again."""
    first = decompose([ord(ch) for ch in text], compat=False)
    mapped = [m for cp in first for m in _confusables().get(cp, (cp,))]
    return "".join(map(chr, decompose(mapped, compat=False)))


def is_confusable(a: str, b: str) -> bool:
    return skeleton(a) == skeleton(b)


@cache
def _id_status() -> data.RangeSet:
    return data.RangeSet(data.load("security")["idStatus"]["allowed"])


def identifier_status(cp: int) -> str:
    """``Allowed`` or ``Restricted`` (IdentifierStatus.txt)."""
    return "Allowed" if cp in _id_status() else "Restricted"


@cache
def _id_type() -> tuple[data.RangeTable, tuple[tuple[str, ...], ...], str]:
    raw = data.load("security")["idType"]
    sets = tuple(tuple(s) for s in raw["sets"])
    table = data.RangeTable(
        {"default": -1, "values": list(range(len(sets))), "ranges": raw["ranges"]}
    )
    return table, sets, raw["default"]


def identifier_types(cp: int) -> tuple[str, ...]:
    table, sets, default = _id_type()
    index = table.get(cp)
    return (default,) if index == -1 else sets[int(index)]


def augmented_scripts(cp: int) -> frozenset[str] | None:
    """UTS #39 §5.1 augmented script set; None means "all scripts" (Common, Inherited)."""
    scripts = set(props.scx(cp))
    if scripts & {COMMON, INHERITED}:
        return None
    if "Hani" in scripts:
        scripts |= {"Hanb", "Jpan", "Kore"}
    if "Hira" in scripts or "Kana" in scripts:
        scripts.add("Jpan")
    if "Hang" in scripts:
        scripts.add("Kore")
    if "Bopo" in scripts:
        scripts.add("Hanb")
    return frozenset(scripts)


def resolved_script_set(text: str) -> frozenset[str] | None:
    """Intersection of the augmented script sets; None means "all scripts"."""
    resolved: frozenset[str] | None = None
    for ch in text:
        scripts = augmented_scripts(ord(ch))
        if scripts is None:
            continue
        resolved = scripts if resolved is None else resolved & scripts
    return resolved
