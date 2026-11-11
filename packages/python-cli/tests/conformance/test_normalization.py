# SPDX-License-Identifier: GPL-3.0-or-later
"""Every line of NormalizationTest.txt, all forms, plus the Part 1 invariants (FR-020)."""

from pathlib import Path

import pytest

from conftest import UCD_DIR, ucd_version
from unichef.unicode import normalize as nf
from unichef.unicode.data import UCD_VERSION
from unichef.unicode.names import S_BASE, S_COUNT

pytestmark = pytest.mark.conformance

TEST_FILE = UCD_DIR / ucd_version() / "NormalizationTest.txt"


def _parse(path: Path) -> tuple[list[tuple[int, list[str]]], set[int]]:
    cases: list[tuple[int, list[str]]] = []
    part1: set[int] = set()
    part = ""
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        body = line.split("#", 1)[0].strip()
        if not body:
            continue
        if body.startswith("@"):
            part = body
            continue
        fields = body.split(";")[:5]
        columns = ["".join(chr(int(h, 16)) for h in f.split()) for f in fields]
        cases.append((number, columns))
        if part == "@Part1":
            part1.add(ord(columns[0]))
    return cases, part1


CASES, PART1 = _parse(TEST_FILE)


def test_data_version_matches_project_constants() -> None:
    assert ucd_version() == UCD_VERSION


def test_every_line() -> None:
    failures: list[str] = []
    for number, (c1, c2, c3, c4, c5) in CASES:
        expected: dict[str, list[tuple[str, tuple[str, ...]]]] = {
            "NFC": [(c2, (c1, c2, c3)), (c4, (c4, c5))],
            "NFD": [(c3, (c1, c2, c3)), (c5, (c4, c5))],
            "NFKC": [(c4, (c1, c2, c3, c4, c5))],
            "NFKD": [(c5, (c1, c2, c3, c4, c5))],
        }
        for form, checks in expected.items():
            for want, sources in checks:
                for source in sources:
                    got = nf.normalize(form, source)  # type: ignore[arg-type]  # form literal
                    if got != want:
                        failures.append(
                            f"line {number} {form}({source!r}) = {got!r}, want {want!r}"
                        )
    assert len(CASES) > 10_000
    assert not failures, f"{len(failures)} failures, first: {failures[:5]}"


def test_part1_invariants() -> None:
    """Code points not listed in Part 1 are unchanged by every form.

    A lone code point is unchanged by every form exactly when it has no decomposition
    (composition only joins sequences), so every decomposable one must be in Part 1.
    """
    hangul = range(S_BASE, S_BASE + S_COUNT)
    decomposable = set(nf._decompositions()[1]) | set(hangul)
    assert decomposable <= PART1, sorted(f"{cp:04X}" for cp in decomposable - PART1)[:10]
    for cp in (0x41, 0x0378, 0x10FFFF, 0x1F600, 0x0301):
        assert all(nf.normalize(form, chr(cp)) == chr(cp) for form in nf.FORMS)
