# SPDX-License-Identifier: GPL-3.0-or-later
# /// script
# requires-python = ">=3.12"
# ///
"""Cross-check that both cores ran every shared vector (PRD §11.2, FR-010).

Usage: uv run scripts/parity-report.py <python-junit.xml> <typescript-junit.xml>

Each report must contain exactly one passing test per case in spec/vectors, grouped by
vector file. Pytest escapes non-ASCII test ids, so cases are counted per file rather than
matched by name; file names are ASCII.
"""

import json
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from collections.abc import Callable
from pathlib import Path

VECTORS = Path(__file__).resolve().parent.parent / "spec" / "vectors"


def expected() -> Counter[str]:
    counts: Counter[str] = Counter()
    for path in sorted(VECTORS.rglob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        counts[f"{path.parent.name}/{path.stem}"] = len(doc["cases"])
    return counts


def passed(report: Path, key: Callable[[str], str | None]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for case in ET.parse(report).getroot().iter("testcase"):
        if any(child.tag in ("failure", "error", "skipped") for child in case):
            continue
        file = key(case.get("name", ""))
        if file is not None:
            counts[file] += 1
    return counts


def python_key(name: str) -> str | None:
    if not name.startswith("test_vector[") or "::" not in name:
        return None
    return name[len("test_vector[") :].split("::", 1)[0]


def typescript_key(name: str) -> str | None:
    if " > " not in name:
        return None
    file = name.split(" > ", 1)[0]
    return None if file == "vector coverage" else file


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    want = expected()
    problems = []
    for label, report, key in (
        ("python", Path(argv[1]), python_key),
        ("typescript", Path(argv[2]), typescript_key),
    ):
        got = passed(report, key)
        for file in sorted(want.keys() | got.keys()):
            if got[file] != want[file]:
                problems.append(f"{label}: {file}: {got[file]} of {want[file]} cases passed")
    total = sum(want.values())
    if problems:
        print("\n".join(problems), file=sys.stderr)
        print(f"parity: FAILED ({len(problems)} mismatches, {total} cases)", file=sys.stderr)
        return 1
    print(f"parity: OK, both cores passed all {total} cases in {len(want)} vector files")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
