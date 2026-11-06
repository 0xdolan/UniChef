# SPDX-License-Identifier: GPL-3.0-or-later
"""``unichef scan``: find bidi controls, invisible characters, confusables and mixed-script
identifiers in files (FR-004, Trojan Source CVE-2021-42574)."""

import argparse
import os
import re
from bisect import bisect_right
from collections.abc import Iterator
from fnmatch import fnmatchcase
from pathlib import Path

from rich.text import Text

from unichef.cli.envelope import table_json
from unichef.cli.parser import Command, SubFactory, UniChefParser
from unichef.cli.session import Session, rich_table
from unichef.core.dish import Cell, Dish, Table
from unichef.core.errors import UniChefError, quote_input

KINDS = ("bidi", "invisible", "confusable", "mixed-script")
COLUMNS = ("path", "line", "column", "kind", "cp", "name", "detail")
SKIP_DIRS = frozenset({".git", ".hg", ".svn"})
SNIFF = 8192
ASCII_END = 0x80
CHECK_EVERY = 4096
_WORD = re.compile(r"\w+")
_SAFE_LEVELS = frozenset({"ASCII-Only", "Single Script", "Highly Restrictive"})

type Finding = tuple[str, int, int, str, str, str, str]


def parse_kinds(text: str) -> frozenset[str]:
    kinds = {k.strip() for k in text.split(",") if k.strip()}
    unknown = sorted(kinds - set(KINDS))
    if unknown:
        raise argparse.ArgumentTypeError(
            f"unknown kind {unknown[0]!r}; choose from {', '.join(KINDS)}"
        )
    return frozenset(kinds)


def _wanted(rel: str, include: list[str], exclude: list[str]) -> bool:
    if include and not any(fnmatchcase(rel, p) for p in include):
        return False
    return not any(fnmatchcase(rel, p) for p in exclude)


def walk(paths: list[str], include: list[str], exclude: list[str]) -> Iterator[str]:
    """Files to scan, in a stable order. Named files are always scanned."""
    for given in paths:
        root = Path(given)
        if given == "-" or not root.is_dir():
            yield given
            continue
        for current, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
            for name in sorted(files):
                path = Path(current) / name
                rel = path.relative_to(root).as_posix()
                if _wanted(rel, include, exclude):
                    yield path.as_posix()


def scan_text(session: Session, label: str, text: str) -> list[Finding]:
    from unichef.core.ops.security import invisible_kind, restriction_level  # noqa: PLC0415
    from unichef.unicode import confusables, names  # noqa: PLC0415

    starts = [0] + [m.end() for m in re.finditer("\n", text)]

    def where(index: int) -> tuple[int, int]:
        line = bisect_right(starts, index)
        return line, index - starts[line - 1] + 1

    found: list[tuple[int, str, str, str, str]] = []
    for i, ch in enumerate(text):
        if i % CHECK_EVERY == 0:
            session.cancel_check()
        cp = ord(ch)
        if cp < ASCII_END:
            continue
        kind = invisible_kind(cp)
        if kind is not None:
            found.append((i, "bidi" if kind == "bidi-control" else "invisible",
                          f"U+{cp:04X}", names.preferred(cp), kind))  # fmt: skip
            continue
        proto = confusables.prototype(cp)
        if proto is not None:
            looks = " ".join(f"U+{p:04X}" for p in proto)
            found.append((i, "confusable", f"U+{cp:04X}", names.preferred(cp),
                          f"looks like {looks}"))  # fmt: skip
    for word in _WORD.finditer(text):
        token = word[0]
        if token.isascii():
            continue
        level = restriction_level(token, profile=False)
        if level not in _SAFE_LEVELS:
            found.append((word.start(), "mixed-script", "", token, level))
    found.sort(key=lambda f: (f[0], KINDS.index(f[1])))
    return [(label, *where(i), kind, cp, name, detail) for i, kind, cp, name, detail in found]


def _decode(data: bytes) -> str | None:
    if b"\x00" in data[:SNIFF]:
        return None
    return data.decode("utf-8", errors="replace")


def run_scan(session: Session, ns: argparse.Namespace) -> None:
    findings: list[Finding] = []
    files = 0
    for path in walk(ns.paths, ns.include, ns.exclude):
        if path != "-" and not Path(path).exists():
            raise UniChefError("E_INPUT_IO", f"Cannot read {quote_input(path)} (no such file).")
        text = _decode(session.read_bytes(path))
        if text is None:
            continue
        files += 1
        findings += scan_text(session, "<stdin>" if path == "-" else path, text)
    rows: tuple[tuple[Cell, ...], ...] = tuple(findings)
    table = Table(COLUMNS, rows)
    session.notice(f"Scanned {files} file(s): {len(findings)} finding(s).")
    pretty = rich_table(table) if findings else Text("No findings.", style="ok")
    failing = [f for f in findings if f[3] in ns.fail_on]
    if not failing:
        session.emit(Dish("table", table), pretty=pretty)
        return
    if session.options.format != "json":
        session.emit(Dish("table", table), pretty=pretty)
    kinds = ", ".join(sorted({f[3] for f in failing}))
    raise UniChefError(
        "E_SCAN_FINDINGS",
        f"{len(failing)} finding(s) of a --fail-on kind ({kinds}).",
        detail={"findings": table_json(table)},
    )


def _configure_scan(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument("paths", nargs="+", metavar="PATH", help="Files or directories; - = stdin.")
    parser.add_argument(
        "--fail-on",
        type=parse_kinds,
        default=frozenset(),
        metavar="KINDS",
        help=f"Exit 6 if any finding is one of these comma-separated kinds: {', '.join(KINDS)}.",
    )
    parser.add_argument(
        "--include", action="append", default=[], metavar="GLOB", help="Only matching files."
    )
    parser.add_argument(
        "--exclude", action="append", default=[], metavar="GLOB", help="Skip matching files."
    )


COMMANDS = (
    Command(
        "scan",
        "Security",
        "Find bidi, invisible, confusable and mixed-script characters in files.",
        "PATH... [--fail-on KINDS] [--include GLOB] [--exclude GLOB]",
        _configure_scan,
        run_scan,
        examples=(
            "unichef scan --fail-on bidi,invisible src/",
            "unichef scan . --include '*.py' --format json",
        ),
    ),
)
