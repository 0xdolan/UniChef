# SPDX-License-Identifier: GPL-3.0-or-later
"""The character query language (PRD §4.8) and the name iterators it scans."""

import pytest

from unichef.core.errors import UniChefError
from unichef.unicode import names
from unichef.unicode.query import query


def cps(text: str, limit: int = 10_000) -> tuple[int, ...]:
    return query(text, limit).code_points


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("gc=Lu & blk=Basic_Latin", tuple(range(0x41, 0x5B))),
        ("gc=Nd & blk=ASCII", tuple(range(0x30, 0x3A))),
        ('sc="Greek" & name~/^GREEK CAPITAL LETTER ALPHA$/', (0x391,)),
        ("name~/^latin small letter a$/i", (0x61,)),
        ("name~/HANGUL SYLLABLE GAG$/", (0xAC01,)),
        ("name~/^LATIN SMALL LETTER GHA$/", (0x1A3,)),
        ("WSpace & blk=ASCII & !(gc=Cc)", (0x20,)),
        ("White_Space=No & ccc>=230 & ccc<=230 & blk=Combining_Diacritical_Marks", None),
        ("(gc=Lu | gc=Ll) & blk=ASCII & !Hex_Digit", None),
        ("scx=Grek & sc!=Grek & blk=Combining_Diacritical_Marks", None),
        ("age=1.1 & blk=ASCII", tuple(range(0x80))),
        ("age>16.0 & age<=17.0 & blk=Basic_Latin", ()),
        ("ExtPict=yes & blk=ASCII", ()),
        ("ccc<1 & ccc>0", ()),
        ("Emoji=No & Emoji!=Yes & blk=ASCII & gc=Lu", tuple(range(0x41, 0x5B))),
        ("gc!=Cn & blk=Basic_Latin & age<2.0 & gc=Zs", (0x20,)),
    ],
)
def test_queries(text: str, expected: tuple[int, ...] | None) -> None:
    result = cps(text)
    if expected is None:
        assert result
        assert list(result) == sorted(set(result))
    else:
        assert result == expected


def test_nested_and_or_narrow_left_to_right() -> None:
    combining = set(cps("ccc=230 & blk=Combining_Diacritical_Marks"))
    assert combining
    assert all(0x300 <= cp <= 0x36F for cp in combining)
    assert set(cps("blk=Combining_Diacritical_Marks & !(ccc=230)")).isdisjoint(combining)


def test_limit_and_truncation() -> None:
    result = query("gc=L", 5)
    assert result.code_points == (0x41, 0x42, 0x43, 0x44, 0x45)
    assert result.truncated
    assert result.total > 100_000
    exact = query("blk=ASCII & gc=Nd", 10)
    assert exact.total == 10
    assert not exact.truncated


@pytest.mark.parametrize(
    "text",
    [
        "",
        "   ",
        "gc=",
        "gc=Lu &",
        "(gc=Lu",
        "gc=Lu)",
        "gc",
        "Nope=1",
        "gc=Nope",
        "=Lu",
        "name~",
        "name~gc",
        "name~/a",
        "name~/a/g",
        'sc="Greek',
        "gc=Lu $",
        "gc<Lu",
        "Alphabetic<Yes",
        "Alphabetic=maybe",
        "na=A",
        "age<NA",
        "ccc=x",
        "|",
    ],
)
def test_invalid_queries(text: str) -> None:
    with pytest.raises(UniChefError) as info:
        query(text)
    assert info.value.code == "E_ARG_INVALID"


def test_name_regex_errors_and_timeout() -> None:
    with pytest.raises(UniChefError) as info:
        query("name~/a++/")
    assert info.value.code == "E_REGEX_UNSUPPORTED"
    with pytest.raises(UniChefError) as info:
        # Exponential backtracking on every name, so 1 ms runs out on any machine.
        query("name~/^(.|.)+ $/", timeout_ms=1)
    assert info.value.code == "E_REGEX_TIMEOUT"


def test_escaped_slash_and_quotes() -> None:
    assert cps(r"name~/^SOLIDUS\/?$/") == (0x2F,)
    assert cps(r'blk="Basic\ Latin" & gc=Lu', 1) == (0x41,)


def test_name_iterators() -> None:
    found = dict(names.iter_names([(0x41, 0x42), (0xAC00, 0xAC00), (0x4E00, 0x4E00)]))
    assert found == {
        0x41: "LATIN CAPITAL LETTER A",
        0x42: "LATIN CAPITAL LETTER B",
        0xAC00: "HANGUL SYLLABLE GA",
        0x4E00: "CJK UNIFIED IDEOGRAPH-4E00",
    }
    assert dict(names.iter_names([(0x378, 0x378)])) == {}
    aliases = [(cp, alias.alias) for cp, alias in names.iter_aliases([(0x1A2, 0x1A2)])]
    assert (0x1A2, "LATIN CAPITAL LETTER GHA") in aliases
