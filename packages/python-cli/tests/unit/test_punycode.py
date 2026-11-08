# SPDX-License-Identifier: GPL-3.0-or-later
"""Punycode and UTS #46 paths that the shared vectors cannot reach."""

import pytest

from unichef.core.dish import Dish
from unichef.core.errors import UniChefError
from unichef.core.runner import run_operation
from unichef.unicode import idna

OVERFLOW = "a" * 2048 + "\U0010ffff"  # (0x10FFFF - 0x80) * 2049 > 2**31 - 1


def _run(op: str, text: str, **args: object) -> str:
    value = run_operation(op, args, Dish("string", text)).dish.value
    assert isinstance(value, str)
    return value


def test_encode_overflow_is_a_limit_error() -> None:
    with pytest.raises(UniChefError) as exc:
        _run("to-punycode", OVERFLOW)
    assert exc.value.code == "E_LIMIT"


def test_to_ascii_reports_a_label_it_cannot_encode() -> None:
    flags = idna.Flags(False, False, False, False)
    with pytest.raises(UniChefError, match="cannot be encoded as Punycode"):
        idna.to_ascii("b" * 20000 + "\U0001f600", flags, False)  # 0x1F580 * 20001 > 2**31


def test_decode_rejects_large_numbers() -> None:
    for text in ("9" * 12, "a-" + "9" * 12, "a-zzzzzzzzzz9"):
        with pytest.raises(idna.PunycodeError):
            idna.punycode_decode(text)


def test_round_trip_long_input() -> None:
    text = "".join(chr(cp) for cp in range(0x400, 0x400 + 5000))
    encoded = idna.punycode_encode(text)
    assert encoded.isascii()
    assert idna.punycode_decode(encoded) == text


def test_cancellation_is_checked() -> None:
    calls: list[int] = []
    idna.punycode_encode("é" * 5000, lambda: calls.append(1))
    idna.punycode_decode(idna.punycode_encode("é" * 5000), lambda: calls.append(2))
    assert 1 in calls and 2 in calls
