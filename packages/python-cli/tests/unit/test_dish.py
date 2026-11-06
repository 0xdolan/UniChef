# SPDX-License-Identifier: GPL-3.0-or-later
"""Dish values and coercion rules (PRD §3.1, §3.2)."""

import json
import math

import pytest
from hypothesis import given
from hypothesis import strategies as st

from unichef.core.dish import (
    ROUTES,
    Dish,
    JsonValue,
    Table,
    coerce,
    format_float,
    json_dumps,
    json_loads,
    parse_integer,
    table_to_tsv,
)
from unichef.core.errors import UniChefError, WarningCode


@pytest.mark.parametrize(
    ("value", "text"),
    [
        (0.0, "0"),
        (-0.0, "0"),
        (1.0, "1"),
        (0.1, "0.1"),
        (-1.5, "-1.5"),
        (1e21, "1e+21"),
        (1e20, "100000000000000000000"),
        (123456789012345680000.0, "123456789012345680000"),
        (1e-6, "0.000001"),
        (1e-7, "1e-7"),
        (1.5e-7, "1.5e-7"),
        (2**53 + 0.0, "9007199254740992"),
        (5e-324, "5e-324"),
        (1.7976931348623157e308, "1.7976931348623157e+308"),
        (123.456, "123.456"),
        (0.000123, "0.000123"),
        (math.nan, "NaN"),
        (math.inf, "Infinity"),
        (-math.inf, "-Infinity"),
    ],
)
def test_format_float_matches_ecmascript(value: float, text: str) -> None:
    assert format_float(value) == text


@given(st.floats(allow_nan=False, allow_infinity=False))
def test_format_float_round_trips(value: float) -> None:
    assert float(format_float(value)) == value or value == 0


@pytest.mark.parametrize("text", ["0", "-1", "42", "123456789012345678901234567890"])
def test_parse_integer(text: str) -> None:
    assert str(parse_integer(text)) == text


@pytest.mark.parametrize("text", ["", "-", "+1", "01", "-0", "1.0", " 1", "\u0661"])
def test_parse_integer_rejects(text: str) -> None:
    with pytest.raises(UniChefError) as info:
        parse_integer(text)
    assert info.value.code == "E_INPUT_TYPE"


def test_json_dumps_is_compact_and_ordered() -> None:
    value: JsonValue = {"b": [1, 2.5, None, True, False], "a": {"é/": '\u0001\n"\\'}, "1": 1e21}
    assert (
        json_dumps(value)
        == '{"b":[1,2.5,null,true,false],"a":{"é/":"\\u0001\\n\\"\\\\"},"1":1e+21}'
    )
    assert json_dumps(math.nan) == "null"
    assert json_dumps("\ud800\t\b\f\r") == '"\\ud800\\t\\b\\f\\r"'


def test_json_loads_duplicate_keys_warn_and_last_wins() -> None:
    seen: list[WarningCode] = []
    value = json_loads('{"a":1,"b":2,"a":3}', lambda code, _detail: seen.append(code))
    assert value == {"b": 2, "a": 3}
    assert list(value) == ["b", "a"]
    assert seen == ["W_DUPLICATE_KEY"]


@pytest.mark.parametrize("text", ["NaN", "{", "[1,]", "'a'", "Infinity", ""])
def test_json_loads_is_strict(text: str) -> None:
    with pytest.raises(UniChefError) as info:
        json_loads(text)
    assert info.value.code == "E_INPUT_TYPE"


def test_json_loads_deep_nesting_is_a_limit() -> None:
    with pytest.raises(UniChefError) as info:
        json_loads("[" * 100_000 + "]" * 100_000)
    assert info.value.code == "E_LIMIT"


def test_table_tsv_and_json() -> None:
    table = Table(("a", "b\tc"), ((1, None), (True, 0.5), ("x\ny", "\\")))
    assert table_to_tsv(table) == "a\tb\\tc\n1\t\ntrue\t0.5\nx\\ny\t\\\\"
    assert table.to_json() == {
        "columns": ["a", "b\tc"],
        "rows": [[1, None], [True, 0.5], ["x\ny", "\\"]],
    }


@pytest.mark.parametrize(
    ("source", "target", "expected"),
    [
        (Dish("string", "a\ud800"), "bytes", Dish("bytes", b"a\xef\xbf\xbd")),
        (Dish("bytes", b"\xef\xbb\xbf\xff"), "string", Dish("string", "﻿�")),
        (Dish("codepoints", [0x41, 0xD800, 0x1F600]), "string", Dish("string", "A�\U0001f600")),
        (Dish("string", "A😀"), "codepoints", Dish("codepoints", [0x41, 0x1F600])),
        (Dish("integer", -12), "string", Dish("string", "-12")),
        (Dish("string", "99"), "integer", Dish("integer", 99)),
        (Dish("float", 1e21), "string", Dish("string", "1e+21")),
        (Dish("json", {"k": [1]}), "string", Dish("string", '{"k":[1]}')),
        (Dish("string", '{"k":[1]}'), "json", Dish("json", {"k": [1]})),
        (
            Dish("table", Table(("c",), ((1,),))),
            "json",
            Dish("json", {"columns": ["c"], "rows": [[1]]}),
        ),
        (Dish("table", Table(("c",), ((1,),))), "string", Dish("string", "c\n1")),
        (Dish("bytes", b"\xf0\x9f\x98\x80"), "codepoints", Dish("codepoints", [0x1F600])),
        (Dish("integer", 7), "bytes", Dish("bytes", b"7")),
        (Dish("bytes", b"[1]"), "json", Dish("json", [1])),
        (Dish("bytes", b"x"), "bytes", Dish("bytes", b"x")),
    ],
)
def test_coerce(source: Dish, target: str, expected: Dish) -> None:
    assert coerce(source, target) == expected  # type: ignore[arg-type]  # parametrized literal


def test_coerce_unreachable_and_bad_values() -> None:
    assert ROUTES[("bytes", "table")] is None
    assert ROUTES[("string", "float")] is None
    with pytest.raises(UniChefError) as info:
        coerce(Dish("string", "x"), "table")
    assert info.value.code == "E_INPUT_TYPE"
    with pytest.raises(UniChefError):
        coerce(Dish("float", 1.5), "integer")


@given(
    st.recursive(
        st.none() | st.booleans() | st.integers() | st.text(),
        lambda inner: st.lists(inner) | st.dictionaries(st.text(), inner),
        max_leaves=20,
    )
)
def test_json_round_trip(value: object) -> None:
    text = json_dumps(value)  # type: ignore[arg-type]  # hypothesis builds JSON values
    assert json.loads(text) == value
