# SPDX-License-Identifier: GPL-3.0-or-later
"""Error and warning codes shared with the TypeScript core (PRD §3.7, spec/errors.json)."""

from dataclasses import dataclass, field
from typing import Literal

type ErrorCode = Literal[
    "E_USAGE",
    "E_INPUT_IO",
    "E_INPUT_TYPE",
    "E_ARG_INVALID",
    "E_DECODE",
    "E_CRYPTO",
    "E_REGEX_UNSUPPORTED",
    "E_REGEX_TIMEOUT",
    "E_LIMIT",
    "E_RECIPE_SCHEMA",
    "E_OP_UNKNOWN",
    "E_CANCELLED",
    "E_SCAN_FINDINGS",
    "E_INTERNAL",
]

type WarningCode = Literal["W_DUPLICATE_KEY", "W_JUMP_LIMIT", "W_INSECURE"]

type PathItem = int | str
"""An error path: step indexes, with ``"branch", n`` pairs for nested recipes (PRD §3.5)."""

EXIT_CODES: dict[ErrorCode, int] = {
    "E_USAGE": 2,
    "E_INPUT_IO": 3,
    "E_INPUT_TYPE": 1,
    "E_ARG_INVALID": 1,
    "E_DECODE": 1,
    "E_CRYPTO": 1,
    "E_REGEX_UNSUPPORTED": 1,
    "E_REGEX_TIMEOUT": 5,
    "E_LIMIT": 1,
    "E_RECIPE_SCHEMA": 4,
    "E_OP_UNKNOWN": 4,
    "E_CANCELLED": 130,
    "E_SCAN_FINDINGS": 6,
    "E_INTERNAL": 70,
}

WARNING_CODES: tuple[WarningCode, ...] = ("W_DUPLICATE_KEY", "W_JUMP_LIMIT", "W_INSECURE")

MAX_QUOTED_BYTES = 64


def quote_input(text: str) -> str:
    """Quote user input for a message, keeping at most 64 UTF-8 bytes of it (PRD §3.7)."""
    out: list[str] = []
    used = 0
    for ch in text:
        size = 1 if ch < "\x80" else 2 if ch < "ࠀ" else 3 if ch < "\U00010000" else 4
        if used + size > MAX_QUOTED_BYTES:
            return repr("".join(out)) + "…"
        out.append(ch)
        used += size
    return repr(text)


class UniChefError(Exception):
    """The only exception an operation raises. The CLI maps ``code`` to an exit code."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        path: list[PathItem] | None = None,
        detail: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message)
        self.code: ErrorCode = code
        self.message = message
        self.path: list[PathItem] = list(path) if path else []
        self.detail = detail

    @property
    def exit_code(self) -> int:
        return EXIT_CODES[self.code]

    def with_prefix(self, *prefix: PathItem) -> "UniChefError":
        """Prepend ``prefix`` to the error path, as an error leaves a nested recipe."""
        self.path = [*prefix, *self.path]
        return self

    def to_json(self) -> dict[str, object]:
        out: dict[str, object] = {"code": self.code, "message": self.message}
        if self.path:
            out["path"] = "/".join(str(p) for p in self.path)
        if self.detail is not None:
            out["detail"] = self.detail
        return out


@dataclass(slots=True, frozen=True)
class RunWarning:
    """A non-fatal finding raised during a bake (spec/errors.json ``warnings``)."""

    code: WarningCode
    message: str
    path: tuple[PathItem, ...] = field(default=())

    def to_json(self) -> dict[str, object]:
        out: dict[str, object] = {"code": self.code, "message": self.message}
        if self.path:
            out["path"] = "/".join(str(p) for p in self.path)
        return out
