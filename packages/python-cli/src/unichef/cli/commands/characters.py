# SPDX-License-Identifier: GPL-3.0-or-later
"""Character commands: inspect, char, search, block and script."""

import argparse
import re
from collections.abc import Iterable, Sequence
from typing import cast

from rich.console import RenderableType
from rich.panel import Panel
from rich.table import Table as RichTable
from rich.text import Text

from unichef.cli.commands.transform import text_input
from unichef.cli.parser import Command, SubFactory, UniChefParser
from unichef.cli.session import Session, rich_table
from unichef.core.dish import Cell, Dish, Table
from unichef.core.errors import UniChefError, quote_input
from unichef.core.runner import run_operation

MAX_CODE_POINT = 0x10FFFF
GRID = 16
INSPECT_COLUMNS = ("index", "cp", "char", "name", "gc", "script", "block", "utf8", "flags")
LIST_COLUMNS = ("cp", "char", "name", "gc", "block", "script")
QUERY_SYNTAX = re.compile(r"[=<>~&|!()]")
_REGEX_SPECIAL = re.compile(r"[.^$*+?()\[\]{}|\\/]")
_CP = re.compile(r"(?:[Uu]\+|0[xX]|\\[uU])([0-9A-Fa-f]{1,6})")


def analyse(session: Session, text: str, granularity: str = "codepoint") -> Table:
    result = run_operation(
        "analyse-characters", {"granularity": granularity}, Dish("string", text),
        ctx=session.context(),
    )  # fmt: skip
    return cast(Table, result.dish.value)


def select(table: Table, columns: Sequence[str]) -> Table:
    index = [table.columns.index(c) for c in columns]
    return Table(tuple(columns), tuple(tuple(row[i] for i in index) for row in table.rows))


def styled_table(table: Table) -> RichTable:
    """Like ``rich_table``, but flags in the security style."""
    out = rich_table(table)
    if "flags" in table.columns:
        flags = out.columns[table.columns.index("flags")]
        flags.style = "flag.security"
    return out


def code_points_table(session: Session, cps: Iterable[int]) -> Table:
    return select(analyse(session, "".join(chr(cp) for cp in cps)), LIST_COLUMNS)


# -- inspect -------------------------------------------------------------------------------


def run_inspect(session: Session, ns: argparse.Namespace) -> None:
    table = analyse(session, text_input(session, ns.text), ns.granularity)
    pretty = styled_table(select(table, INSPECT_COLUMNS))
    session.emit(Dish("table", table), pretty=pretty)


# -- char --------------------------------------------------------------------------------


def parse_char(spec: str) -> int:
    """``é``, ``U+00E9``, ``0xE9``, ``\\u00E9``, ``233`` or a character name or alias."""
    from unichef.unicode import names  # noqa: PLC0415

    if len(spec) == 1:
        return ord(spec)
    found = _CP.fullmatch(spec.strip())
    if found is not None:
        cp = int(found[1], 16)
    elif spec.strip().isascii() and spec.strip().isdigit():
        cp = int(spec.strip())
    else:
        named = names.lookup(spec)
        if named is None:
            raise UniChefError("E_ARG_INVALID", f"No character is named {quote_input(spec)}.")
        return named
    if cp > MAX_CODE_POINT:
        raise UniChefError("E_ARG_INVALID", f"{quote_input(spec)} is beyond U+10FFFF.")
    return cp


def run_char(session: Session, ns: argparse.Namespace) -> None:
    from unichef.unicode import names  # noqa: PLC0415

    cp = parse_char(ns.char)
    row = analyse(session, chr(cp))
    values = dict(zip(row.columns, row.rows[0], strict=True))
    rows: list[tuple[Cell, Cell]] = [(k, v) for k, v in values.items() if k != "index"]
    rows += [(f"alias ({a.type})", a.alias) for a in names.aliases(cp)]
    table = Table(("property", "value"), tuple(rows))
    title = Text.assemble((str(values["cp"]), "cp"), " ", (str(values["name"]), "brand.primary"))
    grid = RichTable.grid(padding=(0, 2))
    grid.add_column(style="muted")
    grid.add_column()
    for key, value in rows[1:]:
        grid.add_row(str(key), Text(str(value), style="flag.security" if key == "flags" else ""))
    pretty = Panel(grid, title=title, title_align="left", border_style="muted")
    session.emit(Dish("table", table), pretty=pretty)


# -- search --------------------------------------------------------------------------------


def run_search(session: Session, ns: argparse.Namespace) -> None:
    from unichef.unicode.query import query  # noqa: PLC0415

    text: str = ns.query
    if not QUERY_SYNTAX.search(text):  # plain words: a case-insensitive name search
        text = "name~/" + _REGEX_SPECIAL.sub(r"\\\g<0>", text.strip()) + "/i"
    found = query(text, limit=ns.limit, timeout_ms=session.limits.regex_timeout_ms)
    table = code_points_table(session, found.code_points)
    if found.truncated:
        session.notice(f"Showing {len(found.code_points)} of {found.total} matches; use --limit.")
    pretty: RenderableType = rich_table(table)
    if not found.code_points:
        pretty = Text("No characters match.", style="muted")
    session.emit(Dish("table", table), pretty=pretty)


# -- block -----------------------------------------------------------------------------------


def _blocks() -> list[tuple[int, int, str]]:
    from unichef.unicode import data  # noqa: PLC0415

    return [(b["start"], b["end"], b["name"]) for b in data.load("core")["blocks"]]


def find_block(name: str) -> tuple[int, int, str]:
    from unichef.unicode.props import loose  # noqa: PLC0415

    key = loose(name)
    for block in _blocks():
        if loose(block[2]) == key:
            return block
    raise UniChefError("E_ARG_INVALID", f"Unknown block {quote_input(name)}; see block list.")


def run_block_list(session: Session, _ns: argparse.Namespace) -> None:
    rows = tuple((f"U+{s:04X}", f"U+{e:04X}", name) for s, e, name in _blocks())
    session.emit(Dish("table", Table(("start", "end", "name"), rows)))


def grid_table(session: Session, start: int, end: int) -> Table:
    analysed = analyse(session, "".join(chr(cp) for cp in range(start, end + 1)))
    chars = {row[1]: (row[2], row[4]) for row in analysed.rows}
    rows: list[tuple[Cell, ...]] = []
    for base in range(start - start % GRID, end + 1, GRID):
        cells: list[Cell] = []
        for cp in range(base, base + GRID):
            char, gc = chars.get(f"U+{cp:04X}", ("", "Cn"))
            cells.append("" if gc == "Cn" else char)
        rows.append((f"U+{base // GRID:03X}x", *cells))
    return Table(("row", *(f"{i:X}" for i in range(GRID))), tuple(rows))


def run_block_show(session: Session, ns: argparse.Namespace) -> None:
    start, end, name = find_block(ns.name)
    title = f"{name} (U+{start:04X}..U+{end:04X})"
    if ns.grid:
        table = grid_table(session, start, end)
    else:
        table = select(analyse(session, "".join(chr(cp) for cp in range(start, end + 1))),
                       ("cp", "char", "name", "gc", "script"))  # fmt: skip
    session.emit(Dish("table", table), pretty=rich_table(table, title=title))


def configure_block(parser: UniChefParser, factory: SubFactory) -> None:
    adder = factory.subparsers(parser, "block_command", "ACTION")
    adder.add("list", "List every Unicode block.", run=run_block_list,
              examples=("unichef block list",))  # fmt: skip
    show = adder.add(
        "show",
        "List the code points of one block.",
        run=run_block_show,
        examples=('unichef block show "Arabic"', "unichef block show 'Box Drawing' --grid"),
    )
    show.add_argument("name", metavar="NAME", help="Block name (loose matching).")
    show.add_argument("--grid", action="store_true", help="Show a 16-column character grid.")


# -- script --------------------------------------------------------------------------------


def _scripts() -> dict[str, str]:
    """Short code -> long name (the longest alias)."""
    from unichef.unicode import data  # noqa: PLC0415

    out: dict[str, str] = {}
    for alias, short in data.load("core")["aliases"]["values"]["sc"].items():
        if len(alias) > len(out.get(short, "")):
            out[short] = alias
    return out


def _count(ranges: Iterable[tuple[int, int]]) -> int:
    return sum(end - start + 1 for start, end in ranges)


def run_script_list(session: Session, _ns: argparse.Namespace) -> None:
    from unichef.unicode import props  # noqa: PLC0415

    rows = tuple(
        (short, long, _count(props.ranges_for("sc", short)))
        for short, long in sorted(_scripts().items())
    )
    session.emit(Dish("table", Table(("code", "name", "code points"), rows)))


def run_script_show(session: Session, ns: argparse.Namespace) -> None:
    from unichef.unicode import data, props  # noqa: PLC0415

    short = props.resolve_value("sc", ns.name)
    cps = list(data.code_points(props.ranges_for("sc", short)))
    if ns.limit is not None and len(cps) > ns.limit:
        session.notice(f"Showing {ns.limit} of {len(cps)} code points; use --limit.")
        cps = cps[: ns.limit]
    table = select(code_points_table(session, cps), ("cp", "char", "name", "gc", "block"))
    title = f"{_scripts().get(short, short)} ({short})"
    session.emit(Dish("table", table), pretty=rich_table(table, title=title))


def configure_script(parser: UniChefParser, factory: SubFactory) -> None:
    from unichef.cli.parser import positive_int  # noqa: PLC0415

    adder = factory.subparsers(parser, "script_command", "ACTION")
    adder.add("list", "List every script with its code-point count.", run=run_script_list,
              examples=("unichef script list",))  # fmt: skip
    show = adder.add(
        "show",
        "List the code points of one script.",
        run=run_script_show,
        examples=("unichef script show Arab", "unichef script show Greek --limit 50"),
    )
    show.add_argument("name", metavar="SCRIPT", help="Script code or name, e.g. Arab or Arabic.")
    show.add_argument("--limit", type=positive_int, metavar="N", help="Show at most N.")


# -- command list --------------------------------------------------------------------------


def _configure_inspect(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument("text", nargs="?", metavar="TEXT", help="Text (else -i or stdin).")
    parser.add_argument(
        "--granularity",
        choices=("codepoint", "grapheme"),
        default="codepoint",
        help="One row per code point or per grapheme cluster.",
    )


def _configure_char(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument(
        "char", metavar="CHAR", help="A character, U+XXXX, 0xXXXX, a decimal or a name."
    )


def _configure_search(parser: UniChefParser, _factory: SubFactory) -> None:
    from unichef.cli.parser import positive_int  # noqa: PLC0415

    parser.add_argument("query", metavar="QUERY", help="Words, a /regex/, or property queries.")
    parser.add_argument(
        "--limit", type=positive_int, default=100, metavar="N", help="Show at most N results."
    )


COMMANDS = (
    Command(
        "inspect",
        "Characters",
        "Analyse every character of the input.",
        "[TEXT] [--granularity codepoint|grapheme]",
        _configure_inspect,
        run_inspect,
        examples=("unichef inspect 'héllo'", "unichef inspect -i file.txt --format json"),
    ),
    Command(
        "char",
        "Characters",
        "Show the properties of one character.",
        "CHAR",
        _configure_char,
        run_char,
        examples=(
            "unichef char U+1F600",
            "unichef char 'é'",
            "unichef char 'ZERO WIDTH SPACE'",
        ),
    ),
    Command(
        "search",
        "Characters",
        "Find characters by name or property.",
        "QUERY [--limit N]",
        _configure_search,
        run_search,
        examples=("unichef search 'arrow'", "unichef search 'gc:Sc' --limit 20"),
    ),
    Command(
        "block",
        "Characters",
        "List blocks or show one block.",
        "list | show NAME [--grid]",
        configure_block,
        examples=("unichef block list", 'unichef block show "Arabic" --grid'),
    ),
    Command(
        "script",
        "Characters",
        "List scripts or show one script.",
        "list | show SCRIPT",
        configure_script,
        examples=("unichef script list", "unichef script show Arab"),
    ),
)
