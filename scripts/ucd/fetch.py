# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Download the pinned Unicode Character Database files and verify them (PRD §4.1.2).

Files go to data/ucd/<version>/ and their SHA-256 hashes to data/ucd/ucd.lock.json.
A file that is already present, or downloaded again, must match the lock: a mismatch
is a hard failure. With --offline nothing is downloaded and every file must be present.

    uv run scripts/ucd/fetch.py [--version 18.0.0] [--offline]
"""

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "ucd"
LOCK = DATA / "ucd.lock.json"
MAX_BYTES = 32 * 1024 * 1024
USER_AGENT = "UniChef-ucd-fetch (+https://github.com/0xdolan/unichef)"

# Paths relative to https://www.unicode.org/Public/<version>/ucd/ (PRD §4.1.1).
UCD_FILES = (
    "UnicodeData.txt",
    "NameAliases.txt",
    "Jamo.txt",
    "Blocks.txt",
    "Scripts.txt",
    "ScriptExtensions.txt",
    "PropertyAliases.txt",
    "PropertyValueAliases.txt",
    "DerivedAge.txt",
    "DerivedCoreProperties.txt",
    "PropList.txt",
    "DerivedNormalizationProps.txt",
    "CompositionExclusions.txt",
    "SpecialCasing.txt",
    "CaseFolding.txt",
    "EastAsianWidth.txt",
    "LineBreak.txt",
    "auxiliary/GraphemeBreakProperty.txt",
    "auxiliary/GraphemeBreakTest.txt",
    "emoji/emoji-data.txt",
    "extracted/DerivedBidiClass.txt",
    "extracted/DerivedGeneralCategory.txt",
    "extracted/DerivedJoiningType.txt",
    "extracted/DerivedName.txt",
    "NormalizationTest.txt",
)
SECURITY_FILES = ("confusables.txt", "IdentifierStatus.txt", "IdentifierType.txt")
IDNA_FILES = ("IdnaMappingTable.txt", "IdnaTestV2.txt")  # UTS #46
LICENSE_URL = "https://www.unicode.org/license.txt"


def constants_version() -> str:
    constants = json.loads((ROOT / "project.constants.json").read_text(encoding="utf-8"))
    return str(constants["UCD_VERSION"])


def sources(version: str) -> dict[str, str]:
    """Map each local relative path to its download URL."""
    base = f"https://www.unicode.org/Public/{version}"
    # UTS #39 data moved from Public/security/<v>/ to Public/<v>/security/ in Unicode 17.
    major = int(version.split(".")[0])
    sec = (
        f"{base}/security" if major >= 17 else f"https://www.unicode.org/Public/security/{version}"
    )
    urls = {name: f"{base}/ucd/{name}" for name in UCD_FILES}
    urls |= {f"security/{name}": f"{sec}/{name}" for name in SECURITY_FILES}
    idna = f"{base}/idna" if major >= 17 else f"https://www.unicode.org/Public/idna/{version}"
    urls |= {f"idna/{name}": f"{idna}/{name}" for name in IDNA_FILES}
    urls["license.txt"] = LICENSE_URL
    return urls


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(url: str) -> bytes:
    if not url.startswith("https://"):
        raise SystemExit(f"Refusing a non-HTTPS URL: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (HTTPS checked above)
        data: bytes = resp.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise SystemExit(f"{url} is larger than {MAX_BYTES} bytes.")
    return data


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".part")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "--version", default=constants_version(), help="UCD version (default: UCD_VERSION)"
    )
    ap.add_argument("--offline", action="store_true", help="verify only; never download")
    args = ap.parse_args()
    version: str = args.version

    lock: dict[str, Any] = {}
    if LOCK.exists():
        lock = json.loads(LOCK.read_text(encoding="utf-8"))
    locked: dict[str, dict[str, str]] = lock["files"] if lock.get("version") == version else {}
    if args.offline and not locked:
        print(f"error: ucd.lock.json has no entries for {version}.", file=sys.stderr)
        return 1

    folder = DATA / version
    files: dict[str, dict[str, str]] = {}
    failures = 0
    for rel, url in sorted(sources(version).items()):
        path = folder / rel
        expected = locked.get(rel, {}).get("sha256")
        if path.exists():
            data, action = path.read_bytes(), "present"
        elif args.offline:
            print(f"error: {rel} is missing and --offline is set.", file=sys.stderr)
            failures += 1
            continue
        else:
            data, action = download(url), "downloaded"
        digest = sha256(data)
        if expected and digest != expected:
            print(
                f"error: {rel}: SHA-256 {digest} does not match the lock ({expected}).",
                file=sys.stderr,
            )
            failures += 1
            continue
        if action == "downloaded":
            write_atomic(path, data)
        files[rel] = {"sha256": digest, "url": url}
        print(f"{action:10} {rel}")

    if failures:
        print(f"{failures} file(s) failed verification; the lock was not changed.", file=sys.stderr)
        return 1
    if not args.offline:
        text = json.dumps({"version": version, "files": files}, indent=2, sort_keys=True)
        LOCK.write_text(text + "\n", encoding="utf-8", newline="\n")
    print(f"UCD {version}: {len(files)} files verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
