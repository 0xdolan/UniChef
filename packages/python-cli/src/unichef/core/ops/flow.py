# SPDX-License-Identifier: GPL-3.0-or-later
"""Flow-control operations (PRD §3.5).

``label``, ``comment``, ``jump`` and ``conditional-jump`` are interpreted by the runner;
their ``run`` functions only document the no-op behaviour. Nested step lists run
through ``OpContext.run_nested`` so limits, warnings and error paths carry over.
"""

from typing import cast

from unichef.core.dish import Dish, coerce
from unichef.core.errors import UniChefError
from unichef.core.registry import (
    Args,
    Example,
    OpContext,
    bool_arg,
    int_arg,
    operation,
    regex_arg,
    steps_arg,
    string_arg,
)
from unichef.regex import run

MAX_GROUP = 99


@operation(
    "fork",
    "Fork",
    "Flow",
    "string",
    "string",
    (string_arg("split", "\n"), string_arg("merge", "\n"), steps_arg()),
    examples=(
        Example(
            "a,b,c",
            {
                "split": ",",
                "merge": " | ",
                "steps": [{"op": "unicode-case", "args": {"mode": "upper"}}],
            },
            "A | B | C",
        ),
    ),
)
def fork(text: str, args: Args, ctx: OpContext) -> str:
    """Split the input on `split`, run `steps` on each part, and join the results with
    `merge`. An error in any branch fails the fork; its path names the branch."""
    sep = args.text("split")
    parts = text.split(sep) if sep else list(text)
    out: list[str] = []
    for i, part in enumerate(parts):
        result = ctx.run_nested(args.steps(), Dish.of_string(part), "branch", i)
        out.append(cast(str, coerce(result, "string", ctx.warn).value))
    return args.text("merge").join(out)


@operation(
    "sub-recipe",
    "Sub-recipe",
    "Flow",
    "bytes",
    "bytes",
    (steps_arg(),),
    examples=(Example("hello", {"steps": [{"op": "to-base64"}, {"op": "reverse"}]}, "=8GbsVGa"),),
)
def sub_recipe(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Run `steps` as one group. The runner keeps the dish type across the group; this
    function serves direct calls only."""
    result = ctx.run_nested(args.steps(), Dish.of_bytes(data))
    return cast(bytes, coerce(result, "bytes", ctx.warn).value)


@operation(
    "label",
    "Label",
    "Flow",
    "bytes",
    "bytes",
    (string_arg("name"),),
    examples=(Example("unchanged", {"name": "start"}, "unchanged"),),
)
def label(data: bytes, _args: Args, _ctx: OpContext) -> bytes:
    """A jump target. The dish passes through unchanged, whatever its type."""
    return data


@operation(
    "comment",
    "Comment",
    "Flow",
    "bytes",
    "bytes",
    (string_arg("text", multiline=True),),
    examples=(Example("unchanged", {"text": "notes for readers"}, "unchanged"),),
)
def comment(data: bytes, _args: Args, _ctx: OpContext) -> bytes:
    """An annotation. The dish passes through unchanged, whatever its type."""
    return data


@operation(
    "jump",
    "Jump",
    "Flow",
    "string",
    "string",
    (string_arg("to"), int_arg("max", 10, 0, 1000)),
)
def jump(_text: str, _args: Args, _ctx: OpContext) -> bool:
    """Jump to the label `to`, at most `max` times; then continue with a W_JUMP_LIMIT
    warning. Every jump counts towards the step limit."""
    return True


@operation(
    "conditional-jump",
    "Conditional jump",
    "Flow",
    "string",
    "string",
    (
        regex_arg("pattern"),
        string_arg("flags"),
        bool_arg("invert"),
        string_arg("to"),
        int_arg("max", 10, 0, 1000),
    ),
)
def conditional_jump(text: str, args: Args, ctx: OpContext) -> bool:
    """Jump to the label `to` when `pattern` matches the dish (or does not, with
    `invert`), at most `max` times; then continue with a W_JUMP_LIMIT warning."""
    compiled = run.compile_regex(args.text("pattern"), args.text("flags"))
    found = run.search(compiled, text, ctx.limits.regex_timeout_ms) is not None
    return found != args.flag("invert")


@operation(
    "subsection",
    "Subsection",
    "Flow",
    "string",
    "string",
    (
        regex_arg("pattern"),
        string_arg("flags"),
        int_arg("group", 0, 0, MAX_GROUP),
        bool_arg("global", True),
        steps_arg(),
    ),
    examples=(
        Example(
            "name=zoë id=7",
            {
                "pattern": "=(\\w+)",
                "group": 1,
                "steps": [{"op": "unicode-case", "args": {"mode": "upper"}}],
            },
            "name=ZOË id=7",
        ),
    ),
)
def subsection(text: str, args: Args, ctx: OpContext) -> str:
    """Run `steps` on each match of `pattern` (or on its capture group `group`) and
    splice the results back; the rest of the dish passes through. Empty matches and
    groups that did not participate are left alone. With `global` off, only the first
    match is used. An error inside a match fails the step; its path names the match."""
    compiled = run.compile_regex(args.text("pattern"), args.text("flags"))
    group = args.integer("group")
    if group > compiled.groups:
        raise UniChefError(
            "E_ARG_INVALID",
            f"The pattern has {compiled.groups} capture group(s); there is no group {group}.",
        )
    timeout = ctx.limits.regex_timeout_ms
    # Matching finishes before any steps run, so the regex timeout covers matching only.
    if args.flag("global"):
        matches = list(run.finditer(compiled, text, timeout, ctx.check))
    else:
        first = run.search(compiled, text, timeout)
        matches = [] if first is None else [first]
    out: list[str] = []
    done = 0
    for i, match in enumerate(matches):
        span = match.spans[group]
        if span is not None and span[1] > span[0]:
            part = Dish.of_string(text[span[0] : span[1]])
            result = ctx.run_nested(args.steps(), part, "match", i)
            out.extend((text[done : span[0]], cast(str, coerce(result, "string", ctx.warn).value)))
            done = span[1]
    out.append(text[done:])
    return "".join(out)
