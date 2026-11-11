# SPDX-License-Identifier: GPL-3.0-or-later
"""bake, op, ops, recipe and regex (PRD §5.3)."""

import base64
import json
from pathlib import Path
from typing import Any

import pytest

from conftest import VECTORS, Cli, load_json
from unichef.cli.commands.transform import convert_arg, format_recipe
from unichef.core.errors import UniChefError
from unichef.core.registry import ArgSpec, get_operation


def spec(op: str, name: str) -> ArgSpec:
    found = get_operation(op).arg(name)
    assert found is not None
    return found


RECIPE = {
    "version": 1,
    "name": "demo",
    "steps": [
        {"op": "to-base64"},
        {"op": "label", "args": {"name": "x"}, "breakpoint": True},
        {"op": "to-hex", "args": {"delimiter": "none"}},
    ],
}


@pytest.fixture
def recipe(tmp_path: Path) -> Path:
    path = tmp_path / "r.json"
    path.write_text(json.dumps(RECIPE), encoding="utf-8")
    return path


# -- op ------------------------------------------------------------------------------------


def test_op_raw(cli: Cli) -> None:
    result = cli("op", "to-base64", "--format", "raw", stdin=b"foo")
    assert (result.code, result.out) == (0, "Zm9v")


def test_op_newline_and_text_argument(cli: Cli) -> None:
    assert cli("op", "to-base64", "foo", "--newline").out == "Zm9v\n"


def test_op_args(cli: Cli) -> None:
    result = cli("op", "to-hex", "hé", "--arg", "delimiter=colon", "--arg", "case=upper")
    assert result.out == "68:C3:A9"


def test_op_bytes_arg_with_prefix(cli: Cli) -> None:
    result = cli("op", "xor", "--arg", "key=hex:01", "--format", "json", stdin=b"\x00\x01")
    doc = result.json()
    assert doc["result"] == {"type": "bytes", "base64": base64.b64encode(b"\x01\x00").decode()}


def test_op_arg_json(cli: Cli) -> None:
    result = cli("op", "head", "--arg-json", '{"count": 1}', stdin="a\nb\n")
    assert result.out == "a\n"


def test_op_bad_arg_json(cli: Cli) -> None:
    result = cli("op", "head", "--arg-json", "[1]", stdin="a")
    assert result.code == 2
    assert "E_USAGE" in result.stderr


def test_op_bad_arg_pair(cli: Cli) -> None:
    result = cli("op", "head", "--arg", "count", stdin="a")
    assert result.code == 2


def test_op_unknown_arg(cli: Cli) -> None:
    result = cli("op", "to-base64", "--arg", "bogus=1", "--format", "json", stdin="x")
    assert result.code == 1
    assert result.json()["error"]["code"] == "E_ARG_INVALID"


def test_op_unknown(cli: Cli) -> None:
    result = cli("op", "nosuch", "x", "--format", "json")
    assert result.code == 4
    assert result.json()["command"] == "op"


def test_op_warning(cli: Cli) -> None:
    result = cli("op", "md5", "--format", "json", stdin="x")
    doc = result.json()
    assert doc["warnings"][0]["code"] == "W_INSECURE"
    plain = cli("op", "md5", stdin="x")
    assert "warning[W_INSECURE]" in plain.stderr
    assert "W_INSECURE" not in cli("op", "md5", "-q", stdin="x").stderr


def test_op_table_on_tty(cli: Cli) -> None:
    result = cli("op", "to-base64", "foo", tty=True, env={"NO_COLOR": "1"})
    assert "Zm9v" in result.out
    assert "\x1b[" not in result.out


def test_op_forced_colour(cli: Cli) -> None:
    result = cli("op", "analyse-characters", "a", "--format", "table", env={"FORCE_COLOR": "1"})
    assert "\x1b[" in result.out


def test_op_no_input_on_tty(cli: Cli) -> None:
    result = cli("op", "to-base64", stdin_tty=True)
    assert result.code == 2


def test_op_input_file_and_output_file(cli: Cli, tmp_path: Path) -> None:
    src = tmp_path / "in.bin"
    src.write_bytes(bytes(range(256)))
    dst = tmp_path / "out.bin"
    assert cli("op", "reverse", "--arg", "unit=bytes", "-i", str(src), "-o", str(dst)).code == 0
    assert dst.read_bytes() == bytes(range(255, -1, -1))


def test_input_missing_file(cli: Cli, tmp_path: Path) -> None:
    result = cli("op", "md5", "-i", str(tmp_path / "nope"), "--format", "json")
    assert result.code == 3
    assert result.json()["error"]["code"] == "E_INPUT_IO"


def test_input_limit(cli: Cli) -> None:
    result = cli("op", "md5", "--max-input-size", "4", stdin=b"12345")
    assert result.code == 1
    assert "E_LIMIT" in result.stderr


def test_bad_size(cli: Cli) -> None:
    assert cli("op", "md5", "--max-input-size", "lots", stdin=b"1").code == 2


@pytest.mark.parametrize(
    ("encoding", "data", "expected"),
    [("hex", b"6869", "aGk="), ("base64", b"aGk=", "aGk="), ("utf-8", "hi", "aGk=")],
)
def test_input_encodings(cli: Cli, encoding: str, data: bytes | str, expected: Any) -> None:
    assert cli("--input-encoding", encoding, "op", "to-base64", stdin=data).out == expected


def test_input_encoding_invalid(cli: Cli) -> None:
    result = cli("--input-encoding", "hex", "op", "to-base64", stdin=b"zz")
    assert result.code == 1
    assert "E_DECODE" in result.stderr or "E_INPUT_TYPE" in result.stderr


def test_raw_output_types(cli: Cli) -> None:
    assert cli("op", "count", "abc").out == "3"
    doc = json.loads(cli("op", "jwt-decode", "e30.e30.").out)
    assert set(doc) >= {"header", "payload"}


def test_convert_arg() -> None:
    assert convert_arg(spec("xor", "key"), "base64:AQ==") == {"encoding": "base64", "value": "AQ=="}
    assert convert_arg(spec("xor", "key"), "plain") == {"encoding": "utf8", "value": "plain"}
    assert convert_arg(spec("head", "count"), "3") == 3
    assert convert_arg(spec("rot13", "digits"), "yes") is True
    assert convert_arg(spec("rot13", "digits"), "off") is False
    steps = convert_arg(spec("fork", "steps"), '[{"op": "md5"}]')
    assert steps == [{"op": "md5"}]
    with pytest.raises(UniChefError):
        convert_arg(spec("fork", "steps"), "[")


# -- ops -----------------------------------------------------------------------------------


def test_ops_table(cli: Cli) -> None:
    result = cli("ops", "--search", "base64", "--format", "json")
    ids = [row[0] for row in result.json()["result"]["value"]["rows"]]
    assert "to-base64" in ids and "from-base64" in ids


def test_ops_ids(cli: Cli) -> None:
    ids = cli("ops", "--ids").out.split()
    assert len(ids) >= 60 and "to-base64" in ids


def test_ops_category_tree(cli: Cli) -> None:
    result = cli("ops", "--category", "hashing", "--view", "tree", "--format", "table")
    assert "sha2" in result.out
    assert "to-base64" not in result.out


def test_ops_nothing_matches(cli: Cli) -> None:
    result = cli("ops", "--search", "zzzzzz", "--format", "table")
    assert result.code == 0


# -- bake ----------------------------------------------------------------------------------


def test_bake(cli: Cli, recipe: Path) -> None:
    assert cli("bake", "-r", str(recipe), "hi").out == "61476b3d"


def test_bake_json(cli: Cli, recipe: Path) -> None:
    doc = cli("bake", "-r", str(recipe), "--format", "json", stdin="hi").json()
    assert doc["result"] == {"type": "string", "value": "61476b3d"}
    assert doc["command"] == "bake"


def test_bake_until_and_steps(cli: Cli, recipe: Path) -> None:
    result = cli("bake", "-r", str(recipe), "--until", "1", "--steps", "hi")
    assert result.out == "aGk="
    assert "Stopped before step 1" in result.stderr
    assert "to-base64" in result.stderr


def test_bake_breakpoints(cli: Cli, recipe: Path) -> None:
    result = cli("bake", "-r", str(recipe), "--breakpoints", "-v", "hi")
    assert result.out == "aGk="


def test_bake_recipe_from_stdin(cli: Cli) -> None:
    result = cli("bake", "-r", "-", "hi", stdin=json.dumps(RECIPE))
    assert result.out == "61476b3d"


def test_bake_bad_recipe(cli: Cli, tmp_path: Path) -> None:
    bad = tmp_path / "bad.json"
    bad.write_text("{nope", encoding="utf-8")
    result = cli("bake", "-r", str(bad), "x", "--format", "json")
    assert result.code == 4
    assert result.json()["error"]["code"] == "E_RECIPE_SCHEMA"
    bad.write_bytes(b"\xff\xfe")
    assert cli("bake", "-r", str(bad), "x").code == 4


def test_bake_duplicate_key_warning(cli: Cli, tmp_path: Path) -> None:
    path = tmp_path / "dup.json"
    path.write_text('{"version":1,"version":1,"steps":[]}', encoding="utf-8")
    doc = cli("bake", "-r", str(path), "x", "--format", "json").json()
    assert doc["warnings"][0]["code"] == "W_DUPLICATE_KEY"


def test_bake_step_error_path(cli: Cli, tmp_path: Path) -> None:
    path = tmp_path / "r.json"
    path.write_text('{"version":1,"steps":[{"op":"from-hex"}]}', encoding="utf-8")
    result = cli("bake", "-r", str(path), "zz", "--format", "json")
    assert result.code == 1
    assert result.json()["error"]["path"] == "0"


def test_bake_missing_recipe_flag(cli: Cli) -> None:
    result = cli("bake", "--format", "json")
    assert result.code == 2
    assert result.json()["error"]["code"] == "E_USAGE"


# -- recipe --------------------------------------------------------------------------------


def test_recipe_validate(cli: Cli, recipe: Path) -> None:
    doc = cli("recipe", "validate", str(recipe), "--format", "json").json()
    assert doc["result"]["value"] == {"valid": True, "steps": 3, "name": "demo"}
    assert doc["command"] == "recipe validate"
    assert "valid" in cli("recipe", "validate", str(recipe), "--format", "table").out


def test_recipe_validate_nested_steps(cli: Cli, tmp_path: Path) -> None:
    path = tmp_path / "r.json"
    path.write_text(
        '{"version":1,"steps":[{"op":"fork","args":{"steps":[{"op":"md5"},{"op":"sha1"}]}}]}',
        encoding="utf-8",
    )
    doc = cli("recipe", "validate", str(path), "--format", "json").json()
    assert doc["result"]["value"]["steps"] == 3


def test_recipe_validate_unknown_op(cli: Cli, tmp_path: Path) -> None:
    path = tmp_path / "r.json"
    path.write_text('{"version":1,"steps":[{"op":"nope"}]}', encoding="utf-8")
    assert cli("recipe", "validate", str(path)).code == 4


def test_recipe_fmt(cli: Cli, tmp_path: Path) -> None:
    path = tmp_path / "r.json"
    path.write_text(
        '{"steps":[{"args":{"steps":[{"args":{"count":1},"op":"head"}]},"op":"fork"}],"version":1}',
        encoding="utf-8",
    )
    out = cli("recipe", "fmt", str(path)).out
    assert out.startswith('{\n  "version": 1,\n  "steps"')
    assert out.index('"op": "fork"') < out.index('"args"')
    assert out.endswith("}\n")
    assert out == format_recipe(json.loads(out))


def test_recipe_fmt_in_place(cli: Cli, recipe: Path) -> None:
    assert cli("recipe", "fmt", str(recipe), "-o", str(recipe)).code == 0
    assert recipe.read_text(encoding="utf-8").startswith('{\n  "version": 1')


def test_recipe_requires_action(cli: Cli) -> None:
    assert cli("recipe").code == 2


# -- regex ---------------------------------------------------------------------------------


def test_regex_matches(cli: Cli) -> None:
    doc = cli("regex", r"(\d)(\d)?", "a1b22", "--format", "json").json()
    rows = doc["result"]["value"]["rows"]
    assert rows[0][:4] == [1, 1, 2, "1"]
    assert rows[1][3:] == ["22", "2", "2"]


def test_regex_flags_and_table(cli: Cli) -> None:
    result = cli("regex", "B", "abB", "--flags", "i", "--format", "table", env={"NO_COLOR": "1"})
    assert result.out.count("b") >= 1 and "B" in result.out


def test_regex_no_match(cli: Cli) -> None:
    assert cli("regex", "z", "abc", "--format", "table").code == 0


def test_regex_explain(cli: Cli) -> None:
    doc = cli("regex", "(?<n>a)", "--explain", "--format", "json").json()
    rows = dict(doc["result"]["value"]["rows"])
    assert rows["groups"] in {1, "1"}
    assert "python" in rows


def test_regex_unsupported(cli: Cli) -> None:
    result = cli("regex", "(?P<x>a)", "a")
    assert result.code == 1
    assert "E_REGEX_UNSUPPORTED" in result.stderr


# -- FR-003: the CLI bakes the shared recipe vectors byte for byte ---------------------------


def _recipe_cases() -> list[Any]:
    cases = []
    for path in sorted((VECTORS / "_recipes").glob("*.json")):
        doc = load_json(path)
        for case in doc["cases"]:
            types = (case["input"]["type"], case.get("expected", {}).get("type"))
            # A string with a lone surrogate has no UTF-8 form, so it cannot arrive on stdin.
            text = case["input"].get("text", "")
            if text.encode("utf-8", "surrogatepass").decode("utf-8", "replace") != text:
                continue
            if types[0] in {"bytes", "string"} and types[1] in {"bytes", "string"}:
                cases.append(pytest.param(doc["recipe"], case, id=f"{path.stem}:{case['name']}"))
    return cases


def _vector_bytes(raw: dict[str, Any]) -> bytes:
    return bytes.fromhex(raw["hex"]) if raw["type"] == "bytes" else raw["text"].encode("utf-8")


@pytest.mark.parametrize(("recipe_doc", "case"), _recipe_cases())
def test_bake_matches_recipe_vectors(
    cli: Cli, tmp_path: Path, recipe_doc: dict[str, Any], case: dict[str, Any]
) -> None:
    """FR-003: `unichef bake -r recipe.json < in > out` writes the bytes the vectors expect.

    The TypeScript core runs the same vectors (parity job), so this is also the web app's output.
    """
    path = tmp_path / "recipe.json"
    path.write_text(json.dumps(recipe_doc), encoding="utf-8")
    result = cli("bake", "-r", str(path), "--format", "raw", stdin=_vector_bytes(case["input"]))
    assert result.code == 0, result.stderr
    assert result.stdout == _vector_bytes(case["expected"])
