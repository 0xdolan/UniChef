# SPDX-License-Identifier: GPL-3.0-or-later
"""Flow-control operations (PRD §3.5).

``label``, ``comment``, ``jump`` and ``conditional-jump`` are interpreted by the runner;
their ``run`` functions only document the no-op behaviour. Nested step lists run
through ``OpContext.run_nested`` so limits, warnings and error paths carry over.
"""

from typing import cast

from unichef.core.dish import Dish, coerce
from unichef.core.registry import (
    Args,
    OpContext,
    int_arg,
    operation,
    steps_arg,
    string_arg,
)


@operation(
    "fork",
    "Fork",
    "Flow",
    "string",
    "string",
    (string_arg("split", "\n"), string_arg("merge", "\n"), steps_arg()),
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


@operation("sub-recipe", "Sub-recipe", "Flow", "bytes", "bytes", (steps_arg(),))
def sub_recipe(data: bytes, args: Args, ctx: OpContext) -> bytes:
    """Run `steps` as one group. The runner keeps the dish type across the group; this
    function serves direct calls only."""
    result = ctx.run_nested(args.steps(), Dish.of_bytes(data))
    return cast(bytes, coerce(result, "bytes", ctx.warn).value)


@operation("label", "Label", "Flow", "bytes", "bytes", (string_arg("name"),))
def label(data: bytes, _args: Args, _ctx: OpContext) -> bytes:
    """A jump target. The dish passes through unchanged, whatever its type."""
    return data


@operation("comment", "Comment", "Flow", "bytes", "bytes", (string_arg("text", multiline=True),))
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
