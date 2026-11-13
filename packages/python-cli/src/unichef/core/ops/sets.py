# SPDX-License-Identifier: GPL-3.0-or-later
"""Set operations and edit distances: union, intersection, difference, symmetric
difference, Cartesian product, power set, Hamming and Levenshtein distance (PRD §3.8, 1.1).

Behaviour follows CyberChef v11.5.0 (Apache-2.0), with the deviations listed in
spec/README.md: each sample is a set (repeated items count once), and results come in a
fixed, documented order.
"""

import re
from itertools import combinations, product

from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    Example,
    OpContext,
    enum_arg,
    int_arg,
    operation,
    string_arg,
)

CHECK_EVERY = 4096
MAX_PRODUCT = 100_000
MAX_POWER_SET_ITEMS = 16
MAX_EDIT_CELLS = 4_000_000
MAX_COST = 1_000_000
PAIR = 2

_ASCII_SPACE = re.compile(r"[ \t\n\v\f\r]+")
_HEX = re.compile(r"(?:[0-9A-Fa-f]{2})*")

_SET_ARGS = (string_arg("sample_delimiter", "\n\n"), string_arg("item_delimiter", ","))


def _bad_arg(message: str) -> UniChefError:
    return UniChefError("E_ARG_INVALID", message)


def _delimiter(args: Args, name: str) -> str:
    value = args.text(name)
    if not value:
        raise _bad_arg(f"The {name.replace('_', ' ')} must not be empty.")
    return value


def _unique(items: list[str]) -> list[str]:
    """The items without repeats, in first-seen order."""
    return list(dict.fromkeys(items))


def _samples(text: str, args: Args, count: int | None) -> tuple[list[list[str]], str]:
    """Split the input into samples of unique items. `count` is the exact number of samples
    needed, or None for two or more."""
    sample_delimiter = _delimiter(args, "sample_delimiter")
    item_delimiter = _delimiter(args, "item_delimiter")
    samples = text.split(sample_delimiter)
    if count is not None and len(samples) != count:
        raise UniChefError(
            "E_DECODE", f"The input must have exactly {count} samples; found {len(samples)}."
        )
    if count is None and len(samples) < PAIR:
        raise UniChefError("E_DECODE", "The input must have at least 2 samples; found 1.")
    return [_unique(s.split(item_delimiter)) for s in samples], item_delimiter


@operation(
    "set-union",
    "Set Union",
    "Data",
    "string",
    "string",
    _SET_ARGS,
    examples=(Example("1,2,3\n\n3,4", {}, "1,2,3,4"),),
)
def set_union(text: str, args: Args, _ctx: OpContext) -> str:
    """Split the input on `sample_delimiter` into two samples and each sample on
    `item_delimiter` into items. Write every item that is in either sample, once, in the
    order first seen."""
    if not text:
        return ""
    (a, b), delimiter = _samples(text, args, PAIR)
    return delimiter.join(_unique(a + b))


@operation(
    "set-intersection",
    "Set Intersection",
    "Data",
    "string",
    "string",
    _SET_ARGS,
    examples=(Example("1,2,3\n\n3,2,4", {}, "2,3"),),
)
def set_intersection(text: str, args: Args, _ctx: OpContext) -> str:
    """Split the input on `sample_delimiter` into two samples and each sample on
    `item_delimiter` into items. Write the items that are in both samples, once, in the
    order of the first sample."""
    if not text:
        return ""
    (a, b), delimiter = _samples(text, args, PAIR)
    seen = set(b)
    return delimiter.join(item for item in a if item in seen)


@operation(
    "set-difference",
    "Set Difference",
    "Data",
    "string",
    "string",
    _SET_ARGS,
    examples=(Example("1,2,3\n\n3,4", {}, "1,2"),),
)
def set_difference(text: str, args: Args, _ctx: OpContext) -> str:
    """Split the input on `sample_delimiter` into two samples and each sample on
    `item_delimiter` into items. Write the items of the first sample that are not in the
    second, once, in their order."""
    if not text:
        return ""
    (a, b), delimiter = _samples(text, args, PAIR)
    seen = set(b)
    return delimiter.join(item for item in a if item not in seen)


@operation(
    "symmetric-difference",
    "Symmetric Difference",
    "Data",
    "string",
    "string",
    _SET_ARGS,
    examples=(Example("1,2,3\n\n3,4", {}, "1,2,4"),),
)
def symmetric_difference(text: str, args: Args, _ctx: OpContext) -> str:
    """Split the input on `sample_delimiter` into two samples and each sample on
    `item_delimiter` into items. Write the items that are in exactly one sample, once: those
    of the first sample, then those of the second."""
    if not text:
        return ""
    (a, b), delimiter = _samples(text, args, PAIR)
    in_a, in_b = set(a), set(b)
    return delimiter.join([x for x in a if x not in in_b] + [x for x in b if x not in in_a])


@operation(
    "cartesian-product",
    "Cartesian Product",
    "Data",
    "string",
    "string",
    _SET_ARGS,
    examples=(Example("1,2\n\na,b", {}, "(1,a),(1,b),(2,a),(2,b)"),),
)
def cartesian_product(text: str, args: Args, ctx: OpContext) -> str:
    """Split the input on `sample_delimiter` into two or more samples and each sample on
    `item_delimiter` into items. Write every tuple that takes one item from each sample, as
    `(x,y)` with a comma inside, joined by `item_delimiter`. The last sample varies
    fastest. At most 100000 tuples."""
    if not text:
        return ""
    samples, delimiter = _samples(text, args, None)
    total = 1
    for sample in samples:
        total *= len(sample)
    if total > MAX_PRODUCT:
        raise UniChefError(
            "E_LIMIT", f"The product has {total} tuples; the limit is {MAX_PRODUCT}."
        )
    out = []
    for i, combo in enumerate(product(*samples)):
        if i % CHECK_EVERY == 0:
            ctx.check()
        out.append("(" + ",".join(combo) + ")")
    return delimiter.join(out)


@operation(
    "power-set",
    "Power Set",
    "Data",
    "string",
    "string",
    (string_arg("item_delimiter", ","),),
    examples=(Example("a,b", {}, "\na\nb\na,b\n"),),
)
def power_set(text: str, args: Args, ctx: OpContext) -> str:
    """Split the input on `item_delimiter` into items, dropping empty ones and repeats.
    Write every subset on its own line, items joined by `item_delimiter` and each line
    ending in a line feed: the empty set first, then smaller subsets before larger ones,
    and subsets of one size in input order. At most 16 items."""
    items = _unique([x for x in text.split(_delimiter(args, "item_delimiter")) if x])
    if not items:
        return ""
    if len(items) > MAX_POWER_SET_ITEMS:
        raise UniChefError(
            "E_LIMIT", f"The input has {len(items)} items; the limit is {MAX_POWER_SET_ITEMS}."
        )
    delimiter = args.text("item_delimiter")
    out: list[str] = []
    for size in range(len(items) + 1):
        ctx.check()
        out.extend(delimiter.join(subset) + "\n" for subset in combinations(items, size))
    return "".join(out)


def _two(text: str, delimiter: str) -> tuple[str, str]:
    match text.split(delimiter):
        case [first, second]:
            return first, second
        case samples:
            raise UniChefError(
                "E_DECODE", f"The input must have exactly 2 samples; found {len(samples)}."
            )


def _hex_bytes(sample: str) -> bytes:
    digits = _ASCII_SPACE.sub("", sample)
    if not _HEX.fullmatch(digits):
        raise UniChefError(
            "E_DECODE", "A sample is not hex: it needs an even number of hex digits."
        )
    return bytes.fromhex(digits)


@operation(
    "hamming-distance",
    "Hamming Distance",
    "Data",
    "string",
    "string",
    (
        string_arg("delimiter", "\n\n"),
        enum_arg("unit", ("byte", "bit")),
        enum_arg("input_type", ("text", "hex")),
    ),
    examples=(Example("karolin\n\nkathrin", {}, "3"),),
)
def hamming_distance(text: str, args: Args, ctx: OpContext) -> str:
    """Split the input on `delimiter` into two samples of equal length, read as UTF-8 text
    or as hex (whitespace ignored). Write the number of positions where they differ,
    counting bytes or bits."""
    if not text:
        return ""
    first, second = _two(text, _delimiter(args, "delimiter"))
    if args.text("input_type") == "hex":
        a, b = _hex_bytes(first), _hex_bytes(second)
    else:
        a, b = first.encode("utf-8"), second.encode("utf-8")
    if len(a) != len(b):
        raise UniChefError(
            "E_DECODE", f"The samples differ in length: {len(a)} and {len(b)} bytes."
        )
    ctx.check()
    if args.text("unit") == "bit":
        return str((int.from_bytes(a, "big") ^ int.from_bytes(b, "big")).bit_count())
    return str(sum(x != y for x, y in zip(a, b, strict=True)))


@operation(
    "levenshtein-distance",
    "Levenshtein Distance",
    "Data",
    "string",
    "string",
    (
        string_arg("delimiter", "\n"),
        int_arg("insertion", 1, 0, MAX_COST),
        int_arg("deletion", 1, 0, MAX_COST),
        int_arg("substitution", 1, 0, MAX_COST),
    ),
    examples=(Example("kitten\nsitting", {}, "3"),),
)
def levenshtein_distance(text: str, args: Args, ctx: OpContext) -> str:
    """Split the input on `delimiter` into two samples. Write the least total cost of the
    insertions, deletions and substitutions of characters (code points) that turn the
    first sample into the second. The product of the two lengths may be at most
    4000000."""
    if not text:
        return ""
    first, second = _two(text, _delimiter(args, "delimiter"))
    if len(first) * len(second) > MAX_EDIT_CELLS:
        raise UniChefError(
            "E_LIMIT",
            f"The samples need {len(first) * len(second)} steps; the limit is {MAX_EDIT_CELLS}.",
        )
    insert, delete, substitute = (
        args.integer("insertion"),
        args.integer("deletion"),
        args.integer("substitution"),
    )
    previous = [j * insert for j in range(len(second) + 1)]
    for i, x in enumerate(first, 1):
        ctx.check()
        current = [i * delete]
        for j, y in enumerate(second, 1):
            current.append(
                min(
                    previous[j] + delete,
                    current[j - 1] + insert,
                    previous[j - 1] + (0 if x == y else substitute),
                )
            )
        previous = current
    return str(previous[-1])
