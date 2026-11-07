# SPDX-License-Identifier: GPL-3.0-or-later
"""Per-invocation state: streams, global options, input, output and diagnostics (PRD §5.3)."""

import base64
import binascii
import contextlib
import io
import os
import re
import sys
import tempfile
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO, Literal

from rich.console import Console, RenderableType
from rich.table import Table as RichTable
from rich.text import Text

from unichef.cli.envelope import dumps, envelope
from unichef.cli.palette import ThemeName, theme
from unichef.core.dish import Dish, Table, coerce, json_dumps, table_to_tsv
from unichef.core.errors import RunWarning, UniChefError, WarningCode, quote_input
from unichef.core.registry import CancelToken, Limits, OpContext, Rng
from unichef.unicode import utf8

type OutputFormat = Literal["table", "json", "raw"]
type ColorMode = Literal["auto", "always", "never"]
type InputEncoding = Literal["bytes", "utf-8", "hex", "base64"]

FORMATS: tuple[OutputFormat, ...] = ("table", "json", "raw")
COLOR_MODES: tuple[ColorMode, ...] = ("auto", "always", "never")
INPUT_ENCODINGS: tuple[InputEncoding, ...] = ("bytes", "utf-8", "hex", "base64")
DEFAULT_WIDTH = 100
MS = 1000

_SIZE = re.compile(r"([0-9]+)([KMGT]?)(i?B)?", re.IGNORECASE)
_UNITS = {"": 1, "K": 1 << 10, "M": 1 << 20, "G": 1 << 30, "T": 1 << 40}


def parse_size(text: str) -> int:
    """``64M``, ``1G``, ``512KiB`` or a byte count. Units are binary."""
    found = _SIZE.fullmatch(text.strip())
    if found is None or int(found[1]) == 0:
        raise UniChefError("E_USAGE", f"Invalid size {quote_input(text)}; use e.g. 64M or 1G.")
    return int(found[1]) * _UNITS[found[2].upper()]


@dataclass(slots=True)
class Streams:
    """The process streams, injectable for tests. All three are binary."""

    stdin: BinaryIO
    stdout: BinaryIO
    stderr: BinaryIO
    environ: Mapping[str, str] = field(default_factory=dict)
    stdin_tty: bool = False
    stdout_tty: bool = False
    stderr_tty: bool = False

    @classmethod
    def system(cls) -> "Streams":  # pragma: no cover - exercised by the subprocess tests
        if sys.platform == "win32":
            import msvcrt  # noqa: PLC0415 - Windows only

            for stream in (sys.stdin, sys.stdout):
                with contextlib.suppress(OSError, ValueError, AttributeError):
                    msvcrt.setmode(stream.fileno(), os.O_BINARY)
        return cls(
            stdin=sys.stdin.buffer,
            stdout=sys.stdout.buffer,
            stderr=sys.stderr.buffer,
            environ=os.environ,
            stdin_tty=sys.stdin.isatty(),
            stdout_tty=sys.stdout.isatty(),
            stderr_tty=sys.stderr.isatty(),
        )


def _enable_ansi() -> None:  # pragma: no cover - Windows consoles only
    """Turn on VT processing so ANSI colours render in older Windows consoles."""
    # A positive platform check, not an early return: mypy skips the block on other
    # platforms instead of flagging the code after the return as unreachable.
    if sys.platform == "win32":
        import ctypes  # noqa: PLC0415

        kernel32 = ctypes.windll.kernel32
        for handle_id in (-11, -12):  # STD_OUTPUT_HANDLE, STD_ERROR_HANDLE
            handle = kernel32.GetStdHandle(handle_id)
            mode = ctypes.c_uint32()
            if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
                kernel32.SetConsoleMode(handle, mode.value | 0x0004)


@dataclass(slots=True)
class Options:
    """Resolved global options."""

    format: OutputFormat = "raw"
    color: ColorMode = "auto"
    theme: ThemeName = "dark"
    input: str | None = None
    output: str | None = None
    input_encoding: InputEncoding = "bytes"
    max_input_size: int = Limits().max_input_size
    regex_timeout: int = Limits().regex_timeout_ms
    quiet: bool = False
    verbose: bool = False
    newline: bool = False


class Session:
    """One CLI invocation: the resolved options plus the streams they act on."""

    def __init__(self, streams: Streams, options: Options, command: str) -> None:
        self.streams = streams
        self.options = options
        self.command = command
        self.cancel = CancelToken()
        self.warnings: list[RunWarning] = []
        self.started = time.monotonic()
        self.limits = Limits(
            max_input_size=options.max_input_size, regex_timeout_ms=options.regex_timeout
        )
        to_terminal = options.output in {None, "-"} and streams.stdout_tty
        self.color_out = self._color(to_terminal)
        self.color_err = self._color(streams.stderr_tty)
        self.width = self._width(to_terminal)
        if self.color_out or self.color_err:
            _enable_ansi()

    # -- presentation ----------------------------------------------------------

    def _color(self, terminal: bool) -> bool:
        env = self.streams.environ
        if "NO_COLOR" in env:
            return False
        if env.get("FORCE_COLOR"):
            return True
        if self.options.color != "auto":
            return self.options.color == "always"
        return terminal

    def _width(self, terminal: bool) -> int:
        columns = self.streams.environ.get("COLUMNS", "")
        if columns.isdigit() and int(columns) > 0:
            return int(columns)
        if terminal:
            with contextlib.suppress(OSError, ValueError, io.UnsupportedOperation):
                return os.get_terminal_size(self.streams.stdout.fileno()).columns
        return DEFAULT_WIDTH

    def render(self, *items: RenderableType, color: bool | None = None) -> str:
        """Render Rich objects to text, with ANSI colour codes when ``color`` is set."""
        use_color = self.color_out if color is None else color
        console = Console(
            file=io.StringIO(),
            width=self.width,
            theme=theme(self.options.theme),
            force_terminal=use_color,
            color_system="truecolor" if use_color else None,
            no_color=not use_color,
            legacy_windows=False,
            emoji=False,
            highlight=False,
            soft_wrap=False,
        )
        for item in items:
            console.print(item, soft_wrap=isinstance(item, Text))
        out = console.file
        assert isinstance(out, io.StringIO)
        return out.getvalue()

    # -- diagnostics -------------------------------------------------------------

    def stderr(self, *items: RenderableType) -> None:
        self.streams.stderr.write(self.render(*items, color=self.color_err).encode("utf-8"))
        self.streams.stderr.flush()

    def notice(self, message: str, style: str = "muted") -> None:
        """An informational line on stderr, hidden by ``--quiet``."""
        if not self.options.quiet:
            self.stderr(Text(message, style=style))

    def report_warnings(self, warnings: Sequence[RunWarning]) -> None:
        if self.options.quiet or self.options.format == "json":
            return
        for warning in warnings:
            line = Text()
            line.append(f"warning[{warning.code}]", style="warn")
            line.append(f": {warning.message}")
            if warning.path:
                line.append(f" (at {'/'.join(str(p) for p in warning.path)})", style="muted")
            self.stderr(line)

    def collect_warning(self, code: WarningCode, message: str) -> None:
        """A ``WarnFn`` for work done outside a bake, such as reading a recipe."""
        self.warnings.append(RunWarning(code, message))

    def drain_warnings(self) -> list[RunWarning]:
        out, self.warnings = self.warnings, []
        return out

    def cancel_check(self) -> None:
        if self.cancel.cancelled:
            raise UniChefError("E_CANCELLED", "Cancelled.")

    def elapsed_ms(self) -> int:
        return round((time.monotonic() - self.started) * MS)

    # -- input -----------------------------------------------------------------------

    def context(self, seed: str | None = None) -> OpContext:
        return OpContext(limits=self.limits, cancel_token=self.cancel, rng=Rng(seed))

    def _read_stream(self, stream: BinaryIO, what: str) -> bytes:
        limit = self.limits.max_input_size
        try:
            data = stream.read(limit + 1)
        except OSError as exc:
            raise UniChefError("E_INPUT_IO", f"Cannot read {what} ({exc.strerror}).") from exc
        if len(data) > limit:
            raise UniChefError("E_LIMIT", f"The input is larger than {limit} bytes.")
        return data

    def read_bytes(self, source: str) -> bytes:
        """Read ``source`` (a path, or ``-`` for stdin) as bytes, honouring the size limit."""
        if source == "-":
            return self._read_stream(self.streams.stdin, "standard input")
        try:
            with Path(source).open("rb") as handle:
                return self._read_stream(handle, quote_input(source))
        except OSError as exc:
            reason = exc.strerror or type(exc).__name__
            raise UniChefError(
                "E_INPUT_IO", f"Cannot read {quote_input(source)} ({reason})."
            ) from exc

    def read_input(self, text: str | None = None) -> Dish:
        """The first dish: ``-i`` wins, then positional ``text``, then piped stdin."""
        if self.options.input is not None:
            data: bytes | str = self.read_bytes(self.options.input)
        elif text is not None:
            data = text
        elif not self.streams.stdin_tty:
            data = self.read_bytes("-")
        else:
            raise UniChefError("E_USAGE", "No input: pass TEXT, use -i FILE, or pipe data in.")
        return self._interpret(data)

    def _interpret(self, data: bytes | str) -> Dish:
        encoding = self.options.input_encoding
        if encoding == "utf-8":
            return Dish("string", data if isinstance(data, str) else utf8.decode(data))
        raw = utf8.encode(data) if isinstance(data, str) else data
        if encoding == "bytes":
            return Dish("bytes", raw)
        compact = b"".join(raw.split())
        try:
            if encoding == "hex":
                return Dish("bytes", bytes.fromhex(compact.decode("ascii")))
            return Dish("bytes", base64.b64decode(compact, validate=True))
        except (ValueError, binascii.Error) as exc:
            raise UniChefError("E_DECODE", f"The input is not valid {encoding}.") from exc

    # -- output ----------------------------------------------------------------------

    def write(self, data: bytes) -> None:
        """Write the result to ``-o`` (atomically) or stdout."""
        target = self.options.output
        if target in {None, "-"}:
            self.streams.stdout.write(data)
            self.streams.stdout.flush()
            return
        assert target is not None
        path = Path(target)
        try:
            fd, temp = tempfile.mkstemp(dir=path.parent or Path(), prefix=f".{path.name}.")
            try:
                with os.fdopen(fd, "wb") as handle:
                    handle.write(data)
                Path(temp).replace(path)
            except BaseException:
                Path(temp).unlink(missing_ok=True)
                raise
        except OSError as exc:
            reason = exc.strerror or type(exc).__name__
            raise UniChefError(
                "E_INPUT_IO", f"Cannot write {quote_input(target)} ({reason})."
            ) from exc

    def raw_bytes(self, dish: Dish) -> bytes:
        """The dish verbatim: bytes as they are, everything else as UTF-8 text."""
        value = dish.value
        if isinstance(value, bytes):
            data = value
        elif isinstance(value, Table):
            data = utf8.encode(table_to_tsv(value))
        elif dish.type == "json":
            data = utf8.encode(json_dumps(value))  # type: ignore[arg-type]
        else:
            data = utf8.encode(str(coerce(dish, "string").value))
        if self.options.newline and not data.endswith(b"\n"):
            data += b"\n"
        return data

    def emit(
        self,
        dish: Dish,
        warnings: Sequence[RunWarning] = (),
        *,
        pretty: RenderableType | None = None,
    ) -> None:
        """Write a successful result in the selected format.

        ``pretty`` overrides the default table-format rendering of ``dish``."""
        fmt = self.options.format
        if fmt == "json":
            doc = envelope(
                self.command, result=dish, warnings=warnings, timing_ms=self.elapsed_ms()
            )
            self.write(dumps(doc))
        elif fmt == "raw":
            self.write(self.raw_bytes(dish))
        else:
            self.write(self.render(pretty if pretty is not None else pretty_dish(dish)).encode())
        self.report_warnings(warnings)

    def emit_error(self, exc: UniChefError, warnings: Sequence[RunWarning] = ()) -> int:
        """Report a failure (envelope on stdout for JSON, else stderr) and return the exit code."""
        if self.options.format == "json":
            doc = envelope(
                self.command,
                result=None,
                warnings=warnings,
                error=exc,
                timing_ms=self.elapsed_ms(),
            )
            try:
                self.write(dumps(doc))
            except UniChefError:
                self.streams.stdout.write(dumps(doc))
        else:
            self.report_warnings(warnings)
            self.stderr(error_text(exc))
        return exc.exit_code


def error_text(exc: UniChefError) -> Text:
    line = Text()
    line.append(f"error[{exc.code}]", style="error")
    line.append(f": {exc.message}")
    if exc.path:
        line.append(f" (at step {'/'.join(str(p) for p in exc.path)})", style="muted")
    return line


def rich_table(table: Table, *, title: str | None = None) -> RichTable:
    """A Rich table for a table dish; ``cp`` columns use the code-point style."""
    out = RichTable(title=title, header_style="brand.accent", title_style="brand.primary")
    for column in table.columns:
        out.add_column(column, style="cp" if column == "cp" else None, overflow="fold")
    for row in table.rows:
        out.add_row(*(Text("" if cell is None else _cell(cell)) for cell in row))
    return out


def _cell(cell: object) -> str:
    if isinstance(cell, bool):
        return "true" if cell else "false"
    return str(cell)


def pretty_dish(dish: Dish) -> RenderableType:
    """The default table-format rendering of a dish."""
    value = dish.value
    if isinstance(value, Table):
        return rich_table(value)
    if isinstance(value, bytes):
        try:
            text = value.decode("utf-8")
        except UnicodeDecodeError:
            return Text(value.hex(" "), style="muted")
        return Text(text)
    if dish.type == "json":
        return Text(json_dumps(value))  # type: ignore[arg-type]
    return Text(str(coerce(dish, "string").value))
