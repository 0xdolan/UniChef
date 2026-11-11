# SPDX-License-Identifier: GPL-3.0-or-later
"""The portable regex profile: parsing, both serialisations and matching (PRD §4.9)."""

import pytest

from unichef.core.errors import UniChefError
from unichef.regex import profile, run
from unichef.regex.translate import translate


def matches(pattern: str, text: str, flags: str = "") -> list[str]:
    compiled = run.compile_regex(pattern, flags)
    return [text[m.start : m.end] for m in run.finditer(compiled, text, 2000)]


def error(pattern: str, flags: str = "") -> str:
    with pytest.raises(UniChefError) as info:
        translate(pattern, flags)
    return info.value.code


@pytest.mark.parametrize(
    "pattern",
    [
        "(",
        ")",
        "a)",
        "*a",
        "a|+",
        "[a",
        "[z-a]",
        "[\\d-z]",
        "a{2,1}",
        "a{70000}",
        "{",
        "}",
        "]",
        "a{",
        "a{1",
        "(?<1x>a)",
        "(?<n>a)(?<n>b)",
        "\\k",
        "\\k<zz>",
        "\\2",
        "(a)\\2",
        "[\\1]",
        "\\p",
        "\\p{",
        "\\p{Greek}",
        "\\p{Nope}",
        "\\p{gc=Nope}",
        "\\p{WSpace=maybe}",
        "\\x",
        "\\xZZ",
        "\\u12",
        "\\u{}",
        "\\u{110000}",
        "\\u{1234567}",
        "\\",
        "^*",
        "(?=a)+",
        "\\b+",
    ],
)
def test_invalid_patterns(pattern: str) -> None:
    assert error(pattern) == "E_ARG_INVALID"


@pytest.mark.parametrize(
    "pattern",
    [
        "a++",
        "a*+",
        "(?>a)",
        "(?(1)a|b)",
        "(?P<n>a)",
        "(?|a)",
        "(?#c)",
        "(?i)a",
        "(?R)",
        "(?1)",
        "[[:alpha:]]",
        "[[a]]",
        "[a&&b]",
        "[a--b]",
        "\\01",
        "\\X",
        "\\G",
        "\\N",
        "\\p{bc=L}",
    ],
)
def test_unsupported_patterns(pattern: str) -> None:
    assert error(pattern) == "E_REGEX_UNSUPPORTED"


def test_flags() -> None:
    assert error("a", "g") == "E_ARG_INVALID"
    assert error("a", "ii") == "E_ARG_INVALID"
    assert translate("a", "smi").flags == "ims"
    assert error("(a)\\1", "i") == "E_REGEX_UNSUPPORTED"


@pytest.mark.parametrize(
    ("pattern", "js"),
    [
        ("abc", "abc"),
        ("a.b", "a[^\\u{A}\\u{D}\\u{2028}-\\u{2029}]b"),
        ("a|b", "a|b"),
        ("x(?:a|b)", "x(?:a|b)"),
        ("(a)\\1", "(a)(?:\\1)"),
        ("(?<n>a)\\k<n>", "(?<n>a)(?:\\k<n>)"),
        ("a+?b{2}c{1,}d{0,3}", "a+?b{2}c+d{0,3}"),
        ("(?:ab)*", "(?:ab)*"),
        ("^a$", "^a$"),
        ("[^]", "[\\u{0}-\\u{10FFFF}]"),
        ("[]", "(?!)"),
        ("\\u{1F600}", "\\u{1F600}"),
        ("\\uD83D\\uDE00", "\\u{1F600}"),
        ("a-b", "a\\u{2D}b"),
        ("(?<=a)b(?!c)", "(?<=a)b(?!c)"),
    ],
)
def test_js_serialisation(pattern: str, js: str) -> None:
    assert translate(pattern).js == js


def test_python_serialisation_uses_capital_u_escapes() -> None:
    translation = translate("\\u{1F600}-(a)\\1")
    assert translation.python == "\\U0001F600\\U0000002D(a)\\g<1>"
    assert translation.groups == 1
    assert translate("(?<y>a)(b)").names == ("y",)


def test_anchors_are_spelled_out() -> None:
    assert translate("a$").python.endswith("\\Z")
    assert translate("^", "m").js.startswith("(?<![^")
    assert "(?<=" in translate("\\b").js
    assert translate("\\B").js != translate("\\b").js


def test_classes_use_the_shorter_form() -> None:
    assert translate("[^a]").js == "[^a]"
    assert translate("[a-c]").js == "[a-c]"
    assert translate("\\D").js.startswith("[^")


@pytest.mark.parametrize(
    ("pattern", "flags", "text", "found"),
    [
        ("a*", "", "baaa", ["", "aaa", ""]),
        (".", "", "a\nb", ["a", "b"]),
        (".", "s", "a\nb", ["a", "\n", "b"]),
        ("^\\w", "m", "ab\ncd ef", ["a", "c", "e"]),
        ("\\w$", "m", "ab\r\ncd", ["b", "d"]),
        ("\\bx", "", "x ax xé", ["x", "x"]),
        ("\\Bx", "", "x ax", ["x"]),
        ("k", "i", "kKK", ["k", "K", "K"]),
        ("[a-c]+", "i", "xABCx", ["ABC"]),
        ("\\d+", "", "1١१x", ["1١१"]),
        ("\\s", "", "a　b\u200bc", ["　"]),
        ("\\p{Lu}", "", "aBcÉ", ["B", "É"]),
        ("\\P{L}", "", "a1", ["1"]),
        ("\\p{scx=Grek}", "", "aα", ["α"]),
        ("\\p{blk=Basic_Latin}+", "", "abé", ["ab"]),
        ("\\p{Emoji=no}", "", "\U0001f600a", ["a"]),
        ("\\p{White_Space}", "", "a b", [" "]),
        ("a # comment\n b", "x", "ab", ["ab"]),
        ("[ ]", "x", "a b", [" "]),
        ("\\x41\\u0042\\t\\n\\0", "", "AB\t\n\x00", ["AB\t\n\x00"]),
        ("[\\x41-\\x43\\-]+", "", "ABC-D", ["ABC-"]),
        ("[\\b]", "", "a\bb", ["\b"]),
        ("\\$\\.", "", "$.", ["$."]),
        ("\\/", "", "a/b", ["/"]),
        ("(?<=\\$)\\d", "", "$1 2", ["1"]),
        ("[^\\d\\s]", "", "1 a", ["a"]),
        ("\U0001f600+", "", "\U0001f600\U0001f600", ["\U0001f600\U0001f600"]),
    ],
)
def test_matching(pattern: str, flags: str, text: str, found: list[str]) -> None:
    assert matches(pattern, text, flags) == found


def test_search_positions_and_groups() -> None:
    compiled = run.compile_regex("(a)|(b)")
    match = run.search(compiled, "xb", 2000)
    assert match is not None
    assert match.span == (1, 2)
    assert match.spans == ((1, 2), None, (1, 2))
    assert match.group("xb", 1) is None
    assert run.search(compiled, "xb", 2000, pos=2) is None
    assert compiled.index("nope") is None


def test_expand_follows_javascript() -> None:
    compiled = run.compile_regex("(?<m>\\d\\d)/(?<y>\\d{4})")
    text = "05/2024"
    match = run.search(compiled, text, 2000)
    assert match is not None
    template = "$<y>-$<m> [$2$1] $& $$ $3 $9 $<zz> $x $"
    assert run.expand(template, match, text, compiled) == "2024-05 [202405] 05/2024 $ $3 $9  $x $"
    many = run.compile_regex("(a)" * 11)
    text = "a" * 11
    found = run.search(many, text, 2000)
    assert found is not None
    assert run.expand("$11|$1|$01", found, text, many) == "a|a|a"
    plain = run.compile_regex("a")
    hit = run.search(plain, "a", 2000)
    assert hit is not None
    assert run.expand("$<x>", hit, "a", plain) == "$<x>"


def test_predicate() -> None:
    test = run.predicate(run.compile_regex("LATIN", "i"), 2000)
    assert test("Latin small letter a")
    assert not test("GREEK")


def test_timeouts() -> None:
    slow = run.compile_regex("(a|aa)+b")
    text = "a" * 60
    for call in (
        lambda: run.search(slow, text, 50),
        lambda: run.predicate(slow, 50)(text),
        lambda: list(run.finditer(slow, text, 50)),
    ):
        with pytest.raises(UniChefError) as info:
            call()
        assert info.value.code == "E_REGEX_TIMEOUT"


def test_finditer_checks_cancellation() -> None:
    def cancel() -> None:
        raise UniChefError("E_CANCELLED", "stop")

    with pytest.raises(UniChefError) as info:
        list(run.finditer(run.compile_regex("a"), "aaa", 2000, cancel))
    assert info.value.code == "E_CANCELLED"


def test_class_sets() -> None:
    assert (0x5F, 0x5F) in profile.word()
    assert profile.close_case([(0x6B, 0x6B)]) == [(0x4B, 0x4B), (0x6B, 0x6B), (0x212A, 0x212A)]
    assert profile.property_ranges("WSpace=n") != profile.property_ranges("WSpace")
