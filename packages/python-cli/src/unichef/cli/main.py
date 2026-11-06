# SPDX-License-Identifier: GPL-3.0-or-later
"""The CLI entry point: parse, run one command, map errors to exit codes (PRD §3.7, §5)."""

import argparse
import os
import signal
import sys
from collections.abc import Sequence
from typing import Any, cast

from unichef.cli.palette import THEMES, ThemeName
from unichef.cli.parser import Command, HelpRequested, RunFn, UniChefParser, build_parser
from unichef.cli.session import (
    COLOR_MODES,
    FORMATS,
    ColorMode,
    Options,
    OutputFormat,
    Session,
    Streams,
)
from unichef.core.errors import UniChefError

_GLOBAL_VALUE_FLAGS = {"--format": "format", "--color": "color", "--theme": "theme"}
_SUBCOMMAND_DESTS = ("recipe_command", "block_command", "script_command", "ucd_command")


def prescan(argv: Sequence[str]) -> dict[str, str]:
    """``--format``/``--color``/``--theme`` values, read before parsing so that usage errors
    and help can honour them."""
    found: dict[str, str] = {}
    for i, token in enumerate(argv):
        flag, sep, value = token.partition("=")
        if flag in _GLOBAL_VALUE_FLAGS:
            if not sep:
                if i + 1 >= len(argv):
                    continue
                value = argv[i + 1]
            found[_GLOBAL_VALUE_FLAGS[flag]] = value
    return found


def resolve_options(values: dict[str, Any], streams: Streams) -> Options:
    """Fill unset global options with their defaults (PRD §5.3)."""
    defaults = Options()
    output = values.get("output")
    to_terminal = streams.stdout_tty and output in {None, "-"}
    fmt = values.get("format") or ("table" if to_terminal else "raw")
    color = values.get("color", "auto")
    theme = values.get("theme", "dark")
    return Options(
        format=cast(OutputFormat, fmt if fmt in FORMATS else "raw"),
        color=cast(ColorMode, color if color in COLOR_MODES else "auto"),
        theme=cast(ThemeName, theme if theme in THEMES else "dark"),
        input=values.get("input"),
        output=output,
        input_encoding=values.get("input_encoding", defaults.input_encoding),
        max_input_size=values.get("max_input_size", defaults.max_input_size),
        regex_timeout=values.get("regex_timeout", defaults.regex_timeout),
        quiet=bool(values.get("quiet", False)),
        verbose=bool(values.get("verbose", False)),
        newline=bool(values.get("newline", False)),
    )  # fmt: skip


def command_name(ns: argparse.Namespace) -> str:
    parts = [getattr(ns, "command", None) or "unichef"]
    parts += [getattr(ns, dest) for dest in _SUBCOMMAND_DESTS if getattr(ns, dest, None)]
    return " ".join(parts)


def _guess_command(argv: Sequence[str], commands: Sequence[Command]) -> str:
    names = {c.name for c in commands}
    return next((t for t in argv if t in names), "unichef")


def _install_sigint(session: Session) -> None:  # pragma: no cover - needs a real signal
    presses = 0

    def handler(_signum: int, _frame: object) -> None:
        nonlocal presses
        presses += 1
        if presses > 1:
            os._exit(130)
        session.cancel.cancel()

    signal.signal(signal.SIGINT, handler)


def _silence_stdout(streams: Streams) -> None:
    """After EPIPE, point stdout at the null device so the interpreter's final flush is quiet."""
    try:
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, streams.stdout.fileno())
    except (OSError, ValueError, AttributeError):
        pass


def _help(streams: Streams, values: dict[str, Any], parser: UniChefParser,
          commands: Sequence[Command]) -> int:  # fmt: skip
    from unichef.cli.help_tree import render_help  # noqa: PLC0415

    session = Session(streams, resolve_options(values, streams), "help")
    rendered = render_help(parser, commands, color=session.color_out)
    text = rendered if isinstance(rendered, str) else session.render(rendered)
    streams.stdout.write(text.encode("utf-8"))
    streams.stdout.flush()
    return 0


def run(argv: Sequence[str] | None = None, streams: Streams | None = None) -> int:  # noqa: PLR0911
    """Run one CLI invocation and return its exit code."""
    system = streams is None
    io = Streams.system() if streams is None else streams
    args = list(sys.argv[1:] if argv is None else argv)
    root, commands = build_parser()
    early: dict[str, Any] = prescan(args)
    try:
        try:
            ns = root.parse_args(args)
        except HelpRequested as wanted:
            return _help(io, early, wanted.parser, commands)
        except UniChefError as exc:
            session = Session(io, resolve_options(early, io), _guess_command(args, commands))
            return session.emit_error(exc)
        values = vars(ns)
        if values.get("version") and not values.get("command"):
            values["command"] = "version"
            from unichef.cli.commands.utilities import run_version  # noqa: PLC0415

            values["_run"] = run_version
        handler = cast(RunFn | None, values.get("_run"))
        if handler is None:
            return _help(io, values, root, commands)
        session = Session(io, resolve_options(values, io), command_name(ns))
        if system:  # pragma: no cover - the subprocess tests cover this path
            _install_sigint(session)
        try:
            return handler(session, ns) or 0
        except UniChefError as exc:
            return session.emit_error(exc, session.drain_warnings())
        except KeyboardInterrupt:  # pragma: no cover - SIGINT is handled by _install_sigint
            return session.emit_error(UniChefError("E_CANCELLED", "Cancelled."))
        except (RecursionError, MemoryError) as exc:
            return session.emit_error(
                UniChefError("E_LIMIT", f"Out of resources ({type(exc).__name__}).")
            )
        except BrokenPipeError:
            raise
        except Exception as exc:
            return session.emit_error(
                UniChefError("E_INTERNAL", f"Internal error: {type(exc).__name__}: {exc}")
            )
    except BrokenPipeError:
        _silence_stdout(io)
        return 0


def main() -> int:  # pragma: no cover - the console-script wrapper
    return run()


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
