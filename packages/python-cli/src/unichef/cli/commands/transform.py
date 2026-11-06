# SPDX-License-Identifier: GPL-3.0-or-later
"""Transform commands: bake, op, ops, recipe and regex."""

import argparse
import json
import time
from collections.abc import Mapping
from typing import cast

from rich.console import RenderableType
from rich.text import Text
from rich.tree import Tree

from unichef.cli.parser import Command, SubFactory, UniChefParser
from unichef.cli.session import Session, rich_table
from unichef.core.dish import Dish, JsonValue, Table, coerce, json_loads
from unichef.core.errors import PathItem, UniChefError, quote_input
from unichef.core.recipe import Recipe, parse_recipe
from unichef.core.registry import (
    ArgSpec,
    OpContext,
    Operation,
    Step,
    all_operations,
    get_operation,
)
from unichef.core.runner import BakeResult, Runner, dish_size, run_operation

PREVIEW = 48
MS = 1000


# -- shared helpers --------------------------------------------------------------------


def load_json(session: Session, path: str, what: str = "recipe") -> JsonValue:
    """Read and parse a JSON document; malformed JSON is ``E_RECIPE_SCHEMA``."""
    raw = session.read_bytes(path)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise UniChefError("E_RECIPE_SCHEMA", f"The {what} is not valid UTF-8.") from exc
    try:
        return json_loads(text, session.collect_warning)
    except UniChefError as exc:
        raise UniChefError("E_RECIPE_SCHEMA", f"The {what} is not valid JSON.") from exc


def load_recipe(session: Session, path: str) -> Recipe:
    return parse_recipe(load_json(session, path))


def text_input(session: Session, text: str | None) -> str:
    dish = session.read_input(text)
    return cast(str, coerce(dish, "string").value)


def preview(dish: Dish) -> str:
    """A one-line glimpse of a dish for ``--steps``."""
    value = dish.value
    if isinstance(value, Table):
        return f"<table: {len(value.rows)} rows>"
    if isinstance(value, bytes):
        try:
            text = value.decode("utf-8")
        except UnicodeDecodeError:
            text = value[: PREVIEW // 2].hex(" ")
    else:
        text = str(coerce(dish, "string").value)
    flat = text.replace("\n", "\\n").replace("\t", "\\t")
    return flat if len(flat) <= PREVIEW else flat[: PREVIEW - 1] + "…"


# -- recipe formatting -----------------------------------------------------------------

RECIPE_ORDER = ("version", "name", "description", "seed", "steps")
STEP_ORDER = ("op", "label", "args", "disabled", "breakpoint", "comment")


def _ordered(obj: Mapping[str, JsonValue], order: tuple[str, ...]) -> dict[str, JsonValue]:
    out = {k: obj[k] for k in order if k in obj}
    out.update({k: v for k, v in obj.items() if k not in out})
    return out


def _is_steps(value: JsonValue) -> bool:
    return isinstance(value, list) and all(isinstance(s, dict) and "op" in s for s in value)


def _canonical_step(step: JsonValue) -> JsonValue:
    if not isinstance(step, dict):
        return step
    out = _ordered(step, STEP_ORDER)
    args = out.get("args")
    if isinstance(args, dict):
        out["args"] = {
            k: [_canonical_step(s) for s in cast(list[JsonValue], v)] if _is_steps(v) else v
            for k, v in args.items()
        }
    return out


def format_recipe(doc: JsonValue) -> str:
    """Canonical recipe JSON: fixed key order, two-space indent, trailing newline."""
    if isinstance(doc, dict):
        doc = _ordered(doc, RECIPE_ORDER)
        steps = doc.get("steps")
        if isinstance(steps, list):
            doc["steps"] = [_canonical_step(s) for s in steps]
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def count_steps(steps: list[Step]) -> int:
    total = 0
    for step in steps:
        total += 1
        for value in step.args.values():
            if isinstance(value, list):
                total += count_steps(value)
    return total


# -- bake --------------------------------------------------------------------------------


class _TimedRunner(Runner):
    """Records the time and output of every top-level step."""

    def __init__(self, ctx: OpContext) -> None:
        super().__init__(ctx)
        self.timings: list[tuple[int, str, float, str, str]] = []

    def run_step(self, step: Step, dish: Dish, path: tuple[PathItem, ...]) -> Dish:
        if len(path) != 1:
            return super().run_step(step, dish, path)
        start = time.perf_counter()
        out = super().run_step(step, dish, path)
        elapsed = (time.perf_counter() - start) * MS
        self.timings.append((int(path[0]), step.op, elapsed, out.type, preview(out)))
        return out


def _timings_table(runner: _TimedRunner, *, with_preview: bool) -> Table:
    columns = ("step", "op", "ms", "type", *(("output",) if with_preview else ()))
    rows = tuple(
        (index, op, f"{ms:.2f}", kind, *((text,) if with_preview else ()))
        for index, op, ms, kind, text in runner.timings
    )
    return Table(columns, rows)


def run_bake(session: Session, ns: argparse.Namespace) -> None:
    recipe = load_recipe(session, ns.recipe)
    dish = session.read_input(ns.text)
    ctx = session.context(recipe.seed)
    if dish_size(dish) > ctx.limits.max_input_size:  # pragma: no cover - read_input enforces it
        raise UniChefError("E_LIMIT", f"The input is larger than {ctx.limits.max_input_size}.")
    runner = _TimedRunner(ctx)
    until = None if ns.until is None else ns.until
    try:
        result, stopped = runner._run_list(
            recipe.steps, dish, (), until=until, breakpoints=ns.breakpoints
        )
    finally:
        if ns.steps or session.options.verbose:
            session.stderr(rich_table(_timings_table(runner, with_preview=ns.steps)))
    baked = BakeResult(result, [*session.drain_warnings(), *ctx.warnings], runner.executed, stopped)
    if baked.stopped_at is not None:
        session.notice(f"Stopped before step {baked.stopped_at}.")
    session.emit(baked.dish, baked.warnings)


# -- op ------------------------------------------------------------------------------------

_TRUE = {"true", "1", "yes", "on"}
_FALSE = {"false", "0", "no", "off"}


def convert_arg(spec: ArgSpec, text: str) -> object:
    """A ``--arg name=value`` string as the JSON value the recipe validator expects."""
    match spec.kind:
        case "integer":
            return int(text) if text.lstrip("-").isdigit() else text
        case "boolean":
            low = text.lower()
            return True if low in _TRUE else False if low in _FALSE else text
        case "bytes":
            prefix, sep, rest = text.partition(":")
            if sep and prefix in spec.encodings:
                return {"encoding": prefix, "value": rest}
            return {"encoding": "utf8" if "utf8" in spec.encodings else spec.encodings[0],
                    "value": text}  # fmt: skip
        case "steps":
            try:
                return json.loads(text)
            except ValueError as exc:
                raise UniChefError(
                    "E_ARG_INVALID", f"--arg {spec.name}: steps must be a JSON array."
                ) from exc
        case _:
            return text


def collect_args(op: Operation, pairs: list[str], raw_json: str | None) -> dict[str, object]:
    args: dict[str, object] = {}
    for pair in pairs:
        name, sep, value = pair.partition("=")
        if not sep or not name:
            raise UniChefError("E_USAGE", f"--arg expects NAME=VALUE, got {quote_input(pair)}.")
        spec = op.arg(name)
        args[name] = value if spec is None else convert_arg(spec, value)
    if raw_json is not None:
        try:
            extra = json.loads(raw_json)
        except ValueError as exc:
            raise UniChefError("E_USAGE", "--arg-json is not valid JSON.") from exc
        if not isinstance(extra, dict):
            raise UniChefError("E_USAGE", "--arg-json must be a JSON object.")
        args.update(extra)
    return args


def run_op(session: Session, ns: argparse.Namespace) -> None:
    op = get_operation(ns.id)
    args = collect_args(op, ns.arg, ns.arg_json)
    dish = session.read_input(ns.text)
    result = run_operation(op.id, args, dish, ctx=session.context())
    session.emit(result.dish, result.warnings)


# -- ops ---------------------------------------------------------------------------------


def summary(op: Operation) -> str:
    first = op.description.split("\n\n")[0].replace("\n", " ").strip()
    end = first.find(". ")
    return first if end < 0 else first[: end + 1]


def _matching(category: str | None, search: str | None) -> list[Operation]:
    ops = all_operations()
    if category:
        ops = [op for op in ops if op.category.lower() == category.lower()]
    if search:
        needle = search.lower()
        ops = [
            op
            for op in ops
            if needle in op.id or needle in op.name.lower() or needle in op.description.lower()
        ]
    return ops


def run_ops(session: Session, ns: argparse.Namespace) -> None:
    ops = _matching(ns.category, ns.search)
    if ns.ids:
        session.emit(Dish("string", "\n".join(op.id for op in ops) + ("\n" if ops else "")))
        return
    table = Table(
        ("id", "name", "category", "input", "output", "summary"),
        tuple((op.id, op.name, op.category, op.input_type, op.output_type, summary(op))
              for op in ops),
    )  # fmt: skip
    pretty: RenderableType
    if ns.view == "tree":
        tree = Tree(Text(f"{len(ops)} operations", style="brand.primary"))
        for category in sorted({op.category for op in ops}):
            branch = tree.add(Text(category, style="brand.accent"))
            for op in ops:
                if op.category == category:
                    branch.add(Text.assemble((op.id, "cp"), "  ", (op.name, "muted")))
        pretty = tree
    else:
        pretty = rich_table(table)
    session.emit(Dish("table", table), pretty=pretty)


# -- recipe ------------------------------------------------------------------------------


def run_recipe_validate(session: Session, ns: argparse.Namespace) -> None:
    recipe = load_recipe(session, ns.file)
    total = count_steps(recipe.steps)
    value: dict[str, JsonValue] = {"valid": True, "steps": total, "name": recipe.name}
    label = f" {recipe.name!r}" if recipe.name else ""
    pretty = Text.assemble(("valid", "ok"), f": recipe{label} with {total} step(s)")
    session.emit(Dish("json", value), session.drain_warnings(), pretty=pretty)


def run_recipe_fmt(session: Session, ns: argparse.Namespace) -> None:
    doc = load_json(session, ns.file)
    parse_recipe(doc)
    session.emit(Dish("string", format_recipe(doc)), session.drain_warnings())


def run_recipe_import(session: Session, ns: argparse.Namespace) -> None:
    from unichef.cli.cyberchef import import_recipe  # noqa: PLC0415 - loads the map

    raw = session.read_bytes(ns.file)
    doc = import_recipe(raw.decode("utf-8-sig", errors="replace"))
    parse_recipe(doc)
    session.emit(Dish("string", format_recipe(doc)), session.drain_warnings())


def configure_recipe(parser: UniChefParser, factory: SubFactory) -> None:
    adder = factory.subparsers(parser, "recipe_command", "ACTION")
    validate = adder.add(
        "validate",
        "Check a recipe against the schema and the operation registry.",
        run=run_recipe_validate,
        examples=("unichef recipe validate recipe.json",),
    )
    validate.add_argument("file", metavar="FILE", help="Recipe file, or - for stdin.")
    fmt = adder.add(
        "fmt",
        "Print a recipe in canonical form.",
        run=run_recipe_fmt,
        examples=("unichef recipe fmt recipe.json -o recipe.json",),
    )
    fmt.add_argument("file", metavar="FILE", help="Recipe file, or - for stdin.")
    imp = adder.add(
        "import-cyberchef",
        "Convert a CyberChef recipe (JSON or chef format) to a UniChef recipe.",
        run=run_recipe_import,
        examples=("unichef recipe import-cyberchef chef.txt -o recipe.json",),
    )
    imp.add_argument("file", metavar="FILE", help="CyberChef recipe file, or - for stdin.")


# -- regex -------------------------------------------------------------------------------


def run_regex(session: Session, ns: argparse.Namespace) -> None:
    from unichef.regex.run import compile_regex, finditer  # noqa: PLC0415

    compiled = compile_regex(ns.pattern, ns.flags)
    if ns.explain:
        t = compiled.translation
        rows: tuple[tuple[str, str | int], ...] = (
            ("source", t.source),
            ("flags", t.flags),
            ("python", t.python),
            ("javascript", t.js),
            ("groups", t.groups),
            ("names", ", ".join(t.names)),
        )
        session.emit(Dish("table", Table(("property", "value"), rows)))
        return
    text = text_input(session, ns.text)
    groups = compiled.groups
    found = []
    for n, match in enumerate(
        finditer(compiled, text, session.limits.regex_timeout_ms, session.cancel_check), 1
    ):
        found.append(
            (n, match.start, match.end, match.group(text),
             *(match.group(text, g) for g in range(1, groups + 1)))
        )  # fmt: skip
    columns = ("#", "start", "end", "match", *(f"g{g}" for g in range(1, groups + 1)))
    table = Table(columns, tuple(found))
    pretty: RenderableType = rich_table(table)
    if not found:
        pretty = Text("No matches.", style="muted")
    session.emit(Dish("table", table), pretty=pretty)


# -- command list --------------------------------------------------------------------------


def _configure_bake(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument("text", nargs="?", metavar="TEXT", help="Input text (else -i or stdin).")
    parser.add_argument("-r", "--recipe", required=True, metavar="FILE", help="Recipe file.")
    parser.add_argument(
        "--until", type=int, metavar="N", help="Stop before top-level step N (0-based)."
    )
    parser.add_argument(
        "--breakpoints", action="store_true", help="Stop at the first step marked breakpoint."
    )
    parser.add_argument(
        "--steps", action="store_true", help="Show every top-level step's output on stderr."
    )


def _configure_op(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument("id", metavar="ID", help="Operation id (see unichef ops).")
    parser.add_argument("text", nargs="?", metavar="TEXT", help="Input text (else -i or stdin).")
    parser.add_argument(
        "--arg",
        action="append",
        default=[],
        metavar="NAME=VALUE",
        help="Set an argument; bytes take an optional hex:/utf8:/base64:/latin1: prefix.",
    )
    parser.add_argument("--arg-json", metavar="JSON", help="Arguments as a JSON object.")


def _configure_ops(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument("--category", metavar="NAME", help="Only this category.")
    parser.add_argument("--search", metavar="TEXT", help="Only ops whose id, name or text match.")
    parser.add_argument("--view", choices=("table", "tree"), default="table", help="Layout.")
    parser.add_argument("--ids", action="store_true", help="Print bare ids (for completion).")


def _configure_regex(parser: UniChefParser, _factory: SubFactory) -> None:
    parser.add_argument("pattern", metavar="PATTERN", help="Regular expression (UniChef subset).")
    parser.add_argument("text", nargs="?", metavar="TEXT", help="Input text (else -i or stdin).")
    parser.add_argument("--flags", default="", metavar="FLAGS", help="Flags from i, m, s, x.")
    parser.add_argument(
        "--explain", action="store_true", help="Show the translated pattern instead of matching."
    )


COMMANDS = (
    Command(
        "bake",
        "Transform",
        "Run a recipe on the input.",
        "-r RECIPE [TEXT] [--until N] [--steps]",
        _configure_bake,
        run_bake,
        examples=(
            "unichef bake -r recipe.json -i data.bin -o out.txt",
            "printf 'hello' | unichef bake -r recipe.json --steps",
        ),
    ),
    Command(
        "op",
        "Transform",
        "Run one operation on the input.",
        "ID [TEXT] [--arg NAME=VALUE] [--arg-json JSON]",
        _configure_op,
        run_op,
        examples=(
            "printf 'foo' | unichef op to-base64",
            "unichef op to-hex 'héllo' --arg delimiter=colon",
            "unichef op xor -i in.bin --arg key=hex:2a",
        ),
    ),
    Command(
        "ops",
        "Transform",
        "List the available operations.",
        "[--category C] [--search TEXT] [--view table|tree]",
        _configure_ops,
        run_ops,
        examples=("unichef ops --category Security", "unichef ops --search base64 --view tree"),
    ),
    Command(
        "recipe",
        "Transform",
        "Validate, format or import recipes.",
        "validate|fmt|import-cyberchef FILE",
        configure_recipe,
        examples=(
            "unichef recipe validate recipe.json",
            "unichef recipe import-cyberchef chef.json",
        ),
    ),
    Command(
        "regex",
        "Transform",
        "Match a regular expression against the input.",
        "PATTERN [TEXT] [--flags FLAGS] [--explain]",
        _configure_regex,
        run_regex,
        examples=(
            "unichef regex '\\p{Script=Greek}+' 'alpha αβγ'",
            "unichef regex '(?<year>\\d{4})' --explain",
        ),
    ),
)
