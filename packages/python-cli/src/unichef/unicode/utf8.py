# SPDX-License-Identifier: GPL-3.0-or-later
"""In-house UTF-8 codec (PRD §3.2 rules 1-2, §16.3).

The decoder accepts exactly the well-formed byte sequences of Unicode Table 3-7 and
replaces each maximal subpart of an ill-formed sequence with one U+FFFD (Unicode
Ch. 3, "U+FFFD Substitution of Maximal Subparts"). A BOM is kept as U+FEFF.
"""

import re
from collections.abc import Callable

REPLACEMENT = "�"
_ASCII_RUN = re.compile(rb"[\x00-\x7f]+")
_SURROGATE = re.compile("[\ud800-\udfff]")
CHUNK = 64 * 1024

SURROGATES = range(0xD800, 0xE000)
HIGH_SURROGATES = range(0xD800, 0xDC00)
LOW_SURROGATES = range(0xDC00, 0xE000)

# Table 3-7: the byte after these leads has a narrower range than 80..BF.
_SECOND_BYTE = {0xE0: (0xA0, 0xBF), 0xED: (0x80, 0x9F), 0xF0: (0x90, 0xBF), 0xF4: (0x80, 0x8F)}
_CONTINUATION = (0x80, 0xBF)
# Sequence length per lead byte; 0 for bytes that can never start a sequence.
_LENGTH = bytearray(256)
for _lead in range(0xC2, 0xE0):
    _LENGTH[_lead] = 2
for _lead in range(0xE0, 0xF0):
    _LENGTH[_lead] = 3
for _lead in range(0xF0, 0xF5):
    _LENGTH[_lead] = 4


def _second_byte_range(lead: int) -> tuple[int, int]:
    """Allowed range of the byte after ``lead`` (Table 3-7)."""
    return _SECOND_BYTE.get(lead, _CONTINUATION)


def _sequence_length(lead: int) -> int:
    """Length of the sequence ``lead`` starts, or 0 if it can never start one."""
    return _LENGTH[lead]


def decode(data: bytes, check: Callable[[], None] | None = None) -> str:
    """Decode ``data`` as UTF-8 with maximal-subpart U+FFFD substitution."""
    out: list[str] = []
    i = 0
    n = len(data)
    next_check = CHUNK
    while i < n:
        if check is not None and i >= next_check:
            check()
            next_check = i + CHUNK
        m = _ASCII_RUN.match(data, i)
        if m is not None:
            out.append(m.group().decode("ascii"))
            i = m.end()
            continue
        lead = data[i]
        size = _sequence_length(lead)
        if size == 0:
            out.append(REPLACEMENT)
            i += 1
            continue
        cp = lead & (0x3F >> (size - 1))
        lo, hi = _second_byte_range(lead)
        j = i + 1
        while j < i + size:
            if j >= n or not lo <= data[j] <= hi:
                break
            cp = (cp << 6) | (data[j] & 0x3F)
            lo, hi = 0x80, 0xBF
            j += 1
        if j == i + size:
            out.append(chr(cp))
        else:
            # The maximal subpart is lead plus every continuation byte accepted so far.
            out.append(REPLACEMENT)
        i = j
    return "".join(out)


def scrub(text: str) -> str:
    """Replace each lone surrogate with U+FFFD (PRD §3.2 rule 1)."""
    return _SURROGATE.sub(REPLACEMENT, text)


def encode(text: str) -> bytes:
    """Encode ``text`` as UTF-8, turning lone surrogates into EF BF BD."""
    return scrub(text).encode("utf-8")
