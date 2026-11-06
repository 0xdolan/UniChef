# SPDX-License-Identifier: GPL-3.0-or-later
"""inspect, char, search, block and script (PRD §5.3)."""

from typing import Any

import pytest

from conftest import Cli
from unichef.cli.commands.characters import parse_char
from unichef.core.errors import UniChefError

PLAIN = {"NO_COLOR": "1", "COLUMNS": "400"}


def rows(doc: dict[str, Any]) -> list[list[Any]]:
    value: list[list[Any]] = doc["result"]["value"]["rows"]
    return value


def columns(doc: dict[str, Any]) -> list[str]:
    value: list[str] = doc["result"]["value"]["columns"]
    return value


def test_inspect_json_keeps_every_column(cli: Cli) -> None:
    doc = cli("inspect", "hé", "--format", "json").json()
    assert "decomposition" in columns(doc)
    assert [r[columns(doc).index("cp")] for r in rows(doc)] == ["U+0068", "U+00E9"]


def test_inspect_table_is_compact(cli: Cli) -> None:
    out = cli("inspect", "hé", "--format", "table", env=PLAIN).out
    assert "LATIN SMALL LETTER E WITH ACUTE" in out
    assert "decomposition" not in out


def test_inspect_graphemes(cli: Cli) -> None:
    doc = cli("inspect", "e\u0301x", "--granularity", "grapheme", "--format", "json").json()
    assert len(rows(doc)) == 2


def test_inspect_stdin_raw(cli: Cli) -> None:
    out = cli("inspect", stdin="A").out
    assert out.splitlines()[0].startswith("index\t")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("A", 0x41),
        ("U+00E9", 0xE9),
        ("u+1f600", 0x1F600),
        ("0x41", 0x41),
        ("\\u0041", 0x41),
        ("65", 65),
        ("latin small letter a", 0x61),
        ("é", 0xE9),
    ],
)
def test_parse_char(text: str, expected: Any) -> None:
    assert parse_char(text) == expected


@pytest.mark.parametrize("text", ["U+110000", "NO SUCH CHARACTER NAME", ""])
def test_parse_char_rejects(text: str) -> None:
    with pytest.raises(UniChefError) as info:
        parse_char(text)
    assert info.value.code in {"E_ARG_INVALID", "E_USAGE"}


def test_char_json(cli: Cli) -> None:
    doc = cli("char", "U+0041", "--format", "json").json()
    assert dict(rows(doc))["name"] == "LATIN CAPITAL LETTER A"


def test_char_panel_and_aliases(cli: Cli) -> None:
    out = cli("char", "U+0000", "--format", "table", env=PLAIN).out
    assert "NULL" in out
    assert "U+0000" in out


def test_char_unknown(cli: Cli) -> None:
    result = cli("char", "U+110000", "--format", "json")
    assert result.code == 1
    assert result.json()["error"]["code"] == "E_ARG_INVALID"


def test_search_words(cli: Cli) -> None:
    doc = cli("search", "latin small letter a with", "--limit", "3", "--format", "json").json()
    assert len(rows(doc)) == 3


def test_search_query_and_truncation_notice(cli: Cli) -> None:
    result = cli("search", "gc=Lu & sc=Grek", "--limit", "2")
    assert "Showing 2 of" in result.stderr
    assert "GREEK" in result.out


def test_search_nothing(cli: Cli) -> None:
    result = cli("search", "zzzqqq nothing", "--format", "table", env=PLAIN)
    assert "No characters match" in result.out


def test_search_bad_query(cli: Cli) -> None:
    assert cli("search", "gc=", "--format", "json").code == 1


def test_block_list(cli: Cli) -> None:
    doc = cli("block", "list", "--format", "json").json()
    assert ["U+0000", "U+007F", "Basic Latin"] in rows(doc)


def test_block_show(cli: Cli) -> None:
    doc = cli("block", "show", "basic_latin", "--format", "json").json()
    assert len(rows(doc)) == 128


def test_block_show_grid(cli: Cli) -> None:
    doc = cli("block", "show", "Basic Latin", "--grid", "--format", "json").json()
    assert columns(doc)[0] == "row"
    assert len(rows(doc)) == 8
    out = cli("block", "show", "Basic Latin", "--grid", "--format", "table", env=PLAIN).out
    assert "U+004x" in out or "U+004X" in out


def test_block_show_unknown(cli: Cli) -> None:
    result = cli("block", "show", "Nowhere Land")
    assert result.code == 1


def test_block_requires_action(cli: Cli) -> None:
    assert cli("block").code == 2


def test_script_list(cli: Cli) -> None:
    doc = cli("script", "list", "--format", "json").json()
    codes = [r[0] for r in rows(doc)]
    assert "Latn" in codes and "Grek" in codes


def test_script_show(cli: Cli) -> None:
    result = cli("script", "show", "Greek", "--limit", "3", "--format", "json")
    assert len(rows(result.json())) == 3
    assert "Showing 3 of" in result.stderr


def test_script_show_table(cli: Cli) -> None:
    out = cli("script", "show", "Grek", "--limit", "2", "--format", "table", env=PLAIN).out
    assert "GREEK" in out


def test_script_unknown(cli: Cli) -> None:
    assert cli("script", "show", "Klingon").code == 1
