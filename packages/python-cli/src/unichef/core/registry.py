# SPDX-License-Identifier: GPL-3.0-or-later
"""Operation contract, argument specs and the operation registry (PRD §3.3)."""

import base64
import binascii
import hashlib
import secrets
import threading
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, cast

from unichef.core.dish import Dish, DishType, JsonValue
from unichef.core.errors import PathItem, RunWarning, UniChefError, WarningCode
from unichef.unicode import utf8

type ArgKind = Literal["string", "bytes", "integer", "boolean", "enum", "regex", "steps"]
type BytesEncoding = Literal["hex", "utf8", "base64", "latin1"]
type ParityClass = Literal["exact", "roundtrip", "nondeterministic"]
type Category = Literal[
    "Encoding",
    "Unicode",
    "Security",
    "Hashing",
    "Crypto",
    "Text",
    "Flow",
    "Compression",
    "Data",
]

JS_SAFE_INTEGER = 2**53 - 1
GiB = 1024**3
MiB = 1024**2


@dataclass(slots=True, frozen=True)
class ArgSpec:
    """One named argument. Only the fields relevant to ``kind`` are used."""

    kind: ArgKind
    name: str
    default: str | int | bool | None = None
    options: tuple[str, ...] = ()
    minimum: int | None = None
    maximum: int | None = None
    encodings: tuple[BytesEncoding, ...] = ("hex", "utf8", "base64", "latin1")
    multiline: bool = False
    secret: bool = False
    flags: str = ""
    description: str = ""


def string_arg(name: str, default: str = "", *, multiline: bool = False) -> ArgSpec:
    return ArgSpec("string", name, default, multiline=multiline)


def enum_arg(name: str, options: tuple[str, ...], default: str | None = None) -> ArgSpec:
    return ArgSpec("enum", name, options[0] if default is None else default, options=options)


def bool_arg(name: str, default: bool = False) -> ArgSpec:
    return ArgSpec("boolean", name, default)


def int_arg(
    name: str, default: int, minimum: int | None = None, maximum: int | None = None
) -> ArgSpec:
    return ArgSpec("integer", name, default, minimum=minimum, maximum=maximum)


def bytes_arg(
    name: str,
    default: str = "",
    encodings: tuple[BytesEncoding, ...] = ("hex", "utf8", "base64", "latin1"),
    *,
    secret: bool = False,
) -> ArgSpec:
    """`secret` marks a key or IV, which the web app leaves out of share links (SEC-007)."""
    return ArgSpec("bytes", name, default, encodings=encodings, secret=secret)


def regex_arg(name: str, default: str = "", flags: str = "") -> ArgSpec:
    return ArgSpec("regex", name, default, flags=flags)


def steps_arg(name: str = "steps") -> ArgSpec:
    return ArgSpec("steps", name)


@dataclass(slots=True, frozen=True)
class BytesValue:
    """A bytes argument as written in a recipe: ``{"encoding": …, "value": …}``."""

    encoding: BytesEncoding
    value: str

    def decode(self, name: str) -> bytes:
        try:
            match self.encoding:
                case "hex":
                    return bytes.fromhex(self.value)
                case "utf8":
                    return utf8.encode(self.value)
                case "base64":
                    return base64.b64decode(self.value, validate=True)
                case "latin1":
                    return self.value.encode("latin-1")
        except (ValueError, binascii.Error, UnicodeEncodeError) as exc:
            raise UniChefError(
                "E_ARG_INVALID", f"Argument {name!r} is not valid {self.encoding}."
            ) from exc


type ArgValue = str | int | bool | BytesValue | list["Step"]


@dataclass(slots=True, frozen=True)
class Step:
    """One recipe step (PRD §3.4). ``args`` holds the resolved values after validation."""

    op: str
    args: Mapping[str, ArgValue] = field(default_factory=dict)
    disabled: bool = False
    breakpoint: bool = False
    label: str | None = None
    comment: str | None = None


class Args:
    """Resolved argument values with typed accessors."""

    __slots__ = ("_values",)

    def __init__(self, values: Mapping[str, ArgValue]) -> None:
        self._values = dict(values)

    def text(self, name: str) -> str:
        return cast(str, self._values[name])

    def integer(self, name: str) -> int:
        return cast(int, self._values[name])

    def flag(self, name: str) -> bool:
        return cast(bool, self._values[name])

    def data(self, name: str) -> bytes:
        return cast(BytesValue, self._values[name]).decode(name)

    def steps(self, name: str = "steps") -> list[Step]:
        return cast(list[Step], self._values[name])

    def raw(self) -> dict[str, ArgValue]:
        return dict(self._values)


type NestedRunner = Callable[[list[Step], Dish, tuple[PathItem, ...]], Dish]


# ---------------------------------------------------------------------------
# Context


@dataclass(slots=True, frozen=True)
class Limits:
    """Run limits (PRD §3.5, §3.6). Defaults are the CLI defaults."""

    max_input_size: int = GiB
    min_output_size: int = 64 * MiB
    output_factor: int = 4
    regex_timeout_ms: int = 2000
    max_steps: int = 100_000
    max_depth: int = 8

    def output_limit(self, input_size: int) -> int:
        return max(self.output_factor * input_size, self.min_output_size)


class CancelToken:
    """Cooperative cancellation flag (PRD §3.6). Thread-safe; SIGINT sets it."""

    __slots__ = ("_event",)

    def __init__(self) -> None:
        self._event = threading.Event()

    def cancel(self) -> None:
        self._event.set()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set()


class Rng:
    """Random bytes: SHA-256 in counter mode when seeded, else the OS CSPRNG."""

    __slots__ = ("_counter", "_seed")

    def __init__(self, seed: str | None = None) -> None:
        self._seed = bytes.fromhex(seed) if seed is not None else None
        self._counter = 0

    @property
    def seeded(self) -> bool:
        return self._seed is not None

    def random_bytes(self, n: int) -> bytes:
        if self._seed is None:
            return secrets.token_bytes(n)
        out = bytearray()
        while len(out) < n:
            block = self._seed + self._counter.to_bytes(8, "big")
            out += hashlib.sha256(block).digest()
            self._counter += 1
        return bytes(out[:n])


@dataclass(slots=True)
class OpContext:
    """Per-bake state passed to every operation (PRD §3.3)."""

    limits: Limits = field(default_factory=Limits)
    cancel_token: CancelToken = field(default_factory=CancelToken)
    rng: Rng = field(default_factory=Rng)
    warnings: list[RunWarning] = field(default_factory=list)
    path: tuple[PathItem, ...] = ()
    nested: "NestedRunner | None" = None

    def run_nested(self, steps: list[Step], dish: Dish, *suffix: PathItem) -> Dish:
        """Run a nested step list (flow ops). ``suffix`` extends the error path."""
        if self.nested is None:
            raise UniChefError("E_INTERNAL", "Nested steps need a runner; please report this.")
        return self.nested(steps, dish, (*self.path, *suffix))

    def warn(self, code: WarningCode, detail: str) -> None:
        self.warnings.append(RunWarning(code, detail, self.path))

    def cancelled(self) -> bool:
        return self.cancel_token.cancelled

    def check(self) -> None:
        """Raise ``E_CANCELLED`` if the run was cancelled. Call at least every 64 KiB."""
        if self.cancel_token.cancelled:
            raise UniChefError("E_CANCELLED", "The run was cancelled.")


# ---------------------------------------------------------------------------
# Operations

type RunFn = Callable[[Any, Args, OpContext], Any]


@dataclass(slots=True, frozen=True)
class Example:
    """``input`` is read as a string dish; ``output`` is the result as the web playground
    shows it (bytes as UTF-8 when valid, otherwise spaced hex; code points as ``U+XXXX``)."""

    input: str
    args: Mapping[str, JsonValue]
    output: str


@dataclass(slots=True, frozen=True)
class Operation:
    """An operation definition. ``run`` receives the input already coerced."""

    id: str
    name: str
    category: Category
    description: str
    input_type: DishType
    output_type: DishType
    args: tuple[ArgSpec, ...]
    run: RunFn
    parity: ParityClass = "exact"
    examples: tuple[Example, ...] = ()
    flow: bool = False

    def arg(self, name: str) -> ArgSpec | None:
        for spec in self.args:
            if spec.name == name:
                return spec
        return None


REGISTRY: dict[str, Operation] = {}


def register(op: Operation) -> Operation:
    if op.id in REGISTRY:
        raise ValueError(f"duplicate operation id {op.id}")
    REGISTRY[op.id] = op
    return op


def operation(  # noqa: PLR0917  # positional order mirrors Operation's fields
    op_id: str,
    name: str,
    category: Category,
    input_type: DishType,
    output_type: DishType,
    args: tuple[ArgSpec, ...] = (),
    *,
    description: str = "",
    parity: ParityClass = "exact",
    examples: tuple[Example, ...] = (),
) -> Callable[[RunFn], RunFn]:
    """Decorator that registers ``fn`` as the ``run`` of a new operation."""

    def wrap(fn: RunFn) -> RunFn:
        doc = description or (fn.__doc__ or "").strip()
        register(
            Operation(
                op_id, name, category, doc, input_type, output_type, args, fn, parity, examples
            )
        )
        return fn

    return wrap


def get_operation(op_id: str) -> Operation:
    load_builtin_ops()
    op = REGISTRY.get(op_id)
    if op is None:
        raise UniChefError("E_OP_UNKNOWN", f"Unknown operation {op_id[:64]!r}.")
    return op


def all_operations() -> list[Operation]:
    load_builtin_ops()
    return sorted(REGISTRY.values(), key=lambda op: op.id)


_loaded = False


def load_builtin_ops() -> None:
    """Import the built-in operation modules once, which registers them."""
    global _loaded  # noqa: PLW0603 (one-time import guard)
    if _loaded:
        return
    _loaded = True
    from unichef.core import ops  # noqa: PLC0415 (lazy: ops import the registry)

    ops.load()
