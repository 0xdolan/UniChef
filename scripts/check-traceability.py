# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fail if a PRD requirement ID is referenced by no test or CI workflow (PRD §0.3, §11.6).

Requirement IDs (FR-, NFR-, SEC-, REL-, GOV- plus three digits) are read from
UniChef-PRD.md. An ID is covered when it appears in a test file (Python tests, TypeScript
tests, the scripts' own tests, Playwright specs) or in a workflow under .github/workflows.

IDs for work that does not exist yet are listed in scripts/traceability-pending.txt. The
check also fails when a pending ID becomes covered, so the list only shrinks.

    uv run scripts/check-traceability.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRD = ROOT / "UniChef-PRD.md"
PENDING = ROOT / "scripts" / "traceability-pending.txt"
ID = re.compile(r"\b(?:FR|NFR|SEC|REL|GOV)-\d{3}\b")
SOURCES = (
    "packages/python-cli/tests/**/*.py",
    "packages/npm-core/test/**/*.ts",
    "scripts/**/test_*.py",
    "clients/**/e2e/**/*.ts",
    "clients/**/*.test.ts",
    ".github/workflows/*.yml",
)


def covered_ids() -> set[str]:
    found: set[str] = set()
    for pattern in SOURCES:
        for path in ROOT.glob(pattern):
            if "node_modules" not in path.parts:
                found.update(ID.findall(path.read_text(encoding="utf-8", errors="replace")))
    return found


def pending_ids() -> set[str]:
    lines = PENDING.read_text(encoding="utf-8").splitlines()
    return {line.split("#")[0].strip() for line in lines} - {""}


def main() -> int:
    required = set(ID.findall(PRD.read_text(encoding="utf-8")))
    covered = covered_ids()
    pending = pending_ids()
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
