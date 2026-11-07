# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fail if a PRD requirement ID is referenced by no test or CI workflow (PRD §0.3, §11.6).

Requirement IDs (FR-, NFR-, SEC-, REL-, GOV- plus three digits) are listed in
scripts/traceability-ids.txt. The PRD itself is kept local, so when UniChef-PRD.md is
present the check also fails if that list is out of date; `--write` regenerates it. An ID
is covered when it appears in a test file (Python tests, TypeScript tests, the scripts' own
tests, Playwright specs) or in a workflow under .github/workflows.

IDs for work that does not exist yet are listed in scripts/traceability-pending.txt. The
check also fails when a pending ID becomes covered, so the list only shrinks.

    uv run scripts/check-traceability.py [--write]
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRD = ROOT / "UniChef-PRD.md"
IDS = ROOT / "scripts" / "traceability-ids.txt"
PENDING = ROOT / "scripts" / "traceability-pending.txt"
ID = re.compile(r"\b(?:FR|NFR|SEC|REL|GOV)-\d{3}\b")
SOURCES = (
    "packages/python-cli/tests/**/*.py",
    "packages/npm-core/test/**/*.ts",
    "scripts/**/test_*.py",
    "clients/**/e2e/**/*.ts",
    "clients/**/*.test.ts",
    "clients/**/*.test.tsx",
    ".github/workflows/*.yml",
)


def covered_ids() -> set[str]:
    found: set[str] = set()
    for pattern in SOURCES:
        for path in ROOT.glob(pattern):
            if "node_modules" not in path.parts:
                found.update(ID.findall(path.read_text(encoding="utf-8", errors="replace")))
    return found


def listed_ids(path: Path) -> set[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return {line.split("#")[0].strip() for line in lines} - {""}


def main() -> int:
    if PRD.exists() and "--write" in sys.argv[1:]:
        in_prd = sorted(set(ID.findall(PRD.read_text(encoding="utf-8"))))
        header = f"# Requirement IDs in {PRD.name}; regenerate with --write.\n"
        IDS.write_text(header + "".join(f"{i}\n" for i in in_prd), encoding="utf-8")
    required = listed_ids(IDS)
    if PRD.exists() and set(ID.findall(PRD.read_text(encoding="utf-8"))) != required:
        print(f"traceability: {IDS.name} is out of date; run with --write", file=sys.stderr)
        return 1
    covered = covered_ids()
    pending = listed_ids(PENDING)
    problems = [
        *(f"{i} is not referenced by any test or CI step" for i in required - covered - pending),
        *(f"{i} is covered now; remove it from {PENDING.name}" for i in pending & covered),
        *(f"{i} in {PENDING.name} is not a PRD requirement" for i in pending - required),
    ]
    for p in sorted(problems):
        print(f"traceability: {p}", file=sys.stderr)
    done = len(required & covered)
    print(f"traceability: {done}/{len(required)} covered, {len(pending)} pending")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
