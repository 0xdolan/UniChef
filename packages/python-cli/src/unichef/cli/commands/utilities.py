# SPDX-License-Identifier: GPL-3.0-or-later
"""Utility commands: ucd, completion and version."""

import argparse
import platform

from rich.text import Text

from unichef.cli.about import semver, version_line
from unichef.cli.parser import Command, SubFactory, UniChefParser
from unichef.cli.session import Session
from unichef.core.dish import Dish, JsonValue, Table

SHELLS = ("bash", "zsh", "fish", "powershell")


def run_version(session: Session, _ns: argparse.Namespace) -> None:
    from unichef.unicode.version import UCD_VERSION  # noqa: PLC0415

    value: dict[str, JsonValue] = {
        "unichef": semver(),
        "ucd": UCD_VERSION,
        "python": platform.python_version(),
    }
    if session.options.format == "json":
        session.emit(Dish("json", value))
    else:
        session.emit(Dish("string", version_line()), pretty=Text(version_line()))


def run_ucd_info(session: Session, _ns: argparse.Namespace) -> None:
    from unichef.unicode import data, props  # noqa: PLC0415

    core = data.load("core")
    unassigned = sum(end - start + 1 for start, end in props.table("gc").ranges_where({"Cn"}))
    rows = (
        ("unicode", data.UCD_VERSION),
        ("code points", data.MAX_CODE_POINT + 1),
        ("assigned", data.MAX_CODE_POINT + 1 - unassigned),
        ("blocks", len(core["blocks"])),
        ("scripts", len(set(core["aliases"]["values"]["sc"].values()))),
        ("properties", len(core["aliases"]["prop"])),
        ("source", "https://www.unicode.org/Public/" + data.UCD_VERSION + "/ucd/"),
    )
    session.emit(Dish("table", Table(("field", "value"), rows)))


def configure_ucd(parser: UniChefParser, factory: SubFactory) -> None:
    adder = factory.subparsers(parser, "ucd_command", "ACTION")
    adder.add(
        "info",
        "Show the bundled Unicode Character Database version and counts.",
        run=run_ucd_info,
        examples=("unichef ucd info",),
    )


def run_completion(session: Session, ns: argparse.Namespace) -> None:
    from unichef.cli.completion import script  # noqa: PLC0415

    session.emit(Dish("string", script(ns.shell)), pretty=Text(script(ns.shell)))


def _configure_completion(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument("shell", choices=SHELLS, metavar="SHELL", help=" | ".join(SHELLS))


def _configure_version(_parser: UniChefParser, _factory: SubFactory) -> None:
    pass


COMMANDS = (
    Command(
        "ucd",
        "Utilities",
        "Unicode Character Database information.",
        "info",
        configure_ucd,
        examples=("unichef ucd info",),
    ),
    Command(
        "completion",
        "Utilities",
        "Print a shell completion script.",
        "bash|zsh|fish|powershell",
        _configure_completion,
        run_completion,
        examples=(
            "unichef completion bash > /etc/bash_completion.d/unichef",
            "unichef completion powershell | Out-String | Invoke-Expression",
        ),
    ),
    Command(
        "version",
        "Utilities",
        "Show the UniChef, UCD and Python versions.",
        "",
        _configure_version,
        run_version,
        examples=("unichef version", "unichef version --format json"),
    ),
)
