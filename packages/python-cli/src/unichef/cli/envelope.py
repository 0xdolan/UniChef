# SPDX-License-Identifier: GPL-3.0-or-later
"""The JSON output envelope (PRD §5.6, spec/output.schema.json)."""

import base64
import json
import math
from collections.abc import Sequence

from unichef.cli.about import semver
from unichef.core.dish import Dish, JsonValue, Table
from unichef.core.errors import RunWarning, UniChefError
from unichef.unicode.version import UCD_VERSION

JS_SAFE_INTEGER = 2**53 - 1


def _plain(value: object) -> JsonValue:
    """Make a value JSON-safe: big integers become strings, non-finite floats strings."""
    match value:
        case bool() | None | str():
            return value
        case int():
            return value if abs(value) <= JS_SAFE_INTEGER else str(value)
        case float():
            return value if math.isfinite(value) else repr(value)
        case dict():
            return {str(k): _plain(v) for k, v in value.items()}
        case list() | tuple():
            return [_plain(v) for v in value]
        case _:
            return str(value)


def table_json(table: Table) -> dict[str, JsonValue]:
    return {"columns": list(table.columns), "rows": [_plain(list(row)) for row in table.rows]}


def dish_json(dish: Dish) -> dict[str, JsonValue]:
    """A dish in the envelope's ``result`` form."""
    value = dish.value
    if isinstance(value, bytes):
        return {"type": "bytes", "base64": base64.b64encode(value).decode("ascii")}
    if isinstance(value, Table):
        return {"type": "table", "value": table_json(value)}
    return {"type": dish.type, "value": _plain(value)}


def envelope(
    command: str,
    *,
    result: Dish | None,
    warnings: Sequence[RunWarning] = (),
    error: UniChefError | None = None,
    timing_ms: int = 0,
) -> dict[str, JsonValue]:
    return {
        "unichef": semver(),
        "ucd": UCD_VERSION,
        "command": command,
        "ok": error is None,
        "result": None if result is None or error is not None else dish_json(result),
        "warnings": [_plain(w.to_json()) for w in warnings],
        "error": None if error is None else _plain(error.to_json()),
        "timing_ms": max(0, timing_ms),
    }


def dumps(document: JsonValue) -> bytes:
    """UTF-8 JSON plus a newline. Lone surrogates fall back to ASCII escapes."""
    try:
        return (json.dumps(document, ensure_ascii=False) + "\n").encode("utf-8")
    except UnicodeEncodeError:
        return (json.dumps(document) + "\n").encode("ascii")
