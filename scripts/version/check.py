# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fail if any file disagrees with VERSION (PRD §10.3 `ci / version-consistency`, REL-001).

uv run scripts/version/check.py
"""

import sys

from versions import VersionError, existing_targets, read_version


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
    for p in problems:
        print(f"mismatch: {p}", file=sys.stderr)
    status = "ok" if not problems else f"{len(problems)} problem(s)"
    print(f"version-consistency: {v.semver}: {status}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
