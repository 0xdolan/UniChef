# SPDX-License-Identifier: GPL-3.0-or-later
"""Dish values and the automatic coercion rules between them (PRD §3.1, §3.2)."""

import json
import math
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from itertools import pairwise
from typing import Literal, cast

from unichef.core.errors import UniChefError, WarningCode
from unichef.unicode import utf8

type DishType = Literal["bytes", "string", "integer", "float", "json", "codepoints", "table"]
type JsonValue = bool | int | float | str | list[JsonValue] | dict[str, JsonValue] | None
type Cell = bool | int | float | str | None
type DishValue = bytes | str | int | float | JsonValue | list[int] | Table
type WarnFn = Callable[[WarningCode, str], None]

DISH_TYPES: tuple[DishType, ...] = (
    "bytes",
    "string",
    "integer",
    "float",
    "json",
    "codepoints",
    "table",
)
MAX_CODE_POINT = 0x10FFFF
# JSON nesting deeper than this fails with E_LIMIT. The C decoder on Python 3.14+ no
# longer hits the recursion limit first, so the bound is explicit (as MAX_JSON_DEPTH in TS).
MAX_JSON_DEPTH = 900
# ECMAScript Number::toString switches to exponent form outside these bounds.
_MAX_FIXED_DIGITS = 21
_MIN_FIXED_EXPONENT = -6


@dataclass(slots=True, frozen=True)
class Table:
    """Tabular result of an analysis operation."""

    columns: tuple[str, ...]
    rows: tuple[tuple[Cell, ...], ...] = field(default=())

    def to_json(self) -> dict[str, JsonValue]:
        return {
            "columns": list(self.columns),
            "rows": [list(row) for row in self.rows],
        }


@dataclass(slots=True, frozen=True)
class Dish:
    """A typed value flowing between recipe steps."""

    type: DishType
    value: DishValue

    @staticmethod
    def of_bytes(value: bytes) -> "Dish":
        return Dish("bytes", value)

    @staticmethod
    def of_string(value: str) -> "Dish":
        return Dish("string", value)


# ---------------------------------------------------------------------------
# Number formatting (PRD §3.2 rules 4 and 6)


def format_float(x: float) -> str:
    """Format ``x`` exactly as ECMAScript ``Number.prototype.toString()`` does."""
    if math.isnan(x):
        return "NaN"
    if math.isinf(x):
        return "Infinity" if x > 0 else "-Infinity"
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    # repr() yields the shortest round-trip digits, as ECMAScript requires.
    _, digit_tuple, exponent = Decimal(repr(abs(x))).as_tuple()
    digits = "".join(map(str, digit_tuple)).rstrip("0")
    exponent = cast(int, exponent) + (len(digit_tuple) - len(digits))
    k = len(digits)
    n = exponent + k  # x = 0.digits * 10^n
    if k <= n <= _MAX_FIXED_DIGITS:
        body = digits + "0" * (n - k)
    elif 0 < n <= _MAX_FIXED_DIGITS:
        body = digits[:n] + "." + digits[n:]
    elif _MIN_FIXED_EXPONENT < n <= 0:
        body = "0." + "0" * (-n) + digits
    else:
        e = n - 1
        mantissa = digits if k == 1 else digits[0] + "." + digits[1:]
        body = f"{mantissa}e{'+' if e >= 0 else '-'}{abs(e)}"
    return sign + body


def parse_integer(text: str) -> int:
    """Parse base-10 ASCII with an optional ``-``, no ``+`` and no leading zeros."""
    body = text[1:] if text.startswith("-") else text
    if (
        not body
        or not body.isascii()
        or not body.isdigit()
        or (len(body) > 1 and body[0] == "0")
        or text == "-0"
    ):
        raise UniChefError("E_INPUT_TYPE", "The string is not a base-10 integer.")
    return int(text)


# ---------------------------------------------------------------------------
# JSON (PRD §3.2 rule 5)

_JSON_ESCAPES = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r"}
_JSON_ESCAPES["\t"] = "\\t"


def _json_string(s: str) -> str:
    out = ['"']
    for ch in s:
        esc = _JSON_ESCAPES.get(ch)
        if esc is not None:
            out.append(esc)
        elif ch < " " or "\ud800" <= ch <= "\udfff":
            out.append(f"\\u{ord(ch):04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def json_dumps(value: JsonValue) -> str:
    """Serialise compactly, in insertion order, as ECMAScript ``JSON.stringify`` does."""
    parts: list[str] = []

    def emit(v: JsonValue) -> None:
        match v:
            case None:
                parts.append("null")
            case bool():
                parts.append("true" if v else "false")
            case int():
                parts.append(str(v))
            case float():
                parts.append(format_float(v) if math.isfinite(v) else "null")
            case str():
                parts.append(_json_string(v))
            case list():
                parts.append("[")
                for i, item in enumerate(v):
                    if i:
                        parts.append(",")
                    emit(item)
                parts.append("]")
            case dict():
                parts.append("{")
                for i, (key, item) in enumerate(v.items()):
                    if i:
                        parts.append(",")
                    parts.append(_json_string(key))
                    parts.append(":")
                    emit(item)
                parts.append("}")

    emit(value)
    return "".join(parts)


def _reject_constant(name: str) -> JsonValue:
    raise ValueError(f"{name} is not valid JSON")


def json_loads(text: str, warn: WarnFn | None = None) -> JsonValue:
    """Strict RFC 8259 parse. Duplicate keys: the last wins and a warning is raised."""

    def pairs(items: list[tuple[str, JsonValue]]) -> dict[str, JsonValue]:
        out: dict[str, JsonValue] = {}
        for key, value in items:
            if key in out:
                if warn is not None:
                    warn("W_DUPLICATE_KEY", f"Duplicate JSON key {_json_string(key)[:66]}.")
                del out[key]  # the last occurrence also takes the last position
            out[key] = value
        return out

    try:
        value = cast(
            JsonValue,
            json.loads(text, object_pairs_hook=pairs, parse_constant=_reject_constant),
        )
    except ValueError as exc:
        raise UniChefError("E_INPUT_TYPE", "The string is not valid JSON.") from exc
    except RecursionError as exc:
        raise UniChefError("E_LIMIT", "The JSON value is nested too deeply.") from exc
    if _json_depth(value) > MAX_JSON_DEPTH:
        raise UniChefError("E_LIMIT", "The JSON value is nested too deeply.")
    return value


def _json_depth(value: JsonValue) -> int:
    """The container nesting depth of ``value``, without recursion (a scalar is 0)."""
    deepest = 0
    stack: list[tuple[JsonValue, int]] = [(value, 0)]
    while stack:
        item, depth = stack.pop()
        if isinstance(item, list | dict):
            depth += 1
            deepest = max(deepest, depth)
            stack.extend(
                (child, depth) for child in (item.values() if isinstance(item, dict) else item)
            )
    return deepest


# ---------------------------------------------------------------------------
# Tables

_TSV_ESCAPES = str.maketrans({"\\": "\\\\", "\t": "\\t", "\n": "\\n", "\r": "\\r"})


def format_cell(cell: Cell) -> str:
    match cell:
        case None:
            return ""
        case bool():
            return "true" if cell else "false"
        case int():
            return str(cell)
        case float():
            return format_float(cell)
        case str():
            return cell


def table_to_tsv(table: Table) -> str:
    """TSV with a header row. Backslash, tab, CR and LF inside cells are escaped."""
    lines = ["\t".join(c.translate(_TSV_ESCAPES) for c in table.columns)]
    lines.extend(
        "\t".join(format_cell(c).translate(_TSV_ESCAPES) for c in row) for row in table.rows
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Coercion graph (PRD §3.2)


def _codepoints_to_string(cps: list[int]) -> str:
    return "".join(utf8.REPLACEMENT if cp in utf8.SURROGATES else chr(cp) for cp in cps)


def _bytes_to_string(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return utf8.decode(cast(bytes, value))


def _string_to_bytes(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return utf8.encode(cast(str, value))


def _string_to_codepoints(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return [ord(ch) for ch in cast(str, value)]


def _codepoints_to_str(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return _codepoints_to_string(cast(list[int], value))


def _integer_to_string(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return str(cast(int, value))


def _string_to_integer(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return parse_integer(cast(str, value))


def _float_to_string(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return format_float(cast(float, value))


def _json_to_string(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return json_dumps(cast(JsonValue, value))


def _string_to_json(value: DishValue, warn: WarnFn | None) -> DishValue:
    return json_loads(cast(str, value), warn)


def _table_to_json(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return cast(Table, value).to_json()


def _table_to_string(value: DishValue, _warn: WarnFn | None) -> DishValue:
    return table_to_tsv(cast(Table, value))


type Converter = Callable[[DishValue, WarnFn | None], DishValue]

EDGES: dict[tuple[DishType, DishType], Converter] = {
    ("string", "bytes"): _string_to_bytes,
    ("bytes", "string"): _bytes_to_string,
    ("codepoints", "string"): _codepoints_to_str,
    ("string", "codepoints"): _string_to_codepoints,
    ("integer", "string"): _integer_to_string,
    ("string", "integer"): _string_to_integer,
    ("json", "string"): _json_to_string,
    ("string", "json"): _string_to_json,
    ("float", "string"): _float_to_string,
    ("table", "json"): _table_to_json,
    ("table", "string"): _table_to_string,
}


def _route(source: DishType, target: DishType) -> list[DishType] | None:
    """Shortest chain of coercion edges from ``source`` to ``target`` (BFS)."""
    previous: dict[DishType, DishType | None] = {source: None}
    queue: deque[DishType] = deque([source])
    while queue:
        node = queue.popleft()
        if node == target:
            chain: list[DishType] = []
            step: DishType | None = node
            while step is not None:
                chain.append(step)
                step = previous[step]
            return chain[::-1]
        for a, b in EDGES:
            if a == node and b not in previous:
                previous[b] = node
                queue.append(b)
    return None


ROUTES: dict[tuple[DishType, DishType], list[DishType] | None] = {
    (a, b): _route(a, b) for a in DISH_TYPES for b in DISH_TYPES
}


def coerce(dish: Dish, target: DishType, warn: WarnFn | None = None) -> Dish:
    """Convert ``dish`` to ``target`` by the §3.2 rules, or raise ``E_INPUT_TYPE``."""
    route = ROUTES[(dish.type, target)]
    if route is None:
        raise UniChefError("E_INPUT_TYPE", f"A {dish.type} value cannot be converted to {target}.")
    value = dish.value
    for a, b in pairwise(route):
        value = EDGES[(a, b)](value, warn)
    return Dish(target, value)
