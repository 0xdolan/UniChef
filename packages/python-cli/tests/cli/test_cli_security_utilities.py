# SPDX-License-Identifier: GPL-3.0-or-later
"""scan, ucd, completion and version (PRD §5.3, §5.7)."""

import platform
from pathlib import Path
from typing import Any

import pytest

from conftest import Cli
from unichef.cli.about import semver, version_line
from unichef.cli.commands.security import parse_kinds, walk

PLAIN = {"NO_COLOR": "1", "COLUMNS": "400"}


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.py").write_text("ok = 1\nx = 'a\u202eb'\n", encoding="utf-8")
    (tmp_path / "src" / "b.txt").write_text("p\u0430ypal\nzero\u200bwidth\n", encoding="utf-8")
    (tmp_path / "src" / "c.bin").write_bytes(b"\x00\x01\x02\xe2\x80\xae")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "x.txt").write_text("\u202e", encoding="utf-8")
    (tmp_path / "clean.txt").write_text("plain ascii\n", encoding="utf-8")
    return tmp_path


def kinds(doc: dict[str, Any]) -> list[str]:
    table = doc["result"]["value"]
    index = table["columns"].index("kind")
    return sorted({row[index] for row in table["rows"]})


def test_scan_finds_everything(cli: Cli, tree: Path) -> None:
    result = cli("scan", str(tree), "--format", "json")
    assert result.code == 0
    doc = result.json()
    assert kinds(doc) == ["bidi", "confusable", "invisible", "mixed-script"]
    paths = {row[0] for row in doc["result"]["value"]["rows"]}
    assert not any(".git" in p or "c.bin" in p for p in paths)


def test_scan_fail_on(cli: Cli, tree: Path) -> None:
    result = cli("scan", str(tree), "--fail-on", "bidi", "--format", "json")
    assert result.code == 6
    doc = result.json()
    assert doc["error"]["code"] == "E_SCAN_FINDINGS"
    assert doc["error"]["detail"]["findings"]["rows"]


def test_scan_fails_ci_on_bidi_and_invisible(cli: Cli, tree: Path) -> None:
    """FR-004: `unichef scan --fail-on bidi,invisible src/` exits 6 with JSON findings."""
    result = cli("scan", "--fail-on", "bidi,invisible", str(tree / "src"), "--format", "json")
    assert result.code == 6
    findings = result.json()["error"]["detail"]["findings"]
    kind = findings["columns"].index("kind")
    assert {row[kind] for row in findings["rows"]} >= {"bidi", "invisible"}


def test_scan_fail_on_table_still_prints(cli: Cli, tree: Path) -> None:
    result = cli("scan", str(tree), "--fail-on", "bidi,invisible", "--format", "table", env=PLAIN)
    assert result.code == 6
    assert "RIGHT-TO-LEFT OVERRIDE" in result.out


def test_scan_fail_on_absent_kind(cli: Cli, tree: Path) -> None:
    result = cli("scan", str(tree / "src" / "a.py"), "--fail-on", "confusable")
    assert result.code == 0


def test_scan_include_exclude(cli: Cli, tree: Path) -> None:
    doc = cli("scan", str(tree), "--include", "*.py", "--format", "json").json()
    assert kinds(doc) == ["bidi"]
    doc = cli("scan", str(tree), "--exclude", "src/*", "--format", "json").json()
    assert doc["result"]["value"]["rows"] == []


def test_scan_stdin(cli: Cli) -> None:
    doc = cli("scan", "-", "--format", "json", stdin="a\u200bb").json()
    assert kinds(doc) == ["invisible"]


def test_scan_clean_table(cli: Cli, tree: Path) -> None:
    result = cli("scan", str(tree / "clean.txt"), "--format", "table", env=PLAIN)
    assert result.code == 0
    assert "0 finding" in result.stderr


def test_scan_missing_path(cli: Cli, tmp_path: Path) -> None:
    assert cli("scan", str(tmp_path / "nope")).code == 3


def test_scan_bad_kind(cli: Cli, tree: Path) -> None:
    assert cli("scan", str(tree), "--fail-on", "nonsense").code == 2


def test_parse_kinds() -> None:
    assert parse_kinds("bidi, invisible") == frozenset({"bidi", "invisible"})


def test_walk_is_stable_and_skips_vcs(tree: Path) -> None:
    files = list(walk([str(tree)], [], []))
    assert files == list(walk([str(tree)], [], []))
    assert not any(".git" in Path(f).parts for f in files)
    assert list(walk(["-"], [], [])) == ["-"]


def test_ucd_info(cli: Cli) -> None:
    doc = cli("ucd", "info", "--format", "json").json()
    info = dict(doc["result"]["value"]["rows"])
    assert info["unicode"] == "18.0.0"
    assert doc["command"] == "ucd info"


def test_version(cli: Cli) -> None:
    assert cli("version").out == version_line() + "\n" or cli("version").out == version_line()
    doc = cli("version", "--format", "json").json()
    assert doc["result"]["value"] == {
        "unichef": semver(),
        "ucd": "18.0.0",
        "python": platform.python_version(),
    }


def test_root_version_flag(cli: Cli) -> None:
    assert "unichef" in cli("--version").out


@pytest.mark.parametrize(
    ("pep440", "expected"),
    [("0.1.0a1", "0.1.0-alpha.1"), ("1.2.3", "1.2.3"), ("1.0.0rc2", "1.0.0-rc.2"), ("x", "x")],
)
def test_semver(pep440: str, expected: Any) -> None:
    assert semver(pep440) == expected


@pytest.mark.parametrize("shell", ["bash", "zsh", "fish", "powershell"])
def test_completion(cli: Cli, shell: str) -> None:
    out = cli("completion", shell).out
    assert "unichef" in out
    assert "ops --ids" in out
    assert "--format" in out or "format" in out
    assert "import-cyberchef" in out


def test_completion_bad_shell(cli: Cli) -> None:
    assert cli("completion", "tcsh").code == 2
