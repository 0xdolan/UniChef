# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# SPDX-License-Identifier: GPL-3.0-or-later
"""Compile the pinned WHATWG named character references into html-entities.json.gz.

Reads data/html/entities.json, checks its SHA-256 against data/html/entities.lock.json and
writes the artefact, byte-identically, to every directory in OUT_DIRS. The output is
deterministic: sorted keys, compact separators, gzip level 9 with mtime 0.

    uv run scripts/html/build.py            # build and write the artefact
    uv run scripts/html/build.py --check    # rebuild in memory, fail on any drift
    uv run scripts/html/build.py --fetch    # download entities.json (HTTPS), verify, build
"""

import argparse
import gzip
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "html"
SOURCE = DATA / "entities.json"
LOCK = DATA / "entities.lock.json"
NAME = "html-entities.json.gz"
OUT_DIRS = (
    ROOT / "packages" / "python-cli" / "src" / "unichef" / "_data",
    ROOT / "packages" / "npm-core" / "data",
)
BUDGET = 32 * 1024  # gzip bytes
MAX_CODE_POINT = 0x10FFFF
TIMEOUT_S = 60


class BuildError(Exception):
    pass


def lock() -> dict[str, str]:
    data: dict[str, str] = json.loads(LOCK.read_text(encoding="utf-8"))
    return data


def fetch() -> None:
    url = lock()["url"]
    if not url.startswith("https://"):
        raise BuildError(f"Refusing a non-HTTPS URL: {url}")
    with urllib.request.urlopen(url, timeout=TIMEOUT_S) as response:  # noqa: S310 - https only
        data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != lock()["sha256"]:
        raise BuildError(f"{url} has SHA-256 {digest}, the lock pins {lock()['sha256']}.")
    SOURCE.write_bytes(data)


def build() -> tuple[bytes, bytes]:
    data = SOURCE.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != lock()["sha256"]:
        raise BuildError(f"{SOURCE.name} has SHA-256 {digest}, the lock pins {lock()['sha256']}.")
    entities: dict[str, list[int]] = {}
    for key, value in json.loads(data).items():
        cps = value["codepoints"]
        if not key.startswith("&") or not 1 <= len(cps) <= 2:  # noqa: PLR2004
            raise BuildError(f"Unexpected entity {key!r}.")
        if not all(0 < cp <= MAX_CODE_POINT for cp in cps):
            raise BuildError(f"Entity {key!r} has an invalid code point.")
        entities[key[1:]] = cps
    obj = {"sha256": digest, "url": lock()["url"], "entities": entities}
    raw = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    gz = gzip.compress(raw, compresslevel=9, mtime=0)
    if len(gz) > BUDGET:
        raise BuildError(f"{NAME} is {len(gz):,} bytes gzipped; the budget is {BUDGET:,}.")
    return raw, gz


def drift(raw: bytes) -> list[str]:
    problems = []
    copies = []
    for d in OUT_DIRS:
        path = d / NAME
        if not path.exists():
            problems.append(f"{path.relative_to(ROOT)} is missing.")
            continue
        copies.append(path.read_bytes())
        if gzip.decompress(copies[-1]) != raw:
            problems.append(f"{path.relative_to(ROOT)} differs from a fresh build.")
    if len(set(copies)) > 1:
        problems.append(f"The copies of {NAME} are not byte-identical.")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="fail if the artefact drifts")
    mode.add_argument("--fetch", action="store_true", help="download and verify the source")
    args = ap.parse_args()
    try:
        if args.fetch:
            fetch()
        raw, gz = build()
        if args.check:
            problems = drift(raw)
            for p in problems:
                print(f"drift: {p}", file=sys.stderr)
            print("html-drift: ok" if not problems else f"html-drift: {len(problems)} problem(s)")
            return 1 if problems else 0
        for d in OUT_DIRS:
            d.mkdir(parents=True, exist_ok=True)
            (d / NAME).write_bytes(gz)
        print(f"{NAME}: {len(raw):,} bytes raw, {len(gz):,} bytes gzip")
        return 0
    except BuildError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
