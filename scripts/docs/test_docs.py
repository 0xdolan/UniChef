# SPDX-License-Identifier: GPL-3.0-or-later
"""Tests for the documentation generator (FR-013).

uv run --with pytest==9.2.0 pytest scripts
"""

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("docs_build", HERE / "build.py")
assert _spec and _spec.loader
docs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(docs)


def test_fr_013_docs_are_current() -> None:
    """FR-013: every operation has a current reference page, and every link resolves."""
    run = subprocess.run(
        [sys.executable, str(HERE / "build.py")], capture_output=True, text=True, check=False
    )
    assert run.returncode == 0, run.stderr + run.stdout


@pytest.mark.parametrize(
    ("text", "shown", "py", "js", "sh"),
    [
        ("abc", "`abc`", '"abc"', '"abc"', "abc"),
        ("a\u202eb", "`a\\u202eb`", '"a\\u202eb"', '"a\\u202eb"', "$'a\\u202eb'"),
        ("x\U000e0041", "`x\\u{e0041}`", '"x\\U000e0041"', '"x\\u{e0041}"', "$'x\\U000e0041'"),
        ("it's\u200b", "`it's\\u200b`", '"it\'s\\u200b"', '"it\'s\\u200b"', "$'it\\'s\\u200b'"),
    ],
)
def test_fr_013_hidden_characters_are_escaped(
    text: str, shown: str, py: str, js: str, sh: str
) -> None:
    """FR-013: examples never put invisible characters into the docs; each language escapes."""
    assert (docs.shown(text), docs.py_str(text), docs.js_str(text), docs.sh_str(text)) == (
        shown,
        py,
        js,
        sh,
    )
    assert eval(docs.py_str(text)) == text  # noqa: S307 - a literal we just built
