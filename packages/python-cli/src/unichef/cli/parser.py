# SPDX-License-Identifier: GPL-3.0-or-later
"""The argparse command tree (PRD §5.3). Global options are accepted before or after the
subcommand: every parser gets them through ``parents=`` with suppressed defaults."""

import argparse
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, NoReturn

from unichef.core.errors import UniChefError

TAGLINE = "Cybersecurity and Unicode workbench: encode, decode, hash, encrypt and inspect data."

if TYPE_CHECKING:
    from unichef.cli.session import Session

type RunFn = Callable[["Session", argparse.Namespace], int | None]
type ConfigureFn = Callable[["UniChefParser", "SubFactory"], None]

GROUPS = ("Transform", "Characters", "Security", "Utilities")


@dataclass(slots=True, frozen=True)
class Command:
    """One top-level command: its help-tree entry and how to build and run it."""

    name: str
    group: str
    summary: str
    signature: str
    configure: ConfigureFn
    run: RunFn | None = None
    examples: tuple[str, ...] = ()
    description: str = ""


class HelpRequested(Exception):  # noqa: N818 - control flow, not an error
    """Raised instead of printing help, so the caller renders it to the right stream."""

    def __init__(self, parser: "UniChefParser") -> None:
        super().__init__(parser.prog)
        self.parser = parser


class _HelpAction(argparse.Action):
    def __init__(self, option_strings: Sequence[str], dest: str = argparse.SUPPRESS) -> None:
        super().__init__(
            option_strings, dest, nargs=0, default=argparse.SUPPRESS, help="Show help."
        )

    def __call__(
        self,
        parser: argparse.ArgumentParser,
        _namespace: argparse.Namespace,
        _values: object,
        _option_string: str | None = None,
    ) -> None:
        assert isinstance(parser, UniChefParser)
        raise HelpRequested(parser)


class UniChefParser(argparse.ArgumentParser):
    """Raises ``UniChefError('E_USAGE')`` instead of printing and exiting."""

    def __init__(
        self,
        *args: object,
        command: Command | None = None,
        examples: tuple[str, ...] = (),
        help_flag: bool = True,
        **kwargs: object,
    ) -> None:
        kwargs.setdefault("add_help", False)
        kwargs.setdefault("allow_abbrev", False)
        from unichef.cli.help_tree import RichHelpFormatter  # noqa: PLC0415 - avoid a cycle

        kwargs.setdefault("formatter_class", RichHelpFormatter)
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        self.command = command
        self.examples = examples
        if help_flag:
            self.add_argument("-h", "--help", action=_HelpAction)

    def error(self, message: str) -> NoReturn:
        raise UniChefError("E_USAGE", f"{self.prog}: {message}")

    def exit(self, status: int = 0, message: str | None = None) -> NoReturn:  # pragma: no cover
        raise UniChefError("E_USAGE", message or f"{self.prog} exited with status {status}.")


@dataclass(slots=True)
class SubFactory:
    """Creates subparsers that share the global options."""

    parents: list[UniChefParser]
    created: list[UniChefParser] = field(default_factory=list)

    def subparsers(self, parser: UniChefParser, dest: str, title: str) -> "Adder":
        action = parser.add_subparsers(dest=dest, metavar=title, parser_class=UniChefParser)
        action.required = True
        return Adder(self, action)


@dataclass(slots=True)
class Adder:
    factory: SubFactory
    action: "argparse._SubParsersAction[UniChefParser]"

    def add(
        self,
        name: str,
        summary: str,
        *,
        run: RunFn,
        examples: tuple[str, ...] = (),
        description: str = "",
    ) -> UniChefParser:
        sub = self.action.add_parser(
            name,
            help=summary,
            description=description or summary,
            parents=self.factory.parents,
            examples=examples,
        )
        sub.set_defaults(_run=run)
        self.factory.created.append(sub)
        return sub


def size_arg(text: str) -> int:
    from unichef.cli.session import parse_size  # noqa: PLC0415

    return parse_size(text)


def positive_int(text: str) -> int:
    if not text.isdigit() or int(text) <= 0:
        raise argparse.ArgumentTypeError(f"expected a positive integer, got {text[:32]!r}")
    return int(text)


def global_options() -> UniChefParser:
    """The options every command accepts (PRD §5.3)."""
    from unichef.cli.palette import THEMES  # noqa: PLC0415
    from unichef.cli.session import COLOR_MODES, FORMATS, INPUT_ENCODINGS  # noqa: PLC0415

    parent = UniChefParser(prog="unichef", argument_default=argparse.SUPPRESS, help_flag=False)
    add = parent.add_argument
    add("--format", choices=FORMATS, help="Output format. Default: table on a terminal, else raw.")
    add("--color", choices=COLOR_MODES, help="Colour output. Default: auto.")
    add("--theme", choices=THEMES, help="Colour theme. Default: dark.")
    add("-i", "--input", metavar="FILE", help="Read input from FILE, or - for stdin.")
    add("-o", "--output", metavar="FILE", help="Write the result to FILE (atomically).")
    add(
        "--input-encoding",
        choices=INPUT_ENCODINGS,
        help="How to interpret the input. Default: bytes.",
    )
    add(
        "--max-input-size",
        type=size_arg,
        metavar="SIZE",
        help="Largest accepted input, e.g. 64M or 1G. Default: 1G.",
    )
    add(
        "--regex-timeout",
        type=positive_int,
        metavar="MS",
        help="Regex time budget in milliseconds. Default: 2000.",
    )
    add("--newline", action="store_true", help="End raw output with a newline.")
    add("-q", "--quiet", action="store_true", help="Hide warnings and notices.")
    add("-v", "--verbose", action="store_true", help="Show step timings on stderr.")
    return parent


def build_parser() -> tuple[UniChefParser, list[Command]]:
    """The root parser and the command list it was built from."""
    from unichef.cli.commands import COMMANDS  # noqa: PLC0415

    parents: list[UniChefParser] = [global_options()]
    root = UniChefParser(
        prog="unichef",
        description=TAGLINE,
        parents=parents,
    )
    root.add_argument("--version", action="store_true", default=False, help="Show the version.")
    factory = SubFactory(parents)
    adder = factory.subparsers(root, "command", "COMMAND")
    adder.action.required = False
    for command in COMMANDS:
        sub = adder.action.add_parser(
            command.name,
            help=command.summary,
            description=command.description or command.summary,
            parents=parents,
            command=command,
            examples=command.examples,
        )
        if command.run is not None:
            sub.set_defaults(_run=command.run)
        command.configure(sub, factory)
    return root, list(COMMANDS)
