# SPDX-License-Identifier: GPL-3.0-or-later
"""Every line of GraphemeBreakTest.txt (FR-021)."""

import pytest

from conftest import UCD_DIR, ucd_version
from unichef.unicode import segment

pytestmark = pytest.mark.conformance

TEST_FILE = UCD_DIR / ucd_version() / "auxiliary" / "GraphemeBreakTest.txt"


def _parse() -> list[tuple[int, list[int], list[int]]]:
    cases = []
    for number, line in enumerate(TEST_FILE.read_text(encoding="utf-8").splitlines(), 1):
        body = line.split("#", 1)[0].strip()
        if not body:
            continue
        cps: list[int] = []
        breaks: list[int] = []
        for token in body.split():
            if token == "÷":
                breaks.append(len(cps))
            elif token != "×":
                cps.append(int(token, 16))
        cases.append((number, cps, breaks))
    return cases


def test_every_line() -> None:
    cases = _parse()
    failures = [
        f"line {number}: {got} != {want}"
        for number, cps, want in cases
        if (got := list(segment.boundaries(cps))) != want
    ]
    assert len(cases) > 500
    assert not failures, f"{len(failures)} failures, first: {failures[:5]}"


def test_graphemes_and_count() -> None:
    family = "👨‍👩‍👧"
    assert segment.graphemes("éx" + family + "\r\n🇫🇷🇩") == [
        "é", "x", family, "\r\n", "🇫🇷", "🇩",
    ]  # fmt: skip
    assert segment.count("") == 0
    assert segment.graphemes("") == []
    assert segment.count("क्‍ष") == 1
    calls: list[int] = []
    assert len(list(segment.boundaries([0x61] * 70_000, lambda: calls.append(1)))) == 70_001
    assert calls
