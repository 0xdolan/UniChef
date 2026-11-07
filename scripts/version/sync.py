# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Set the project version in every file that carries it (PRD §10.5, REL-001).

Writes VERSION, then each target in versions.TARGETS in the form that file needs (SemVer,
PEP 440, npm, extension manifest). Targets whose files do not exist yet are reported and
skipped. CHANGELOG.md: the [Unreleased] entries move under a new [X.Y.Z] heading.

    uv run scripts/version/sync.py 0.2.0-alpha.1
    uv run scripts/version/sync.py 0.2.0 --date 2026-12-01
"""

import argparse
import datetime as dt
import sys

from versions import ROOT, Version, VersionError, existing_targets, missing_targets

CHANGELOG = ROOT / "CHANGELOG.md"
UNRELEASED = "## [Unreleased]"


def promote_changelog(text: str, version: str, date: str) -> str:
    """Move the [Unreleased] section under ``## [version] - date``; keep [Unreleased] empty."""
    heading = f"## [{version}]"
    if any(line.startswith(heading) for line in text.splitlines()):
        return text
    if UNRELEASED not in text:
        raise VersionError(f"{CHANGELOG.name} has no {UNRELEASED!r} heading.")
    return text.replace(UNRELEASED, f"{UNRELEASED}\n\n{heading} - {date}", 1)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("version", help="SemVer: X.Y.Z or X.Y.Z-(alpha|beta|rc).N")
    ap.add_argument("--date", default=dt.date.today().isoformat(), help="release date")
    args = ap.parse_args()
    try:
        v = Version.parse(args.version)
        _ = v.extension  # reject versions the extension stores cannot represent
        for t in existing_targets():
            print(f"{'updated' if t.write(v) else 'unchanged'}: {t.path}")
        for t in missing_targets():
            print(f"skipped (not created yet): {t.path}")
        text = CHANGELOG.read_text(encoding="utf-8")
        new = promote_changelog(text, v.semver, args.date)
        if new != text:
            CHANGELOG.write_text(new, encoding="utf-8")
            print(f"updated: {CHANGELOG.name} ([Unreleased] -> [{v.semver}])")
    except VersionError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"version: {v.semver} (PyPI {v.pep440}, Debian {v.debian}, extension {v.extension})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
