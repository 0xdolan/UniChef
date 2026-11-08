# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fail if any file disagrees with VERSION (PRD §10.3 `ci / version-consistency`, REL-001),
or if the E2E container image is not the locked @playwright/test version (PRD §11.7),
or if debian/ppa-series.txt does not list the UBUNTU_SERIES constant (PRD §8.5).

uv run scripts/version/check.py
"""

import json
import re
import sys
from pathlib import Path

from versions import VersionError, existing_targets, read_version


ROOT = Path(__file__).resolve().parents[2]
LOCK = ROOT / "pnpm-lock.yaml"
COMPOSE = ROOT / "docker" / "docker-compose.yml"
CONSTANTS = ROOT / "project.constants.json"
PPA_SERIES = ROOT / "debian" / "ppa-series.txt"


def series_problems() -> list[str]:
    """debian/ppa-series.txt must list exactly the UBUNTU_SERIES constant, in order."""
    if not PPA_SERIES.exists():
        return []
    want = json.loads(CONSTANTS.read_text(encoding="utf-8"))["UBUNTU_SERIES"]
    lines = PPA_SERIES.read_text(encoding="utf-8").splitlines()
    got = [s.strip() for s in lines if s.strip() and not s.lstrip().startswith("#")]
    if got != want:
        return [f"debian/ppa-series.txt: {got}, expected UBUNTU_SERIES {want}"]
    return []


def playwright_problems() -> list[str]:
    """The compose e2e image tag must equal the @playwright/test version in pnpm-lock.yaml."""
    if not LOCK.exists() or not COMPOSE.exists():
        return []
    locked = set(re.findall(r"^  '@playwright/test@([^']+)':$", LOCK.read_text(), re.M))
    images = set(
        re.findall(r"mcr\.microsoft\.com/playwright:v([\w.-]+?)-\w+$", COMPOSE.read_text(), re.M)
    )
    if not locked and not images:
        return []
    if len(locked) != 1:
        return [f"{LOCK.name}: expected one @playwright/test version, found {sorted(locked)}"]
    want = locked.pop()
    return [
        f"docker/docker-compose.yml: playwright image v{tag}, expected v{want}"
        for tag in sorted(images or {"(none)"})
        if tag != want
    ]


def main() -> int:
    try:
        v = read_version()
        _ = v.extension
    except VersionError as e:
        print(f"error: VERSION: {e}", file=sys.stderr)
        return 1
    problems = []
    for t in existing_targets():
        for field, found in zip(t.fields, t.read(), strict=True):
            want = field.expected(v)
            if found is None:
                problems.append(f"{t.path}: no version found")
            elif found != want:
                problems.append(f"{t.path}: {found!r}, expected {want!r}")
    problems += playwright_problems() + series_problems()
    for p in problems:
        print(f"mismatch: {p}", file=sys.stderr)
    status = "ok" if not problems else f"{len(problems)} problem(s)"
    print(f"version-consistency: {v.semver}: {status}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
