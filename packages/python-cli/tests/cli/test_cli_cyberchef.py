# SPDX-License-Identifier: GPL-3.0-or-later
"""CyberChef recipe import (PRD §5.3 recipe import-cyberchef)."""

import json
from importlib import resources
from pathlib import Path
from typing import Any, cast

import pytest

from conftest import SPEC, Cli
from unichef.cli.cyberchef import import_recipe, parse, table
from unichef.core.errors import UniChefError
from unichef.core.recipe import parse_recipe
from unichef.core.registry import get_operation

MAP = SPEC / "cyberchef-map.json"
VECTORS = json.loads((SPEC / "cyberchef-vectors.json").read_text(encoding="utf-8"))["cases"]


def steps(recipe: list[dict[str, Any]]) -> list[dict[str, Any]]:
    doc = cast(dict[str, Any], import_recipe(json.dumps(recipe)))
    parse_recipe(doc)  # every import is a valid UniChef recipe
    return cast(list[dict[str, Any]], doc["steps"])


def one(name: str, *args: Any) -> dict[str, Any]:
    (step,) = steps([{"op": name, "args": list(args)}])
    return step


def test_packaged_map_matches_spec() -> None:
    packaged = resources.files("unichef").joinpath("_data/cyberchef-map.json").read_text("utf-8")
    assert json.loads(packaged) == json.loads(MAP.read_text(encoding="utf-8"))


def test_every_mapped_op_exists() -> None:
    for name, entry in table()["operations"].items():
        if not entry.get("merge"):
            assert get_operation(entry["op"]).id == entry["op"], name


@pytest.mark.parametrize("case", VECTORS, ids=[c["name"] for c in VECTORS])
def test_fr009_shared_vectors(case: dict[str, Any]) -> None:
    """Both cores import spec/cyberchef-vectors.json the same way (FR-009)."""
    if "error" in case:
        with pytest.raises(UniChefError) as info:
            import_recipe(case["input"])
        assert info.value.code == case["error"]["code"]
        assert (info.value.detail or None) == case["error"].get("detail")
    else:
        doc = import_recipe(case["input"])
        assert doc == case["output"]
        parse_recipe(doc)


# -- parsing -------------------------------------------------------------------------------


def test_parse_json() -> None:
    assert parse('[{"op":"MD5","args":[]}]') == [{"op": "MD5", "args": []}]


def test_parse_chef_format() -> None:
    text = (
        "To_Hex('Space',0)/disabled\n"
        "Find_/_Replace({'option':'Regex','string':'a\\u0041\\x42'},\"b\\n\",true,false,true,false)"
        "/breakpoint XOR({'option':'Hex','string':'01'},'Standard',false)"
        "Label([1,-2.5,null])"
    )
    parsed: list[Any] = parse(text)
    assert parsed[0] == {"op": "To Hex", "args": ["Space", 0], "disabled": True}
    assert parsed[1]["op"] == "Find / Replace"
    assert parsed[1]["args"][0] == {"option": "Regex", "string": "aAB"}
    assert parsed[1]["args"][1] == "b\n"
    assert parsed[1]["breakpoint"] is True
    assert parsed[3]["args"] == [[1, -2.5, None]]


@pytest.mark.parametrize(
    "text",
    ["", "   ", "[1]", '[{"args":[]}]', '{"op":"MD5"}', "MD5", "MD5(", "MD5('x", "MD5(@)", "["],
)
def test_parse_errors(text: str) -> None:
    with pytest.raises(UniChefError) as info:
        parse(text)
    assert info.value.code == "E_RECIPE_SCHEMA"


# -- translators ---------------------------------------------------------------------------


def test_map_and_fallback() -> None:
    assert one("To Base64", "A-Za-z0-9-_") == {"op": "to-base64", "args": {"alphabet": "url"}}
    custom = one("To Base64", "abc")
    assert custom["args"] == {"alphabet": "custom", "custom": "abc"}


def test_map_without_equivalent() -> None:
    with pytest.raises(UniChefError, match="no UniChef equivalent"):
        one("To Hex", "Tab")


def test_expect_and_ignore() -> None:
    assert one("SHA2", "256", 64)["args"] == {"size": "256"}
    with pytest.raises(UniChefError, match="only"):
        one("Head", "Comma", 3)


def test_integer_and_divide() -> None:
    assert one("Head", "Line feed", "4")["args"] == {"count": 4}
    assert one("BLAKE2b", "256", "Hex")["args"] == {"size": 32}
    with pytest.raises(UniChefError, match="multiple of 8"):
        one("BLAKE2b", "250")
    with pytest.raises(UniChefError, match="expected a number"):
        one("Head", "Line feed", "lots")


def test_invert_and_unescape() -> None:
    assert one("From Base32", "A-Z2-7=", True)["args"] == {"alphabet": "rfc4648", "strict": False}
    assert one("Split", "\\t", "\\n")["args"]["delimiter"] == "\t"


def test_bytes_toggle_and_fixed_encoding() -> None:
    assert one("XOR", {"option": "Hex", "string": "0a"}, "Standard", False)["args"]["key"] == {
        "encoding": "hex",
        "value": "0a",
    }
    assert one("JWT Sign", "secret", "HS256", "{}")["args"] == {
        "key": {"encoding": "utf8", "value": "secret"},
        "algorithm": "HS256",
        "header": "",
    }
    with pytest.raises(UniChefError, match="unsupported key format"):
        one("XOR", {"option": "Decimal", "string": "1"})
    with pytest.raises(UniChefError, match="option, string"):
        one("XOR", "plain")


def test_before_after_and_set() -> None:
    key = {"option": "Hex", "string": "00" * 16}
    out = steps([{"op": "AES Encrypt", "args": [key, key, "CBC/NoPadding", "Hex", "Hex"]}])
    assert [s["op"] for s in out] == ["from-hex", "aes-encrypt", "to-hex"]
    assert out[1]["args"]["mode"] == "cbc"
    assert out[1]["args"]["padding"] == "none"


def test_find_replace_options_and_flags() -> None:
    regex = one("Find / Replace", {"option": "Regex", "string": "a+"}, "b", True, True, False, True)
    assert regex["args"] == {
        "pattern": "a+",
        "literal": False,
        "replacement": "b",
        "global": True,
        "flags": "is",
    }
    ext = one("Find / Replace", {"option": "Extended (\\n, \\t, \\x...)", "string": "\\t"}, "")
    assert ext["args"]["pattern"] == "\t" and ext["args"]["literal"] is True
    simple = one("Find / Replace", {"option": "Simple string", "string": "."}, "")
    assert simple["args"]["literal"] is True
    with pytest.raises(UniChefError):
        one("Find / Replace", "a")


def test_extract() -> None:
    assert one("Encode text", "UTF-16LE (1200)")["args"] == {"encoding": "utf-16le"}


def test_too_many_args_and_bad_args() -> None:
    with pytest.raises(UniChefError, match="at most"):
        one("MD5", 1)
    with pytest.raises(UniChefError, match="must be an array"):
        import_recipe('[{"op":"MD5","args":{}}]')


def test_unknown_operations() -> None:
    with pytest.raises(UniChefError) as info:
        import_recipe('[{"op":"Magic","args":[]},{"op":"Zlib Deflate","args":[]}]')
    assert info.value.code == "E_OP_UNKNOWN"
    assert info.value.detail == {"operations": ["Magic", "Zlib Deflate"]}


def test_scopes_and_merge() -> None:
    out = steps(
        [
            {"op": "Fork", "args": ["\\n", "\\n", False]},
            {"op": "MD5", "args": []},
            {"op": "Merge", "args": []},
            {"op": "To Upper case", "args": ["All"], "disabled": True, "breakpoint": True},
        ]
    )
    assert out[0] == {
        "op": "fork",
        "args": {"split": "\n", "merge": "\n", "steps": [{"op": "md5"}]},
    }
    assert out[1]["disabled"] is True and out[1]["breakpoint"] is True


def test_cli_import(cli: Cli, tmp_path: Path) -> None:
    path = tmp_path / "chef.txt"
    path.write_text("To_Base64('A-Za-z0-9+/=')", encoding="utf-8")
    out = cli("recipe", "import-cyberchef", str(path)).out
    assert json.loads(out) == {
        "version": 1,
        "steps": [{"op": "to-base64", "args": {"alphabet": "standard"}}],
    }
    doc = cli("recipe", "import-cyberchef", "-", "--format", "json", stdin="Magic()").json()
    assert doc["error"]["code"] == "E_OP_UNKNOWN"
