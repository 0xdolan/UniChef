# SPDX-License-Identifier: GPL-3.0-or-later
"""Character properties from ``ucd-core`` (PRD §4.2, §16.3 range and block lookup)."""

from bisect import bisect_right
from functools import cache

from unichef.core.errors import UniChefError
from unichef.unicode import data
from unichef.unicode.data import Ranges, RangeSet, RangeTable, Value

ENUMERATED = (
    "gc", "sc", "blk", "age", "bc", "ccc", "ea", "lb", "GCB", "InCB",
    "NFC_QC", "NFD_QC", "NFKC_QC", "NFKD_QC",
)  # fmt: skip

# General_Category groupings (Unicode Standard §4.5, PropertyValueAliases.txt comments).
GC_GROUPS: dict[str, frozenset[str]] = {
    "L": frozenset({"Lu", "Ll", "Lt", "Lm", "Lo"}),
    "LC": frozenset({"Lu", "Ll", "Lt"}),
    "M": frozenset({"Mn", "Mc", "Me"}),
    "N": frozenset({"Nd", "Nl", "No"}),
    "P": frozenset({"Pc", "Pd", "Ps", "Pe", "Pi", "Pf", "Po"}),
    "S": frozenset({"Sm", "Sc", "Sk", "So"}),
    "Z": frozenset({"Zs", "Zl", "Zp"}),
    "C": frozenset({"Cc", "Cf", "Cs", "Co", "Cn"}),
}

_ASCII_LOWER = str.maketrans("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")


def loose(text: str) -> str:
    """UAX44-LM3: ignore ASCII case, whitespace, underscores, hyphens and an initial "is"."""
    key = "".join(ch for ch in text.translate(_ASCII_LOWER) if ch not in " \t\n\r\f\v_-")
    return key[2:] if key.startswith("is") and len(key) > 2 else key  # noqa: PLR2004


@cache
def table(prop: str) -> RangeTable:
    return RangeTable(data.load("core")["props"][prop])


@cache
def binary(prop: str) -> RangeSet:
    return RangeSet(data.load("core")["binary"][prop])


def binary_names() -> tuple[str, ...]:
    return tuple(data.load("core")["binary"])


def get(prop: str, cp: int) -> Value:
    return table(prop).get(cp)


def gc(cp: int) -> str:
    return str(table("gc").get(cp))


def sc(cp: int) -> str:
    return str(table("sc").get(cp))


def ccc(cp: int) -> int:
    return int(table("ccc").get(cp))


def has(prop: str, cp: int) -> bool:
    return cp in binary(prop)


@cache
def _scx() -> tuple[RangeTable, tuple[tuple[str, ...], ...]]:
    raw = data.load("core")["scx"]
    sets = tuple(tuple(s) for s in raw["sets"])
    flat: list[int] = raw["ranges"]
    return RangeTable({"default": -1, "values": list(range(len(sets))), "ranges": flat}), sets


def scx(cp: int) -> tuple[str, ...]:
    """Script_Extensions; a code point outside every range has ``(sc,)``."""
    ranges, sets = _scx()
    index = ranges.get(cp)
    return (sc(cp),) if index == -1 else sets[int(index)]


@cache
def _blocks() -> tuple[list[int], list[int], list[str]]:
    blocks = data.load("core")["blocks"]
    return [b["start"] for b in blocks], [b["end"] for b in blocks], [b["name"] for b in blocks]


def block(cp: int) -> str:
    """Block name as written in Blocks.txt, or ``No_Block``."""
    starts, ends, names = _blocks()
    i = bisect_right(starts, cp) - 1
    return names[i] if i >= 0 and cp <= ends[i] else "No_Block"


# Property and value name resolution (UAX44-LM3)


@cache
def _prop_index() -> dict[str, str]:
    return {loose(alias): short for alias, short in data.load("core")["aliases"]["prop"].items()}


@cache
def _value_index(prop: str) -> dict[str, str]:
    values: dict[str, str] = data.load("core")["aliases"]["values"].get(prop, {})
    return {loose(alias): stored for alias, stored in values.items()}


def resolve_property(name: str) -> str:
    """Return the short property name for any alias, or raise ``E_ARG_INVALID``."""
    short = _prop_index().get(loose(name))
    if short is None:
        raise UniChefError("E_ARG_INVALID", f"Unknown Unicode property {name!r}.")
    return short


def is_binary(prop: str) -> bool:
    return prop in data.load("core")["binary"] or prop == "ExtPict"


def resolve_value(prop: str, value: str) -> str:
    """Return the stored value for ``value`` of the enumerated property ``prop``."""
    if prop == "ccc" and value.isascii() and value.isdigit():
        return value
    stored = _value_index(prop).get(loose(value))
    if stored is None:
        raise UniChefError("E_ARG_INVALID", f"Unknown value {value!r} for property {prop}.")
    return stored


def ranges_for(prop: str, value: str) -> Ranges:
    """Code points where the (already resolved) property has the (already resolved) value."""
    if prop == "gc":
        return table("gc").ranges_where(set(GC_GROUPS.get(value, {value})))
    if prop == "ccc":
        return table("ccc").ranges_where({int(value)})
    if prop == "scx":
        return scx_ranges(value)
    return table(prop).ranges_where({value})


@cache
def scx_ranges(script: str) -> Ranges:
    """Code points whose Script_Extensions contain ``script``."""
    ranges, sets = _scx()
    wanted = {i for i, s in enumerate(sets) if script in s}
    explicit = ranges.ranges_where(wanted)
    covered = ranges.ranges_where(set(range(len(sets))))
    plain = data.intersect(table("sc").ranges_where({script}), data.complement(covered))
    return data.union(explicit, plain)


def binary_ranges(prop: str) -> Ranges:
    return binary(prop).ranges()
