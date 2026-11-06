# SPDX-License-Identifier: GPL-3.0-or-later
"""In-house UTF-8 codec (PRD §16.3 required cases)."""

import pytest
from hypothesis import given
from hypothesis import strategies as st

from unichef.unicode import utf8

R = "�"


@pytest.mark.parametrize(
    ("data", "text"),
    [
        (b"", ""),
        (b"abc", "abc"),
        (b"\xc0\x80", R + R),
        (b"\xed\xa0\x80", R + R + R),
        (b"\xf4\x90\x80\x80", R * 4),
        (b"\xe0\x80\x41", R + R + "A"),
        (b"\xe2\x82", R),
        (b"\xf0\x9f\x98", R),
        (b"\xf0\x9f\x98\x80", "\U0001f600"),
        (b"\xef\xbb\xbfA", "﻿A"),
        (b"\x80\xbf", R + R),
        (b"\xf5\x80", R + R),
        (b"\xe1\x80\xe2\x82\xac", R + "€"),
        (b"\xc2", R),
        (b"\xf4\x8f\xbf\xbf", "\U0010ffff"),
    ],
)
def test_decode_maximal_subparts(data: bytes, text: str) -> None:
    assert utf8.decode(data) == text


@given(st.binary(max_size=64))
def test_decode_matches_reference_replacement(data: bytes) -> None:
    # CPython's "replace" handler also implements maximal-subpart substitution; it is an
    # independent oracle here, never a dependency of the product code.
    assert utf8.decode(data) == data.decode("utf-8", "replace")


@given(st.text())
def test_round_trip(text: str) -> None:
    assert utf8.decode(utf8.encode(text)) == utf8.scrub(text)


def test_encode_replaces_lone_surrogates() -> None:
    assert utf8.encode("a\ud800b\udfff") == b"a\xef\xbf\xbdb\xef\xbf\xbd"


def test_decode_calls_check_on_large_input() -> None:
    calls: list[int] = []
    utf8.decode(b"\xc3\xa9" * (utf8.CHUNK + 10), lambda: calls.append(1))
    assert calls
