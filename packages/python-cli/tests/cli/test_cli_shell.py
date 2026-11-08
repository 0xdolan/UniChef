# SPDX-License-Identifier: GPL-3.0-or-later
"""Help, man page, envelope and the real ``python -m unichef`` process (PRD §5.2, §5.4-5.7)."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import Cli
from unichef.__main__ import fast_version
from unichef.cli.envelope import dish_json, dumps, envelope
from unichef.cli.manpage import render
from unichef.core.dish import Dish, Table
from unichef.core.errors import UniChefError

PLAIN = {"NO_COLOR": "1", "COLUMNS": "120"}


# -- help ----------------------------------------------------------------------------------


def test_no_command_prints_root_help(cli: Cli) -> None:
    result = cli(env=PLAIN)
    assert result.code == 0
    assert result.out.startswith("unichef ")
    assert "bake" in result.out and "scan" in result.out


def test_root_help_rich(cli: Cli) -> None:
    out = cli("--help", tty=True, env={"FORCE_COLOR": "1", "COLUMNS": "120"}).out
    assert "\x1b[" in out and "bake" in out


@pytest.mark.parametrize("flag", ["-h", "--help"])
def test_command_help(cli: Cli, flag: str) -> None:
    result = cli("op", flag, env=PLAIN)
    assert result.code == 0
    assert "--arg" in result.out


def test_command_help_rich(cli: Cli) -> None:
    out = cli("scan", "--help", tty=True, env={"FORCE_COLOR": "1", "COLUMNS": "120"}).out
    assert "--fail-on" in out


def test_subcommand_help(cli: Cli) -> None:
    assert "import-cyberchef" in cli("recipe", "--help", env=PLAIN).out
    assert cli("block", "show", "--help", env=PLAIN).code == 0


def test_unknown_command_is_usage_error(cli: Cli) -> None:
    result = cli("nosuch", "--format", "json")
    assert result.code == 2


def test_unknown_flag(cli: Cli) -> None:
    assert cli("op", "md5", "--bogus").code == 2


# -- man page ------------------------------------------------------------------------------


def test_manpage() -> None:
    page = render(date="2026-01-01")
    assert page.startswith('.TH UNICHEF 1 "2026-01-01"')
    for section in ("NAME", "SYNOPSIS", "COMMANDS", "EXIT STATUS", "ENVIRONMENT"):
        assert f".SH {section}" in page
    assert "import\\-cyberchef" in page or "import-cyberchef" in page


def test_manpage_default_date() -> None:
    assert render().startswith(".TH UNICHEF 1 ")


# -- envelope ------------------------------------------------------------------------------


def test_envelope_bigint_and_floats() -> None:
    doc = dish_json(Dish("json", {"big": 2**64, "small": 3, "inf": float("inf"), "l": [1, 2]}))
    assert doc == {
        "type": "json",
        "value": {"big": str(2**64), "small": 3, "inf": "inf", "l": [1, 2]},
    }


def test_envelope_bytes_and_table() -> None:
    assert dish_json(Dish.of_bytes(b"\x00")) == {"type": "bytes", "base64": "AA=="}
    table = dish_json(Dish("table", Table(("a",), ((1,),))))
    assert table == {"type": "table", "value": {"columns": ["a"], "rows": [[1]]}}


def test_envelope_error_drops_result() -> None:
    doc = envelope(
        "x", result=Dish.of_string("y"), error=UniChefError("E_USAGE", "bad"), timing_ms=-3
    )
    assert doc["result"] is None and doc["ok"] is False and doc["timing_ms"] == 0


def test_dumps_lone_surrogate() -> None:
    out = dumps({"s": "\ud800"})
    assert out.endswith(b"\n")
    assert json.loads(out)["s"] == "\ud800"


# -- fast path -----------------------------------------------------------------------------


def test_fast_version(capsysbinary: pytest.CaptureFixture[bytes]) -> None:
    assert fast_version(["version"]) is True
    assert capsysbinary.readouterr().out.startswith(b"unichef ")
    assert fast_version(["version", "--format", "json"]) is False


# -- subprocess ----------------------------------------------------------------------------


def unichef(*argv: str, stdin: bytes = b"", **env: str) -> subprocess.CompletedProcess[bytes]:
    environ = {k: v for k, v in os.environ.items() if k not in {"NO_COLOR", "FORCE_COLOR"}}
    return subprocess.run(
        [sys.executable, "-m", "unichef", *argv],
        input=stdin,
        capture_output=True,
        env={**environ, **env},
        check=False,
        timeout=60,
    )


def test_process_version() -> None:
    result = unichef("--version")
    assert result.returncode == 0
    assert result.stdout.startswith(b"unichef ")


_PROBE = """
import sys
from unichef.__main__ import main
sys.argv = ["unichef", *sys.argv[1:]]
try:
    main()
except SystemExit:
    pass
data = sys.modules.get("unichef.unicode.data")
loaded = data.load.cache_info().currsize if data else 0
sys.stderr.write(f"\\nPROBE {loaded} {int('rich' in sys.modules)}\\n")
"""


@pytest.mark.parametrize(
    ("argv", "rich"),
    [
        (["version"], 0),
        (["version", "--format", "json"], 1),
        (["--help"], 1),
        (["op", "to-hex", "abc"], 1),
        (["op", "sha2", "abc"], 1),
    ],
)
def test_commands_that_need_no_ucd_do_not_load_it(argv: list[str], rich: int) -> None:
    """NFR-005: the UCD loads lazily, and a bare ``version`` skips Rich as well."""
    result = subprocess.run(
        [sys.executable, "-c", _PROBE, *argv], capture_output=True, check=False, timeout=60
    )
    probe = result.stderr.decode().rsplit("PROBE ", 1)[1].split()
    assert probe == ["0", str(rich)]


def test_process_pipeline() -> None:
    result = unichef("op", "to-base64", stdin=b"foo")
    assert (result.returncode, result.stdout) == (0, b"Zm9v")


def test_process_binary_roundtrip() -> None:
    data = bytes(range(256))
    encoded = unichef("op", "to-base64", stdin=data).stdout
    assert unichef("op", "from-base64", stdin=encoded).stdout == data


def test_process_no_color() -> None:
    result = unichef("op", "count", "abc", "--format", "table", NO_COLOR="1")
    assert b"\x1b[" not in result.stdout


def test_process_exit_codes(tmp_path: Path) -> None:
    assert unichef("op", "nosuch", "x").returncode == 4
    assert unichef("op", "md5", "-i", str(tmp_path / "missing")).returncode == 3
    assert unichef("op", "md5", "--nope").returncode == 2
    (tmp_path / "f.txt").write_text("a\u202eb", encoding="utf-8")
    scan = unichef("scan", str(tmp_path), "--fail-on", "bidi", "--format", "json")
    assert scan.returncode == 6
    assert json.loads(scan.stdout)["error"]["code"] == "E_SCAN_FINDINGS"
