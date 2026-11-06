# SPDX-License-Identifier: GPL-3.0-or-later
"""Shared test helpers: repository paths, the spec/vectors dish format and the CLI harness.

This is the only conftest: tests import it as ``conftest``, so a second one would shadow it.
"""

import io
import json
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import pytest

from unichef.cli.main import run
from unichef.cli.session import Streams
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


# -- CLI harness: run ``unichef`` in-process with in-memory streams ------------------------

ENVELOPE_KEYS = {"unichef", "ucd", "command", "ok", "result", "warnings", "error", "timing_ms"}
DISH_TYPES = {"bytes", "string", "integer", "float", "json", "codepoints", "table"}


@dataclass
class Result:
    code: int
    stdout: bytes
    stderr: str

    @property
    def out(self) -> str:
        return self.stdout.decode("utf-8")

    def json(self) -> dict[str, Any]:
        doc: dict[str, Any] = json.loads(self.stdout)
        check_envelope(doc)
        return doc


def check_envelope(doc: dict[str, Any]) -> None:
    """A hand-written check of spec/output.schema.json's main rules."""
    assert set(doc) == ENVELOPE_KEYS
    assert re.fullmatch(r"\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?", doc["unichef"])
    assert re.fullmatch(r"\d+\.\d+\.\d+", doc["ucd"])
    assert isinstance(doc["command"], str) and doc["command"]
    assert isinstance(doc["timing_ms"], int) and doc["timing_ms"] >= 0
    assert isinstance(doc["warnings"], list)
    for warning in doc["warnings"]:
        assert set(warning) <= {"code", "message", "path"}
        assert warning["code"].startswith("W_")
    if doc["ok"]:
        assert doc["error"] is None
        result = doc["result"]
        assert result is None or result["type"] in DISH_TYPES
        if result is not None and result["type"] == "bytes":
            assert set(result) == {"type", "base64"}
        elif result is not None:
            assert set(result) == {"type", "value"}
    else:
        assert doc["result"] is None
        assert re.fullmatch(r"E_[A-Z_]+", doc["error"]["code"])
        assert isinstance(doc["error"]["message"], str)


type Cli = Callable[..., Result]


@pytest.fixture
def cli() -> Cli:
    def invoke(
        *argv: str,
        stdin: bytes | str = b"",
        env: Mapping[str, str] | None = None,
        tty: bool = False,
        stdin_tty: bool = False,
    ) -> Result:
        data = stdin.encode("utf-8") if isinstance(stdin, str) else stdin
        out, err = io.BytesIO(), io.BytesIO()
        streams = Streams(
            io.BytesIO(data),
            out,
            err,
            environ=dict(env or {}),
            stdin_tty=stdin_tty,
            stdout_tty=tty,
            stderr_tty=tty,
        )
        code = run(list(argv), streams)
        return Result(code, out.getvalue(), err.getvalue().decode("utf-8"))

    return invoke
