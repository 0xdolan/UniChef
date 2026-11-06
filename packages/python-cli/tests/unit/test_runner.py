# SPDX-License-Identifier: GPL-3.0-or-later
"""Recipe validation and the runner: limits, paths, cancellation (PRD §3.4-§3.7)."""

import json
from typing import Any

import pytest

from conftest import SPEC
from unichef.core.dish import Dish
from unichef.core.errors import EXIT_CODES, WARNING_CODES, RunWarning, UniChefError, quote_input
from unichef.core.recipe import parse_recipe, resolve_args
from unichef.core.registry import (
    REGISTRY,
    Args,
    BytesValue,
    Limits,
    OpContext,
    Operation,
    Rng,
    bytes_arg,
    get_operation,
    int_arg,
    register,
)
from unichef.core.runner import Runner, bake, dish_size, run_operation


def recipe(*steps: dict[str, Any], **extra: Any) -> dict[str, Any]:
    return {"version": 1, "steps": list(steps), **extra}


def error_of(raw: object) -> UniChefError:
    with pytest.raises(UniChefError) as info:
        bake(parse_recipe(raw), Dish.of_string("x"))
    return info.value


def test_error_catalogue_matches_spec() -> None:
    spec = json.loads((SPEC / "errors.json").read_text(encoding="utf-8"))
    assert {e["code"]: e["exit"] for e in spec["errors"]} == EXIT_CODES
    assert tuple(w["code"] for w in spec["warnings"]) == WARNING_CODES


@pytest.mark.parametrize(
    ("raw", "code"),
    [
        ([], "E_RECIPE_SCHEMA"),
        ({"steps": []}, "E_RECIPE_SCHEMA"),
        ({"version": True, "steps": []}, "E_RECIPE_SCHEMA"),
        (recipe(extra=1), "E_RECIPE_SCHEMA"),
        ({"version": 1, "steps": {}}, "E_RECIPE_SCHEMA"),
        (recipe(name=3), "E_RECIPE_SCHEMA"),
        (recipe(name="n" * 201), "E_RECIPE_SCHEMA"),
        (recipe(description="d" * 5001), "E_RECIPE_SCHEMA"),
        (recipe(seed="ABC"), "E_RECIPE_SCHEMA"),
        (recipe("to-hex"), "E_RECIPE_SCHEMA"),  # type: ignore[arg-type]  # a bare string step
        (recipe({"op": "To_Hex"}), "E_RECIPE_SCHEMA"),
        (recipe({"op": "to-hex", "x": 1}), "E_RECIPE_SCHEMA"),
        (recipe({"op": "to-hex", "args": []}), "E_RECIPE_SCHEMA"),
        (recipe({"op": "to-hex", "disabled": "no"}), "E_RECIPE_SCHEMA"),
        (recipe({"op": "to-hex", "label": "1bad"}), "E_RECIPE_SCHEMA"),
        (recipe({"op": "to-hex", "comment": "c" * 2001}), "E_RECIPE_SCHEMA"),
        (recipe({"op": "to-hex", "label": "a"}, {"op": "to-hex", "label": "a"}), "E_RECIPE_SCHEMA"),
        (recipe(*[{"op": "to-hex"}] * 1001), "E_RECIPE_SCHEMA"),
        (recipe({"op": "nope"}), "E_OP_UNKNOWN"),
        (recipe({"op": "to-hex", "args": {"case": 1}}), "E_ARG_INVALID"),
        (recipe({"op": "to-base64", "args": {"padding": "yes"}}), "E_ARG_INVALID"),
        (recipe({"op": "to-base64", "args": {"custom": 1}}), "E_ARG_INVALID"),
        (recipe({"op": "jump", "args": {"to": "x", "max": 1001}}), "E_ARG_INVALID"),
        (recipe({"op": "jump", "args": {"to": "x", "max": -1}}), "E_ARG_INVALID"),
        (recipe({"op": "jump", "args": {"to": "x", "max": 1.5}}), "E_ARG_INVALID"),
        (recipe({"op": "fork", "args": {"steps": {}}}), "E_ARG_INVALID"),
        (recipe({"op": "fork", "args": {"steps": [{"op": "nope"}]}}), "E_OP_UNKNOWN"),
    ],
)
def test_validation_errors(raw: object, code: str) -> None:
    assert error_of(raw).code == code


def test_nesting_depth_limit() -> None:
    steps: list[dict[str, Any]] = [{"op": "to-hex"}]
    for _ in range(7):
        steps = [{"op": "sub-recipe", "args": {"steps": steps}}]
    parse_recipe(recipe(*steps))  # depth 8 is allowed
    deeper = recipe({"op": "sub-recipe", "args": {"steps": steps}})
    assert error_of(deeper).code == "E_LIMIT"


def test_error_path_through_fork_branches() -> None:
    raw = recipe(
        {"op": "to-hex", "args": {"delimiter": "none"}},
        {"op": "from-hex", "args": {"delimiter": "none"}},
        {"op": "decode-text"},
        {"op": "fork", "args": {"split": ",", "steps": [{"op": "comment"}, {"op": "from-hex"}]}},
    )
    with pytest.raises(UniChefError) as info:
        bake(parse_recipe(raw), Dish.of_string("41,zz"))
    assert info.value.code == "E_DECODE"
    assert info.value.path == [3, "branch", 1, 1]
    assert info.value.to_json()["path"] == "3/branch/1/1"
    assert info.value.exit_code == 1


def test_error_path_in_nested_arg() -> None:
    raw = recipe({"op": "fork", "args": {"steps": [{"op": "to-hex", "args": {"bad": 1}}]}})
    err = error_of(raw)
    assert err.code == "E_ARG_INVALID"
    assert err.path in ([0, "steps", 0], [0, 0])


def test_step_limit() -> None:
    raw = recipe(
        {"op": "label", "args": {"name": "top"}}, {"op": "jump", "args": {"to": "top", "max": 1000}}
    )
    with pytest.raises(UniChefError) as info:
        bake(parse_recipe(raw), Dish.of_string(""), limits=Limits(max_steps=50))
    assert info.value.code == "E_LIMIT"


def test_input_and_output_limits() -> None:
    with pytest.raises(UniChefError) as info:
        bake(parse_recipe(recipe()), Dish.of_bytes(b"abc"), limits=Limits(max_input_size=2))
    assert info.value.code == "E_LIMIT"
    tight = Limits(min_output_size=1, output_factor=1)
    with pytest.raises(UniChefError) as info:
        bake(parse_recipe(recipe({"op": "to-hex"})), Dish.of_bytes(b"ab"), limits=tight)
    assert info.value.code == "E_LIMIT"
    assert info.value.path == [0]


def test_until_and_breakpoints() -> None:
    raw = recipe({"op": "to-hex"}, {"op": "to-base64", "breakpoint": True}, {"op": "to-hex"})
    parsed = parse_recipe(raw)
    result = bake(parsed, Dish.of_bytes(b"A"), until=1)
    assert result.dish == Dish.of_string("41")
    assert result.stopped_at == 1
    result = bake(parsed, Dish.of_bytes(b"A"), breakpoints=True)
    assert result.stopped_at == 1
    assert result.steps_executed == 1
    assert bake(parsed, Dish.of_bytes(b"A")).stopped_at is None


def test_cancellation() -> None:
    ctx = OpContext()
    ctx.cancel_token.cancel()
    assert ctx.cancelled()
    with pytest.raises(UniChefError) as info:
        bake(parse_recipe(recipe({"op": "to-hex"})), Dish.of_bytes(b"A"), ctx=ctx)
    assert info.value.code == "E_CANCELLED"
    assert info.value.exit_code == 130


def _boom(_data: bytes, _args: Args, _ctx: OpContext) -> bytes:
    raise KeyError("boom")


def _deep(_data: bytes, _args: Args, _ctx: OpContext) -> bytes:
    raise RecursionError


def _oom(_data: bytes, _args: Args, _ctx: OpContext) -> bytes:
    raise MemoryError


@pytest.mark.parametrize(
    ("fn", "code"), [(_boom, "E_INTERNAL"), (_deep, "E_LIMIT"), (_oom, "E_LIMIT")]
)
def test_unexpected_exceptions_are_mapped(fn: Any, code: str) -> None:
    op_id = f"test-{code.lower().replace('_', '-')}-{fn.__name__.strip('_')}"
    register(Operation(op_id, "Test", "Text", "", "bytes", "bytes", (), fn))
    try:
        with pytest.raises(UniChefError) as info:
            run_operation(op_id, {}, Dish.of_bytes(b""))
        assert info.value.code == code
        assert info.value.path == [0]
        if code == "E_INTERNAL":
            assert "please report" in info.value.message
    finally:
        del REGISTRY[op_id]


def test_register_rejects_duplicates() -> None:
    with pytest.raises(ValueError, match="duplicate"):
        register(get_operation("to-hex"))


def test_run_nested_requires_runner() -> None:
    with pytest.raises(UniChefError) as info:
        OpContext().run_nested([], Dish.of_bytes(b""))
    assert info.value.code == "E_INTERNAL"
    ctx = OpContext()
    Runner(ctx)
    assert ctx.run_nested([], Dish.of_bytes(b"a")) == Dish.of_bytes(b"a")


def test_bytes_and_integer_args() -> None:
    op = Operation(
        "test-args",
        "T",
        "Text",
        "",
        "bytes",
        "bytes",
        (bytes_arg("key"), int_arg("n", 1, 0, 2**60)),
        _boom,
    )
    args = resolve_args(
        op, {"key": {"encoding": "base64", "value": "AAE="}, "n": "1152921504606846976"}
    )
    assert Args(args).data("key") == b"\x00\x01"
    assert Args(args).integer("n") == 2**60
    assert Args(resolve_args(op, {})).data("key") == b""
    for encoding, value, expected in [
        ("utf8", "é", b"\xc3\xa9"),
        ("latin1", "é", b"\xe9"),
        ("hex", "0a", b"\n"),
    ]:
        assert BytesValue(encoding, value).decode("k") == expected  # type: ignore[arg-type]
    for bad in [
        {"encoding": "hex", "value": "zz"},
        {"encoding": "latin1", "value": "€"},
        {"encoding": "base64", "value": "A"},
        {"encoding": "rot", "value": ""},
        "00",
        {"encoding": "hex"},
    ]:
        with pytest.raises(UniChefError) as info:
            resolve_args(op, {"key": bad})
        assert info.value.code == "E_ARG_INVALID"
    for bad_n in [True, 2**53, "01", "x"]:
        with pytest.raises(UniChefError):
            resolve_args(op, {"n": bad_n})


def test_rng_is_deterministic_when_seeded() -> None:
    a, b = Rng("00" * 16), Rng("00" * 16)
    assert a.seeded
    assert a.random_bytes(40) == b.random_bytes(40)
    assert len(Rng().random_bytes(5)) == 5
    assert not Rng().seeded


def test_seed_is_used_by_bake() -> None:
    parsed = parse_recipe(recipe(seed="0" * 32))
    assert parsed.seed == "0" * 32


def test_misc_helpers() -> None:
    assert quote_input("abc") == "'abc'"
    assert quote_input("é" * 40).endswith("…")
    assert RunWarning("W_INSECURE", "m", (1,)).to_json() == {
        "code": "W_INSECURE",
        "message": "m",
        "path": "1",
    }
    assert RunWarning("W_INSECURE", "m").to_json() == {"code": "W_INSECURE", "message": "m"}
    assert UniChefError("E_DECODE", "m", detail={"a": 1}).to_json() == {
        "code": "E_DECODE",
        "message": "m",
        "detail": {"a": 1},
    }
    assert dish_size(Dish("integer", 5)) == 0
    assert get_operation("to-hex").arg("nope") is None
    assert Limits().output_limit(100 * 1024 * 1024) == 400 * 1024 * 1024


def test_label_and_comment_direct_calls() -> None:
    for op_id in ("label", "comment", "sub-recipe"):
        result = run_operation(op_id, {}, Dish.of_bytes(b"\x00"))
        assert result.dish == Dish.of_bytes(b"\x00")
    assert get_operation("jump").run("", Args({}), OpContext()) is True
    assert (
        get_operation("sub-recipe").run(b"\x01", Args({"steps": []}), _ctx_with_runner()) == b"\x01"
    )


def _ctx_with_runner() -> OpContext:
    ctx = OpContext()
    Runner(ctx)
    return ctx


def test_fork_split_empty_separator_splits_characters() -> None:
    raw = recipe({"op": "fork", "args": {"split": "", "merge": "-", "steps": [{"op": "to-hex"}]}})
    assert bake(parse_recipe(raw), Dish.of_string("ab")).dish == Dish.of_string("61-62")
