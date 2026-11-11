# SPDX-License-Identifier: GPL-3.0-or-later
"""``python -m unichef.cli.manpage`` prints unichef(1) in roff, built from the argparse tree
so the man page never drifts from ``--help`` (PRD §5.7)."""

import argparse
import os
import sys
from datetime import UTC, datetime

from unichef import __version__
from unichef.cli.parser import build_parser

EXIT_STATUS = (
    ("0", "Success."),
    ("1", "Invalid input, argument, decoding, crypto or limit error."),
    ("2", "Usage error."),
    ("3", "Input or output file error."),
    ("4", "Invalid recipe or unknown operation."),
    ("5", "Regular expression timed out."),
    ("6", "unichef scan found issues at or above --fail-on."),
    ("70", "Internal error."),
    ("130", "Cancelled (Ctrl+C)."),
)


def _esc(text: str) -> str:
    text = text.replace("\\", "\\e").replace("-", "\\-")
    return "\n".join("\\&" + line if line.startswith((".", "'")) else line
                     for line in text.splitlines())  # fmt: skip


def _options(parser: argparse.ArgumentParser, skip: set[str]) -> list[str]:
    lines: list[str] = []
    for action in parser._actions:  # argparse has no public accessor
        if not action.option_strings or action.help == argparse.SUPPRESS:
            continue
        if action.dest in skip:
            continue
        flags = ", ".join(f"\\fB{_esc(f)}\\fR" for f in action.option_strings)
        if action.nargs != 0:
            meta = action.metavar or (
                "{" + ",".join(map(str, action.choices)) + "}" if action.choices else action.dest
            )
            flags += f" \\fI{_esc(str(meta).upper() if not action.choices else str(meta))}\\fR"
        lines += [".TP", flags, _esc(action.help or "")]
    return lines


def _positionals(parser: argparse.ArgumentParser) -> list[str]:
    lines: list[str] = []
    for action in parser._actions:
        if action.option_strings or isinstance(action, argparse._SubParsersAction):
            continue
        lines += [".TP", f"\\fI{_esc(str(action.metavar or action.dest))}\\fR",
                  _esc(action.help or "")]  # fmt: skip
    return lines


def _subparsers(parser: argparse.ArgumentParser) -> dict[str, argparse.ArgumentParser]:
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            return dict(action.choices)
    return {}


def page_date() -> str:
    """``SOURCE_DATE_EPOCH`` as a date, for reproducible builds (REL-010); else today."""
    epoch = os.environ.get("SOURCE_DATE_EPOCH", "")
    when = datetime.fromtimestamp(int(epoch), UTC) if epoch.isdigit() else datetime.now(UTC)
    return when.strftime("%Y-%m-%d")


def render(date: str | None = None) -> str:
    root, commands = build_parser()
    today = date or page_date()
    globals_ = {a.dest for a in root._actions if a.option_strings}
    subs = _subparsers(root)
    out = [
        f'.TH UNICHEF 1 "{today}" "unichef {__version__}" "User Commands"',
        ".SH NAME",
        "unichef \\- Unicode-aware data transformation and inspection",
        ".SH SYNOPSIS",
        "\\fBunichef\\fR [\\fIGLOBAL OPTIONS\\fR] \\fICOMMAND\\fR [\\fIARGS\\fR]",
        ".SH DESCRIPTION",
        "unichef runs encoding, hashing, crypto and text operations alone or as recipes, and "
        "inspects Unicode characters, blocks and scripts. Output is a table on a terminal, "
        "raw data in a pipe, or a JSON envelope with \\fB\\-\\-format json\\fR.",
        ".SH GLOBAL OPTIONS",
        *_options(root, set()),
        ".SH COMMANDS",
    ]
    for command in commands:
        parser = subs[command.name]
        out += [f".SS {_esc(command.signature)}", _esc(command.summary)]
        if command.description:
            out += [".PP", _esc(command.description)]
        out += _positionals(parser) + _options(parser, globals_)
        for name, child in _subparsers(parser).items():
            out += [".TP", f"\\fB{_esc(command.name)} {_esc(name)}\\fR",
                    _esc(child.description or "")]  # fmt: skip
            out += _positionals(child) + _options(child, globals_)
        if command.examples:
            out += [".PP", "Examples:", ".RS", ".nf", *map(_esc, command.examples), ".fi", ".RE"]
    out += [".SH EXIT STATUS"]
    for code, meaning in EXIT_STATUS:
        out += [".TP", f"\\fB{code}\\fR", meaning]
    out += [
        ".SH ENVIRONMENT",
        ".TP", "\\fBNO_COLOR\\fR", "Disable colour.",
        ".TP", "\\fBFORCE_COLOR\\fR", "Force colour even when not writing to a terminal.",
        ".TP", "\\fBCOLUMNS\\fR", "Table width.",
        ".SH SEE ALSO",
        "https://github.com/0xdolan/unichef",
    ]  # fmt: skip
    return "\n".join(out) + "\n"


def main() -> int:  # pragma: no cover - thin wrapper
    sys.stdout.write(render())
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
