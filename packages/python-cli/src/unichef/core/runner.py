# SPDX-License-Identifier: GPL-3.0-or-later
"""Recipe execution: coercion between steps, flow control and limits (PRD §3.2-§3.6)."""

from dataclasses import dataclass, field
from typing import cast

from unichef.core.dish import Dish, DishValue, Table, coerce
from unichef.core.errors import PathItem, RunWarning, UniChefError
from unichef.core.recipe import JUMP_OPS, Recipe, jump_targets, resolve_args
from unichef.core.registry import (
    Args,
    Limits,
    OpContext,
    Operation,
    Rng,
    Step,
    get_operation,
)
from unichef.unicode import utf8

PASSTHROUGH_OPS = frozenset({"label", "comment"})
"""No-op steps: the dish passes through with its type unchanged."""


@dataclass(slots=True)
class BakeResult:
    dish: Dish
    warnings: list[RunWarning] = field(default_factory=list)
    steps_executed: int = 0
    stopped_at: int | None = None
    """Top-level index of the step the bake stopped before (``until`` or a breakpoint)."""


def dish_size(dish: Dish) -> int:
    """Size used for the input and output limits: bytes, or code points for text."""
    value = dish.value
    if isinstance(value, bytes | str | list):
        return len(value)
    if isinstance(value, Table):
        return sum(len(row) for row in value.rows)
    return 0


class Runner:
    """Executes step lists against one context. Not reusable across bakes."""

    def __init__(self, ctx: OpContext) -> None:
        self.ctx = ctx
        self.executed = 0
        ctx.nested = self.run_steps

    # -- single step ---------------------------------------------------------

    def run_step(self, step: Step, dish: Dish, path: tuple[PathItem, ...]) -> Dish:
        op = get_operation(step.op)
        ctx = self.ctx
        ctx.check()
        saved = ctx.path
        ctx.path = path
        try:
            source = coerce(dish, op.input_type, ctx.warn)
            value = op.run(source.value, Args(step.args), ctx)
            result = Dish(op.output_type, cast(DishValue, value))
            if result.type == "string":
                result = Dish("string", utf8.scrub(cast(str, result.value)))
            limit = ctx.limits.output_limit(dish_size(source))
            if dish_size(result) > limit:
                raise UniChefError(
                    "E_LIMIT", f"{op.id} produced more than {limit} units of output."
                )
            return result
        except UniChefError as exc:
            if not exc.path:
                exc.path = list(path)
            raise
        except RecursionError as exc:
            raise UniChefError(
                "E_LIMIT", f"{op.id}: input is nested too deeply.", list(path)
            ) from exc
        except MemoryError as exc:
            raise UniChefError("E_LIMIT", f"{op.id}: out of memory.", list(path)) from exc
        except Exception as exc:
            from unichef import __version__  # noqa: PLC0415 (only on the error path)

            raise UniChefError(
                "E_INTERNAL",
                f"{op.id} failed unexpectedly ({type(exc).__name__}); please report this "
                f"with UniChef {__version__}.",
                list(path),
            ) from exc
        finally:
            ctx.path = saved

    # -- step lists ----------------------------------------------------------

    def _count(self, path: tuple[PathItem, ...]) -> None:
        self.executed += 1
        if self.executed > self.ctx.limits.max_steps:
            raise UniChefError(
                "E_LIMIT",
                f"The bake executed more than {self.ctx.limits.max_steps} steps.",
                list(path),
            )

    def _should_jump(self, op: Operation, step: Step, dish: Dish) -> bool:
        if step.op == "jump":
            return True
        return bool(op.run(coerce(dish, "string", self.ctx.warn).value, Args(step.args), self.ctx))

    def run_steps(
        self,
        steps: list[Step],
        dish: Dish,
        path: tuple[PathItem, ...] = (),
        *,
        until: int | None = None,
        breakpoints: bool = False,
    ) -> Dish:
        result, _ = self._run_list(steps, dish, path, until=until, breakpoints=breakpoints)
        return result

    def _run_list(
        self,
        steps: list[Step],
        dish: Dish,
        path: tuple[PathItem, ...],
        *,
        until: int | None = None,
        breakpoints: bool = False,
    ) -> tuple[Dish, int | None]:
        targets = jump_targets(steps, list(path))
        jumps: dict[int, int] = {}
        i = 0
        while i < len(steps):
            step = steps[i]
            here = (*path, i)
            if (until is not None and i >= until) or (breakpoints and step.breakpoint):
                return dish, i
            if step.disabled:
                i += 1
                continue
            self._count(here)
            if step.op in PASSTHROUGH_OPS:
                i += 1
                continue
            if step.op == "sub-recipe":
                # A scope keeps the dish type, so it bypasses input coercion.
                dish = self.run_steps(cast(list[Step], step.args["steps"]), dish, here)
                i += 1
                continue
            if step.op in JUMP_OPS:
                op = get_operation(step.op)
                self.ctx.path = here
                if self._should_jump(op, step, dish):
                    taken = jumps.get(i, 0)
                    if taken < int(cast(int, step.args["max"])):
                        jumps[i] = taken + 1
                        i = targets[cast(str, step.args["to"])]
                        continue
                    if taken == step.args["max"]:
                        jumps[i] = taken + 1
                        self.ctx.warn(
                            "W_JUMP_LIMIT",
                            f"Jump to {step.args['to']!s} reached its limit of "
                            f"{step.args['max']!s}; continuing.",
                        )
                i += 1
                continue
            dish = self.run_step(step, dish, here)
            i += 1
        return dish, None


def bake(
    recipe: Recipe,
    dish: Dish,
    *,
    limits: Limits | None = None,
    ctx: OpContext | None = None,
    until: int | None = None,
    breakpoints: bool = False,
) -> BakeResult:
    """Run ``recipe`` on ``dish``. Raises ``UniChefError`` with the step path on failure."""
    context = ctx or OpContext(limits=limits or Limits(), rng=Rng(recipe.seed))
    if dish_size(dish) > context.limits.max_input_size:
        raise UniChefError(
            "E_LIMIT", f"The input is larger than {context.limits.max_input_size} bytes."
        )
    runner = Runner(context)
    result, stopped = runner._run_list(recipe.steps, dish, (), until=until, breakpoints=breakpoints)
    return BakeResult(result, context.warnings, runner.executed, stopped)


def run_operation(
    op_id: str,
    args: dict[str, object],
    dish: Dish,
    *,
    ctx: OpContext | None = None,
) -> BakeResult:
    """Run one operation with raw (JSON) arguments, as ``unichef op`` does."""
    op = get_operation(op_id)
    step = Step(op=op_id, args=resolve_args(op, args, [0]))
    return bake(Recipe(steps=[step]), dish, ctx=ctx)
