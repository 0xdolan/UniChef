# SPDX-License-Identifier: GPL-3.0-or-later
"""Security requirements that hold across the whole Python package (PRD §5.3)."""

import ast
from pathlib import Path
from typing import Any

import pytest

import unichef
from unichef.core.dish import Dish
from unichef.core.errors import UniChefError
from unichef.core.recipe import parse_recipe
from unichef.core.runner import bake
from unichef.regex import run

SRC = Path(unichef.__file__).parent
NETWORK = {"socket", "ssl", "http", "urllib", "requests", "httpx", "ftplib", "smtplib", "asyncio"}
HEX16 = {"encoding": "hex", "value": "000102030405060708090a0b0c0d0e0f"}


def _modules() -> list[tuple[Path, ast.Module]]:
    return [(path, ast.parse(path.read_text("utf-8"))) for path in sorted(SRC.rglob("*.py"))]


def test_no_network_modules() -> None:
    """SEC-001: the package imports nothing that can open a connection."""
    found = []
    for path, tree in _modules():
        for node in ast.walk(tree):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                names = [node.module]
            found += [f"{path.relative_to(SRC)}: {n}" for n in names if n.split(".")[0] in NETWORK]
    assert found == []


def test_no_dynamic_code() -> None:
    """SEC-003: no eval, exec or compile of source text anywhere in the package."""
    found = [
        f"{path.relative_to(SRC)}:{node.lineno} {node.func.id}"
        for path, tree in _modules()
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in {"eval", "exec", "compile", "__import__"}
    ]
    assert found == []


def test_regex_timeout_and_unsupported_constructs() -> None:
    """SEC-004: a runaway search stops with E_REGEX_TIMEOUT; unsupported syntax is refused."""
    slow = run.compile_regex("(a|aa)+b")
    with pytest.raises(UniChefError) as info:
        run.search(slow, "a" * 60, 1)
    assert info.value.code == "E_REGEX_TIMEOUT"
    for pattern in ("(?>a)", "a++", "\\G"):
        with pytest.raises(UniChefError) as info:
            run.compile_regex(pattern)
        assert info.value.code == "E_REGEX_UNSUPPORTED"


def _warnings(op: str, data: bytes, **args: Any) -> list[str]:
    raw = {"version": 1, "steps": [{"op": op, "args": args}]}
    result = bake(parse_recipe(raw), Dish.of_bytes(data))
    return [w.code for w in result.warnings]


@pytest.mark.parametrize(
    ("op", "args", "insecure"),
    [
        ("md5", {}, True),
        ("sha1", {}, True),
        ("sha2", {}, False),
        ("aes-encrypt", {"key": HEX16, "mode": "ecb"}, True),
        ("aes-encrypt", {"key": HEX16, "iv": HEX16, "mode": "cbc"}, False),
        ("pbkdf2", {"iterations": 99_999, "salt": HEX16}, True),
        ("pbkdf2", {"iterations": 100_000, "salt": HEX16}, False),
    ],
)
def test_weak_crypto_warns(op: str, args: dict[str, Any], insecure: bool) -> None:
    """SEC-006: ECB, MD5, SHA-1 and PBKDF2 below 100 000 iterations warn W_INSECURE."""
    assert ("W_INSECURE" in _warnings(op, b"x" * 16, **args)) is insecure
