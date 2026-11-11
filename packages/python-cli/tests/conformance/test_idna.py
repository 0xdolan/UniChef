# SPDX-License-Identifier: GPL-3.0-or-later
"""Every line of IdnaTestV2.txt: toUnicode and nontransitional toASCII, all flags on.

UTS #46 asks only that an error is reported, not which one, so error lines check that
the call fails with E_DECODE.
"""

import re
from pathlib import Path

import pytest

from conftest import UCD_DIR, ucd_version
from unichef.core.errors import UniChefError
from unichef.unicode import idna

pytestmark = pytest.mark.conformance

TEST_FILE = UCD_DIR / ucd_version() / "idna" / "IdnaTestV2.txt"
ESCAPE = re.compile(r"\\u([0-9A-Fa-f]{4})|\\x\{([0-9A-Fa-f]+)\}")
FLAGS = idna.Flags()

Case = tuple[int, str, str, bool, str, bool]


def _unescape(field: str) -> str:
    text = ESCAPE.sub(lambda m: chr(int(m.group(1) or m.group(2), 16)), field)
    return "" if text == '""' else text


def _parse(path: Path) -> list[Case]:
    cases: list[Case] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        body = line.split("#", 1)[0]
        if not body.strip():
            continue
        f = [c.strip() for c in body.split(";")]
        source = _unescape(f[0])
        to_unicode = _unescape(f[1]) if f[1] else source
        unicode_error = bool(f[2].strip("[]"))
        to_ascii = _unescape(f[3]) if f[3] else to_unicode
        ascii_error = bool(f[4].strip("[]")) if f[4] else unicode_error
        cases.append((number, source, to_unicode, unicode_error, to_ascii, ascii_error))
    return cases


CASES = _parse(TEST_FILE)


def _run(call: object, *args: object) -> str | None:
    try:
        return call(*args)  # type: ignore[operator, no-any-return]
    except UniChefError as exc:
        assert exc.code == "E_DECODE"
        return None


def test_file_is_not_empty() -> None:
    assert len(CASES) > 6000


def test_every_line() -> None:
    failures: list[str] = []
    for number, source, uni, uni_err, asc, asc_err in CASES:
        got = _run(idna.to_unicode, source, FLAGS)
        if (got is None) != uni_err or (not uni_err and got != uni):
            failures.append(f"line {number} toUnicode({source!r}) = {got!r}, want {uni!r}")
        got = _run(idna.to_ascii, source, FLAGS, True)
        if (got is None) != asc_err or (not asc_err and got != asc):
            failures.append(f"line {number} toASCII({source!r}) = {got!r}, want {asc!r}")
    assert not failures, f"{len(failures)} failures:\n" + "\n".join(failures[:20])
