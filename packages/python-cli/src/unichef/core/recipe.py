# SPDX-License-Identifier: GPL-3.0-or-later
"""Recipe parsing and two-phase validation (PRD §3.4).

Phase 1 checks the shape against ``spec/recipe.schema.json`` (mirrored here so the core
needs no JSON Schema engine). Phase 2 resolves every operation and argument, and checks
labels, jump targets and nesting depth.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import cast

from unichef.core.dish import JsonValue
from unichef.core.errors import PathItem, UniChefError
from unichef.core.registry import (
    JS_SAFE_INTEGER,
    ArgSpec,
    ArgValue,
    BytesValue,
    Operation,
    Step,
    get_operation,
)

_OP_ID = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
_LABEL = re.compile(r"[A-Za-z_][A-Za-z0-9_]{0,63}")
_SEED = re.compile(r"[0-9a-f]{32}")
_DECIMAL = re.compile(r"-?(0|[1-9][0-9]*)")
_STEP_KEYS = frozenset({"op", "args", "disabled", "breakpoint", "label", "comment"})
_RECIPE_KEYS = frozenset({"version", "name", "description", "seed", "steps"})
MAX_STEPS_PER_LIST = 1000
JUMP_OPS = frozenset({"jump", "conditional-jump"})


@dataclass(slots=True, frozen=True)
class Recipe:
    steps: list[Step]
    name: str | None = None
    description: str | None = None
    seed: str | None = None
    version: int = 1
    source: Mapping[str, JsonValue] = field(default_factory=dict)


def _schema_error(path: list[PathItem], message: str) -> UniChefError:
    return UniChefError("E_RECIPE_SCHEMA", message, path)


def _check_str(value: object, path: list[PathItem], what: str, max_len: int) -> str:
    if not isinstance(value, str):
        raise _schema_error(path, f"{what} must be a string.")
    if len(value) > max_len:
        raise _schema_error(path, f"{what} is longer than {max_len} characters.")
    return value


# ---------------------------------------------------------------------------
# Arguments


def _arg_error(op: Operation, spec: ArgSpec, message: str) -> UniChefError:
    return UniChefError("E_ARG_INVALID", f"{op.id}: argument {spec.name!r} {message}")


def _integer_value(raw: object) -> int | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if abs(raw) <= JS_SAFE_INTEGER else None
    if isinstance(raw, str) and _DECIMAL.fullmatch(raw):
        return int(raw)
    return None


def _resolve_integer(op: Operation, spec: ArgSpec, raw: object) -> int:
    value = _integer_value(raw)
    if value is None:
        raise _arg_error(op, spec, "must be an integer.")
    if spec.minimum is not None and value < spec.minimum:
        raise _arg_error(op, spec, f"must be at least {spec.minimum}.")
    if spec.maximum is not None and value > spec.maximum:
        raise _arg_error(op, spec, f"must be at most {spec.maximum}.")
    return value


def _resolve_bytes(op: Operation, spec: ArgSpec, raw: object) -> BytesValue:
    if (
        not isinstance(raw, dict)
        or set(raw) != {"encoding", "value"}
        or raw["encoding"] not in spec.encodings
        or not isinstance(raw["value"], str)
    ):
        raise _arg_error(
            op,
            spec,
            'must be {"encoding": ' + "|".join(spec.encodings) + ', "value": string}.',
        )
    value = BytesValue(raw["encoding"], raw["value"])
    value.decode(spec.name)
    return value


def resolve_arg(
    op: Operation, spec: ArgSpec, raw: object, path: list[PathItem], depth: int
) -> ArgValue:
    """Validate one raw JSON argument value against its spec."""
    match spec.kind:
        case "string" | "regex":
            if not isinstance(raw, str):
                raise _arg_error(op, spec, "must be a string.")
            return raw
        case "enum":
            if not isinstance(raw, str) or raw not in spec.options:
                raise _arg_error(op, spec, f"must be one of {', '.join(spec.options)}.")
            return raw
        case "boolean":
            if not isinstance(raw, bool):
                raise _arg_error(op, spec, "must be true or false.")
            return raw
        case "integer":
            return _resolve_integer(op, spec, raw)
        case "bytes":
            return _resolve_bytes(op, spec, raw)
        case "steps":
            if not isinstance(raw, list):
                raise _arg_error(op, spec, "must be a list of steps.")
            return parse_steps(cast(list[JsonValue], raw), path, depth + 1)


def default_arg(spec: ArgSpec) -> ArgValue:
    if spec.kind == "steps":
        return []
    if spec.kind == "bytes":
        return BytesValue(spec.encodings[0], cast(str, spec.default))
    if spec.default is None:  # pragma: no cover - every non-steps spec has a default
        raise ValueError(f"argument {spec.name} has no default")
    return spec.default


def resolve_args(
    op: Operation, raw: Mapping[str, object], path: list[PathItem] | None = None, depth: int = 1
) -> dict[str, ArgValue]:
    """Resolve named args: unknown names are errors, missing ones take their default."""
    where = path or []
    for name in raw:
        if op.arg(name) is None:
            raise UniChefError("E_ARG_INVALID", f"{op.id}: unknown argument {name[:64]!r}.", where)
    out: dict[str, ArgValue] = {}
    for spec in op.args:
        if spec.name in raw:
            try:
                out[spec.name] = resolve_arg(op, spec, raw[spec.name], where, depth)
            except UniChefError as exc:
                if not exc.path:
                    exc.path = list(where)
                raise
        else:
            out[spec.name] = default_arg(spec)
    return out


# ---------------------------------------------------------------------------
# Steps


def _parse_step(raw: object, path: list[PathItem], depth: int) -> Step:
    if not isinstance(raw, dict):
        raise _schema_error(path, "A step must be an object.")
    extra = set(raw) - _STEP_KEYS
    if extra:
        raise _schema_error(path, f"Unknown step property {sorted(extra)[0][:64]!r}.")
    op_id = raw.get("op")
    if not isinstance(op_id, str) or not _OP_ID.fullmatch(op_id):
        raise _schema_error(path, "A step needs an 'op' id in kebab-case.")
    raw_args = raw.get("args", {})
    if not isinstance(raw_args, dict):
        raise _schema_error(path, "Step 'args' must be an object.")
    for key in ("disabled", "breakpoint"):
        if key in raw and not isinstance(raw[key], bool):
            raise _schema_error(path, f"Step {key!r} must be true or false.")
    label = raw.get("label")
    if label is not None and (not isinstance(label, str) or not _LABEL.fullmatch(label)):
        raise _schema_error(path, "Step 'label' must match ^[A-Za-z_][A-Za-z0-9_]{0,63}$.")
    comment = raw.get("comment")
    if comment is not None:
        _check_str(comment, path, "Step 'comment'", 2000)
    try:
        op = get_operation(op_id)
    except UniChefError as exc:
        raise exc.with_prefix(*path) from None
    args = resolve_args(op, raw_args, path, depth)
    return Step(
        op=op_id,
        args=args,
        disabled=bool(raw.get("disabled", False)),
        breakpoint=bool(raw.get("breakpoint", False)),
        label=label,
        comment=comment,
    )


def jump_targets(steps: list[Step], path: list[PathItem]) -> dict[str, int]:
    """Map each label name in one step list to its index. Names must be unique."""
    targets: dict[str, int] = {}
    for i, step in enumerate(steps):
        names = [step.label] if step.label else []
        if step.op == "label":
            names.append(cast(str, step.args["name"]))
        for name in dict.fromkeys(names):
            if name in targets:
                raise _schema_error([*path, i], f"Duplicate label {name!r}.")
            targets[name] = i
    return targets


def parse_steps(raw: list[JsonValue], path: list[PathItem], depth: int) -> list[Step]:
    """Parse a step list at nesting ``depth`` (the top level is 1)."""
    if depth > 8:  # noqa: PLR2004 (PRD §3.5 nesting limit)
        raise UniChefError("E_LIMIT", "Recipes may nest at most 8 levels.", path)
    if len(raw) > MAX_STEPS_PER_LIST:
        raise _schema_error(path, f"A step list holds at most {MAX_STEPS_PER_LIST} steps.")
    steps = [_parse_step(item, [*path, i], depth) for i, item in enumerate(raw)]
    targets = jump_targets(steps, path)
    for i, step in enumerate(steps):
        if step.op in JUMP_OPS:
            to = cast(str, step.args["to"])
            if to not in targets:
                raise _schema_error([*path, i], f"Jump target {to[:64]!r} does not exist.")
    return steps


def parse_recipe(raw: object) -> Recipe:
    """Validate a decoded recipe document and resolve it (both phases)."""
    if not isinstance(raw, dict):
        raise _schema_error([], "A recipe must be a JSON object.")
    extra = set(raw) - _RECIPE_KEYS
    if extra:
        raise _schema_error([], f"Unknown recipe property {sorted(extra)[0][:64]!r}.")
    version = raw.get("version")
    if version != 1 or isinstance(version, bool):
        raise _schema_error([], "Recipe 'version' must be 1.")
    name = raw.get("name")
    if name is not None:
        _check_str(name, [], "Recipe 'name'", 200)
    description = raw.get("description")
    if description is not None:
        _check_str(description, [], "Recipe 'description'", 5000)
    seed = raw.get("seed")
    if seed is not None and (not isinstance(seed, str) or not _SEED.fullmatch(seed)):
        raise _schema_error([], "Recipe 'seed' must be 32 lower-case hex digits.")
    steps = raw.get("steps")
    if not isinstance(steps, list):
        raise _schema_error([], "Recipe 'steps' must be an array.")
    return Recipe(
        steps=parse_steps(steps, [], 1),
        name=name,
        description=description,
        seed=seed,
        source=raw,
    )
