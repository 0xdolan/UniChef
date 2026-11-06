# SPDX-License-Identifier: GPL-3.0-or-later
"""Properties, names, case mapping and UTS #39 data (PRD §4.2-§4.7)."""

from collections.abc import Callable

import pytest
from hypothesis import given
from hypothesis import strategies as st

from conftest import UCD_DIR, ucd_version
from unichef.core.dish import Dish, Table
from unichef.core.errors import UniChefError
from unichef.core.runner import run_operation
from unichef.unicode import case, confusables, data, names, normalize, props

RAW = UCD_DIR / ucd_version()


# Range tables and set algebra


def test_set_algebra() -> None:
    a = [(0, 9), (20, 29)]
    b = [(5, 24)]
    assert data.intersect(a, b) == [(5, 9), (20, 24)]
    assert data.union(a, b) == [(0, 29)]
    assert data.merge([(3, 4), (0, 2), (10, 10)]) == [(0, 4), (10, 10)]
    assert data.complement([(0, 9), (0x10FFFF, 0x10FFFF)]) == [(10, 0x10FFFE)]
    assert data.complement([]) == [(0, 0x10FFFF)]
    assert list(data.code_points([(1, 3)])) == [1, 2, 3]
    assert data.contains(a, 25)
    assert not data.contains(a, 15)
    assert not data.contains([], 0)


def test_range_table_where_includes_default_gaps() -> None:
    table = data.RangeTable({"default": "x", "values": ["a"], "ranges": [10, 5, 0]})
    assert table.get(9) == "x"
    assert table.get(12) == "a"
    assert table.ranges_where({"x"}) == [(0, 9), (15, 0x10FFFF)]
    assert table.ranges_where({"a"}) == [(10, 14)]


# Properties


@pytest.mark.parametrize(
    ("cp", "gc", "sc", "block", "age"),
    [
        (0x41, "Lu", "Latn", "Basic Latin", "1.1"),
        (0x0627, "Lo", "Arab", "Arabic", "1.1"),
        (0x1F600, "So", "Zyyy", "Emoticons", "6.1"),
        (0x0378, "Cn", "Zzzz", "Greek and Coptic", "NA"),
        (0xE000, "Co", "Zzzz", "Private Use Area", "1.1"),
        (0xD800, "Cs", "Zzzz", "High Surrogates", "2.0"),
        (0xE0080, "Cn", "Zzzz", "No_Block", "NA"),
    ],
)
def test_basic_properties(cp: int, gc: str, sc: str, block: str, age: str) -> None:
    assert props.gc(cp) == gc
    assert props.sc(cp) == sc
    assert props.block(cp) == block
    assert props.get("age", cp) == age


def test_other_properties() -> None:
    assert props.ccc(0x0301) == 230
    assert props.ccc(0x41) == 0
    assert props.get("bc", 0x05D0) == "R"
    assert props.get("bc", 0x05FF) == "R"  # @missing default inside the Hebrew block
    assert props.get("ea", 0x4E00) == "W"
    assert props.has("ExtPict", 0x1F600)
    assert props.has("White_Space", 0x20)
    assert not props.has("White_Space", 0x41)
    assert props.scx(0x0660) == ("Arab", "Thaa", "Yezi")
    assert props.scx(0x41) == ("Latn",)
    assert "Alphabetic" in props.binary_names()


def test_alias_resolution() -> None:
    assert props.loose(" Is_General-Category ") == "generalcategory"
    assert props.loose("is") == "is"
    assert props.resolve_property("General_Category") == "gc"
    assert props.resolve_property("script") == "sc"
    assert props.resolve_property("WSpace") == "White_Space"
    assert props.resolve_property("Extended_Pictographic") == "ExtPict"
    assert props.resolve_value("gc", "uppercase letter") == "Lu"
    assert props.resolve_value("sc", "arabic") == "Arab"
    assert props.resolve_value("blk", "basic latin") == "Basic_Latin"
    assert props.resolve_value("ccc", "230") == "230"
    assert props.is_binary("ExtPict")
    assert not props.is_binary("gc")
    calls: tuple[Callable[[], object], ...] = (
        lambda: props.resolve_property("nope"),
        lambda: props.resolve_value("gc", "Q"),
    )
    for call in calls:
        with pytest.raises(UniChefError) as info:
            call()
        assert info.value.code == "E_ARG_INVALID"


def test_ranges_for() -> None:
    letters = props.ranges_for("gc", "L")
    assert data.contains(letters, 0x41)
    assert data.contains(letters, 0x01C5)  # Lt
    assert not data.contains(letters, 0x30)
    assert props.ranges_for("gc", "Nd")[0] == (0x30, 0x39)
    assert data.contains(props.ranges_for("ccc", "230"), 0x0301)
    assert data.contains(props.ranges_for("sc", "Grek"), 0x03B1)
    unassigned = props.ranges_for("gc", "Cn")
    assert data.contains(unassigned, 0x0378)
    assert data.contains(unassigned, 0x10FFFF)
    yezi = props.ranges_for("scx", "Yezi")
    assert data.contains(yezi, 0x0660)  # via Script_Extensions
    assert data.contains(yezi, 0x10E80)  # via Script
    assert not data.contains(yezi, 0x41)
    assert data.contains(props.binary_ranges("Emoji"), 0x1F600)


# Names


def _derived_names() -> list[tuple[int, int, str]]:
    out = []
    for line in (RAW / "extracted" / "DerivedName.txt").read_text(encoding="utf-8").splitlines():
        body = line.split("#", 1)[0].strip()
        if body:
            span, name = (part.strip() for part in body.split(";"))
            first, _, last = span.partition("..")
            out.append((int(first, 16), int(last or first, 16), name))
    return out


def test_every_name_matches_derived_name_and_round_trips() -> None:
    entries = _derived_names()
    assert len(entries) > 30_000
    for first, last, expected in entries:
        for cp in {first, last}:
            want = expected.replace("*", f"{cp:04X}")
            assert names.name(cp) == want
            assert names.lookup(want) == cp, want


@pytest.mark.parametrize(
    ("cp", "label"),
    [
        (0x07, "<control-0007>"),
        (0xE000, "<private-use-E000>"),
        (0xD800, "<surrogate-D800>"),
        (0xFFFF, "<noncharacter-FFFF>"),
        (0x0378, "<reserved-0378>"),
        (0x41, "LATIN CAPITAL LETTER A"),
    ],
)
def test_labels(cp: int, label: str) -> None:
    assert names.label(cp) == label


def test_aliases_and_preferred_names() -> None:
    assert names.Alias("ALERT", "control") in names.aliases(0x07)
    assert names.preferred(0x07) == "ALERT"
    assert names.preferred(0x01A2) == "LATIN CAPITAL LETTER GHA"  # correction alias
    assert names.preferred(0x41) == "LATIN CAPITAL LETTER A"
    assert names.preferred(0x0378) == "<reserved-0378>"
    assert names.aliases(0x41) == ()


@pytest.mark.parametrize(
    ("query", "cp"),
    [
        ("latin small letter a", 0x61),
        ("LATIN_SMALL_LETTER_A", 0x61),
        ("Latin-Small-Letter-A", 0x61),
        ("hangul jungseong o-e", 0x1180),
        ("hangul jungseong oe", 0x116C),
        ("NULL", 0x00),
        ("BEL", 0x07),
        ("hangul syllable gag", 0xAC01),
        ("cjk unified ideograph-4e00", 0x4E00),
        ("CJK UNIFIED IDEOGRAPH 4E00", 0x4E00),
        ("tibetan letter -a", 0x0F60),
    ],
)
def test_lookup(query: str, cp: int) -> None:
    assert names.lookup(query) == cp


@pytest.mark.parametrize(
    "query",
    [
        "no such name",
        "CJK UNIFIED IDEOGRAPH-0041",
        "CJK UNIFIED IDEOGRAPH-4E0",
        "CJK UNIFIED IDEOGRAPH-04E00",
    ],
)
def test_lookup_misses(query: str) -> None:
    assert names.lookup(query) is None


# Case


@pytest.mark.parametrize(
    ("text", "upper", "lower", "title"),
    [
        ("straße", "STRASSE", "straße", "Straße"),
        ("ﬁx", "FIX", "ﬁx", "Fix"),
        ("ΌΣΟΣ Σ", "ΌΣΟΣ Σ", "όσος σ", "Όσος Σ"),
        ("ǆemal", "ǄEMAL", "ǆemal", "ǅemal"),
        ("o'neil 1st", "O'NEIL 1ST", "o'neil 1st", "O'neil 1st"),
        ("ŉ", "ʼN", "ŉ", "ʼN"),
    ],
)
def test_case_mappings(text: str, upper: str, lower: str, title: str) -> None:
    assert case.upper(text) == upper
    assert case.lower(text) == lower
    assert case.title(text) == title


def test_final_sigma_contexts() -> None:
    assert case.lower("ΑΣ.") == "ας."
    assert case.lower("Σ") == "σ"  # no cased letter before it
    assert case.lower("ΑΣΑ") == "ασα"  # followed by a cased letter
    assert case.lower("Α'Σ'") == "α'ς'"  # case-ignorable characters are skipped


def test_language_sensitive_mappings() -> None:
    assert case.upper("i", "tr") == "İ"
    assert case.lower("I", "tr") == "ı"
    assert case.lower("İ", "az") == "i"
    assert case.lower("İ", "tr") == "i"
    assert case.lower("İ") == "i̇"
    assert case.lower("Ì", "lt") == "i̇̀"
    assert case.lower("Ì", "lt") == "i̇̀"
    assert case.upper("i̇", "lt") == "I"
    assert case.upper("i̇") == "İ"
    assert case.lower("I", "lt") == "i"


def test_folding() -> None:
    assert case.fold("Straße") == "strasse"
    assert case.fold("Straße", simple=True) == "straße"
    assert case.fold("ẞ", simple=True) == "ß"
    assert case.fold("ΣΑΣ") == "σασ"
    assert case.fold("I") == "i"
    assert case.fold("Iİ", locale="tr") == "ıi"
    assert case.fold("ﬁ") == "fi"
    assert case.fold("ﬁ", simple=True) == "ﬁ"
    assert case.fold_code_point(0x41) == (0x61,)


_OLD_CHARS = st.characters(
    codec="utf-8",
    categories=("L", "M", "N", "P", "S", "Z"),
).filter(
    lambda ch: (
        props.get("age", ord(ch)) not in {"NA"} and float(str(props.get("age", ord(ch)))) <= 15.0
    )
)


@given(st.text(_OLD_CHARS, max_size=12))
def test_case_matches_host_for_characters_it_knows(text: str) -> None:
    # Python 3.12 ships Unicode 15.0. For characters that already existed then, its full
    # mappings are an independent oracle. It is never used by the product code.
    assert case.upper(text) == text.upper()
    assert case.lower(text) == text.lower()
    assert case.fold(text) == text.casefold()


# UTS #39


def test_skeletons() -> None:
    assert confusables.skeleton("paypal") == confusables.skeleton("\u0440\u0430\u0443pal")
    assert confusables.is_confusable("ℌ", "H")
    assert not confusables.is_confusable("a", "b")
    assert confusables.prototype(ord("ℌ")) == (ord("H"),)
    assert confusables.prototype(ord("a")) is None
    assert confusables.skeleton("") == ""


def test_identifier_status_and_type() -> None:
    assert confusables.identifier_status(0x61) == "Allowed"
    assert confusables.identifier_status(0x07) == "Restricted"
    assert confusables.identifier_types(0x61) == ("Recommended",)
    assert "Exclusion" in confusables.identifier_types(
        0x2C80
    ) or "Obsolete" in confusables.identifier_types(0x2C80)
    assert confusables.identifier_types(0x0378) == ("Not_Character",)


def test_resolved_script_sets() -> None:
    assert confusables.augmented_scripts(0x20) is None
    assert confusables.augmented_scripts(0x4E00) == frozenset({"Hani", "Hanb", "Jpan", "Kore"})
    assert confusables.augmented_scripts(0x3042) == frozenset({"Hira", "Jpan"})
    assert confusables.augmented_scripts(0xAC00) == frozenset({"Hang", "Kore"})
    assert confusables.augmented_scripts(0x3105) == frozenset({"Bopo", "Hanb"})
    assert confusables.resolved_script_set("abc 1") == frozenset({"Latn"})
    assert confusables.resolved_script_set("aа") == frozenset()
    assert confusables.resolved_script_set("123") is None
    assert confusables.resolved_script_set("漢あ") == frozenset({"Jpan"})


def test_decomposition_mapping() -> None:
    assert normalize.decomposition(0xAC00) == ("", (0x1100, 0x1161))
    assert normalize.decomposition(0xAC01) == ("", (0xAC00, 0x11A8))
    assert normalize.decomposition(0x00BD) == ("<fraction>", (0x31, 0x2044, 0x32))
    assert normalize.decomposition(0x41) is None


def test_mixed_script_without_a_majority_script() -> None:
    # Two Inherited marks whose Script_Extensions do not overlap: mixed, but no majority.
    result = run_operation("analyse-characters", {}, Dish.of_string("゙҅"))
    table = result.dish.value
    assert isinstance(table, Table)
    assert all("mixed-script" not in str(row[-1]) for row in table.rows)
    assert confusables.resolved_script_set("゙҅") == frozenset()
