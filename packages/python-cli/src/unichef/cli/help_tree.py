# SPDX-License-Identifier: GPL-3.0-or-later
"""Help output (PRD §5.4): a command tree for ``unichef --help`` and a usage panel, options
table and examples for ``unichef <command> --help``. Without colour the same content is
plain ASCII text."""

import argparse
from collections.abc import Sequence

from rich.console import Group, RenderableType
from rich.padding import Padding
from rich.panel import Panel
from rich.syntax import Syntax
from rich.table import Table
from rich.text import Text
from rich.tree import Tree

from unichef.cli.about import semver
from unichef.cli.parser import GROUPS, TAGLINE, Command, UniChefParser

GLOBAL_DESTS = frozenset({
    "format", "color", "theme", "input", "output", "input_encoding", "max_input_size",
    "regex_timeout", "newline", "quiet", "verbose",
})  # fmt: skip


class RichHelpFormatter(argparse.HelpFormatter):
    """argparse's formatter, used for usage lines and option spellings. Layout and colour
    are done by :func:`render_help` with Rich."""

    def __init__(self, prog: str) -> None:
        super().__init__(prog, max_help_position=32, width=100)

    def invocation(self, action: argparse.Action) -> str:
        """``-i, --input FILE``."""
        return self._format_action_invocation(action)

    def usage(self, parser: argparse.ArgumentParser, actions: Sequence[argparse.Action]) -> str:
        line = self._format_usage(None, list(actions), [], "").strip()
        return f"{line} [OPTIONS]" if parser.prog != "unichef" else line


def _local_actions(parser: argparse.ArgumentParser) -> list[argparse.Action]:
    return [
        a
        for a in parser._actions
        if a.dest not in GLOBAL_DESTS and a.option_strings != ["-h", "--help"]
    ]


def _global_actions(parser: argparse.ArgumentParser) -> list[argparse.Action]:
    return [a for a in parser._actions if a.dest in GLOBAL_DESTS]


def _default(action: argparse.Action) -> str:
    default = action.default
    if isinstance(action, argparse._SubParsersAction) or default is None or default is False:
        return ""
    if isinstance(default, list | tuple | set | frozenset):
        return ", ".join(sorted(str(v) for v in default))
    return "" if default == argparse.SUPPRESS else str(default)


def _rows(parser: UniChefParser, actions: Sequence[argparse.Action]) -> list[tuple[str, str, str]]:
    formatter = RichHelpFormatter(parser.prog)
    rows: list[tuple[str, str, str]] = []
    for action in actions:
        if isinstance(action, argparse._SubParsersAction):
            rows += [(c.dest, c.help or "", "") for c in action._choices_actions]
            continue
        rows.append((formatter.invocation(action), action.help or "", _default(action)))
    return rows


# -- root help ---------------------------------------------------------------------


def _by_group(commands: Sequence["Command"]) -> list[tuple[str, list["Command"]]]:
    return [(g, [c for c in commands if c.group == g]) for g in GROUPS]


def _root_plain(parser: UniChefParser, commands: Sequence["Command"]) -> str:
    lines = [f"unichef {semver()}", TAGLINE, ""]
    groups = _by_group(commands)
    for gi, (group, members) in enumerate(groups):
        last_group = gi == len(groups) - 1
        lines.append(f"{'`-- ' if last_group else '|-- '}{group}")
        stem = "    " if last_group else "|   "
        width = max(len(c.name) for c in members)
        for ci, command in enumerate(members):
            branch = "`-- " if ci == len(members) - 1 else "|-- "
            lines.append(
                f"{stem}{branch}{command.name.ljust(width)} - {command.summary}"
                f"  ({command.signature})"
            )
    lines += ["", "Global options:"]
    rows = _rows(parser, _global_actions(parser))
    lines += _plain_rows(rows)
    lines += ["", "Run 'unichef COMMAND --help' for a command's options and examples."]
    return "\n".join(lines) + "\n"


def _root_rich(parser: UniChefParser, commands: Sequence["Command"]) -> RenderableType:
    tree = Tree(Text.assemble(("unichef ", "brand.primary"), (semver(), "brand.primary")))
    for group, members in _by_group(commands):
        branch = tree.add(Text(group, style="brand.accent"))
        for command in members:
            branch.add(
                Text.assemble(
                    (command.name, "bold"),
                    " — ",
                    command.summary,
                    "  ",
                    (command.signature, "muted"),
                )
            )
    table = _options_table(_rows(parser, _global_actions(parser)))
    footer = Text.assemble(
        ("Run ", "muted"), ("unichef COMMAND --help", "cp"), (" for options and examples.", "muted")
    )
    return Group(
        Text(TAGLINE, style="muted"),
        tree,
        Text("Global options", style="brand.accent"),
        table,
        footer,
    )


# -- command help ------------------------------------------------------------------


def _plain_rows(rows: Sequence[tuple[str, str, str]]) -> list[str]:
    if not rows:
        return []
    width = min(32, max(len(flag) for flag, _, _ in rows))
    out = []
    for flag, text, default in rows:
        suffix = f" (default: {default})" if default else ""
        lead = f"  {flag.ljust(width)}  "
        if len(flag) > width:
            out.append(f"  {flag}")
            lead = " " * (width + 4)
        out.append(f"{lead}{text}{suffix}")
    return out


def _options_table(rows: Sequence[tuple[str, str, str]]) -> Table:
    table = Table(show_header=False, box=None, padding=(0, 2, 0, 2))
    table.add_column("flag", style="cp", no_wrap=True)
    table.add_column("description")
    for flag, text, default in rows:
        line = Text(text)
        if default:
            line.append(f" (default: {default})", style="muted")
        table.add_row(flag, line)
    return table


def _command_plain(parser: UniChefParser) -> str:
    formatter = RichHelpFormatter(parser.prog)
    local = _local_actions(parser)
    lines = [f"Usage: {formatter.usage(parser, local)}", ""]
    if parser.description:
        lines += [parser.description, ""]
    rows = _rows(parser, local)
    if rows:
        lines += ["Options:", *_plain_rows(rows), ""]
    if parser.examples:
        lines += ["Examples:", *(f"  $ {e}" for e in parser.examples), ""]
    lines.append("Global options: run 'unichef --help'.")
    return "\n".join(lines) + "\n"


def _command_rich(parser: UniChefParser) -> RenderableType:
    formatter = RichHelpFormatter(parser.prog)
    local = _local_actions(parser)
    parts: list[RenderableType] = [
        Panel(
            Text(formatter.usage(parser, local)),
            title=Text("Usage", style="brand.primary"),
            title_align="left",
            border_style="muted",
        )
    ]
    if parser.description:
        parts.append(Padding(Text(parser.description), (0, 1)))
    rows = _rows(parser, local)
    if rows:
        parts += [Text("Options", style="brand.accent"), _options_table(rows)]
    if parser.examples:
        parts.append(Text("Examples", style="brand.accent"))
        parts += [
            Padding(Syntax(f"$ {e}", "bash", theme="ansi_dark", background_color="default"), (0, 2))
            for e in parser.examples
        ]
    parts.append(Text("Global options: run unichef --help.", style="muted"))
    return Group(*parts)


def render_help(
    parser: UniChefParser, commands: Sequence["Command"], *, color: bool
) -> RenderableType | str:
    """Rich renderables when colour is on, else plain ASCII text."""
    is_root = parser.prog == "unichef"
    if color:
        return _root_rich(parser, commands) if is_root else _command_rich(parser)
    return _root_plain(parser, commands) if is_root else _command_plain(parser)


__all__ = ["Command", "RichHelpFormatter", "render_help"]
