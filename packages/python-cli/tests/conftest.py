# SPDX-License-Identifier: GPL-3.0-or-later
"""Shared test helpers: repository paths and the spec/vectors dish format."""

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

from unichef.core.dish import Dish, DishValue, JsonValue, Table

REPO = Path(__file__).resolve().parents[3]
SPEC = REPO / "spec"
VECTORS = SPEC / "vectors"
UCD_DIR = REPO / "data" / "ucd"


def ucd_version() -> str:
    constants = json.loads((REPO / "project.constants.json").read_text(encoding="utf-8"))
    return str(constants["UCD_VERSION"])


def vector_files() -> list[Path]:
    return sorted(VECTORS.glob("*/*.json"))


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _table(value: dict[str, Any]) -> Table:
    return Table(tuple(value["columns"]), tuple(tuple(r) for r in value["rows"]))


_DISH_BUILDERS: dict[str, Callable[[dict[str, Any]], object]] = {
    "bytes": lambda raw: bytes.fromhex(raw["hex"]),
    "string": lambda raw: raw["text"],
    "codepoints": lambda raw: list(raw["values"]),
    "integer": lambda raw: int(raw["value"]),
    "float": lambda raw: float(raw["value"]),
    "json": lambda raw: cast(JsonValue, raw["value"]),
    "table": lambda raw: _table(raw["value"]),
}


def dish_from_vector(raw: dict[str, Any]) -> Dish:
    """Build a dish from the vector form in spec/README.md."""
    kind = raw["type"]
    if kind not in _DISH_BUILDERS:
        raise ValueError(f"unknown dish type {kind}")
    return Dish(kind, cast(DishValue, _DISH_BUILDERS[kind](raw)))
