# SPDX-License-Identifier: GPL-3.0-or-later
"""Load the compiled UCD artefacts (PRD §4.1.3, §4.2; format in data/ucd/README.md).

Every Unicode answer UniChef gives comes from these files. The host's ``unicodedata``
tables are never consulted.
"""

import gzip
import json
from array import array
from bisect import bisect_right
from collections.abc import Iterable, Iterator
from collections.abc import Set as AbstractSet
from functools import cache
from importlib.resources import files
from typing import Any, Literal

UCD_VERSION = "18.0.0"
MAX_CODE_POINT = 0x10FFFF

type Artefact = Literal["core", "names", "security"]
type Value = str | int
type Ranges = list[tuple[int, int]]
"""Sorted, disjoint, non-adjacent inclusive code-point ranges."""


@cache
def load(kind: Artefact) -> dict[str, Any]:
    """Read and parse one artefact once per process."""
    resource = files("unichef._data") / f"ucd-{kind}-{UCD_VERSION}.json.gz"
    data: dict[str, Any] = json.loads(gzip.decompress(resource.read_bytes()))
    if data.get("version") != UCD_VERSION:  # pragma: no cover - guarded by the build
        raise RuntimeError(f"ucd-{kind} is version {data.get('version')}, expected {UCD_VERSION}")
    return data


class RangeTable:
    """An enumerated property: flat ``[start, length, valueIndex, …]`` runs plus a default."""

    __slots__ = ("_index", "_lengths", "_starts", "default", "values")

    def __init__(self, raw: dict[str, Any]) -> None:
        flat: list[int] = raw["ranges"]
        self.default: Value = raw["default"]
        self.values: tuple[Value, ...] = tuple(raw["values"])
        self._starts = array("l", flat[0::3])
        self._lengths = array("l", flat[1::3])
        self._index = array("l", flat[2::3])

    def get(self, cp: int) -> Value:
        i = bisect_right(self._starts, cp) - 1
        if i >= 0 and cp < self._starts[i] + self._lengths[i]:
            return self.values[self._index[i]]
        return self.default

    def ranges_where(self, wanted: AbstractSet[Value]) -> Ranges:
        """All code points whose value is in ``wanted``, gaps (the default) included."""
        out: list[tuple[int, int]] = []
        cursor = 0
        default_wanted = self.default in wanted
        for start, length, index in zip(self._starts, self._lengths, self._index, strict=True):
            if default_wanted and cursor < start:
                out.append((cursor, start - 1))
            if self.values[index] in wanted:
                out.append((start, start + length - 1))
            cursor = start + length
        if default_wanted and cursor <= MAX_CODE_POINT:
            out.append((cursor, MAX_CODE_POINT))
        return merge(out)


class RangeSet:
    """A binary property: flat ``[start, length, …]`` runs."""

    __slots__ = ("_ends", "_starts")

    def __init__(self, flat: list[int]) -> None:
        self._starts = array("l", flat[0::2])
        self._ends = array("l", (s + n - 1 for s, n in zip(flat[0::2], flat[1::2], strict=True)))

    def __contains__(self, cp: int) -> bool:
        i = bisect_right(self._starts, cp) - 1
        return i >= 0 and cp <= self._ends[i]

    def ranges(self) -> Ranges:
        return merge(zip(self._starts, self._ends, strict=True))


def merge(ranges: Iterable[tuple[int, int]]) -> Ranges:
    """Sort and coalesce overlapping or adjacent inclusive ranges."""
    out: list[tuple[int, int]] = []
    for start, end in sorted(ranges):
        if out and start <= out[-1][1] + 1:
            if end > out[-1][1]:
                out[-1] = (out[-1][0], end)
        else:
            out.append((start, end))
    return out


def union(*sets: Ranges) -> Ranges:
    return merge(r for ranges in sets for r in ranges)


def complement(ranges: Ranges) -> Ranges:
    out: list[tuple[int, int]] = []
    cursor = 0
    for start, end in ranges:
        if cursor < start:
            out.append((cursor, start - 1))
        cursor = end + 1
    if cursor <= MAX_CODE_POINT:
        out.append((cursor, MAX_CODE_POINT))
    return out


def intersect(a: Ranges, b: Ranges) -> Ranges:
    out: list[tuple[int, int]] = []
    i = j = 0
    while i < len(a) and j < len(b):
        start = max(a[i][0], b[j][0])
        end = min(a[i][1], b[j][1])
        if start <= end:
            out.append((start, end))
        if a[i][1] < b[j][1]:
            i += 1
        else:
            j += 1
    return out


def code_points(ranges: Ranges) -> Iterator[int]:
    for start, end in ranges:
        yield from range(start, end + 1)


def contains(ranges: Ranges, cp: int) -> bool:
    i = bisect_right(ranges, (cp, MAX_CODE_POINT + 1)) - 1
    return i >= 0 and ranges[i][0] <= cp <= ranges[i][1]


def int_map(raw: dict[str, list[int]]) -> dict[int, tuple[int, ...]]:
    """Convert a ``{"<cp>": [cps]}`` JSON map to integer keys."""
    return {int(k): tuple(v) for k, v in raw.items()}
