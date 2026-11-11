# SPDX-License-Identifier: GPL-3.0-or-later
"""Every operation's examples run and give their stated output (FR-030, PRD §3.3)."""

import pytest

from unichef.core.dish import Dish, coerce
from unichef.core.recipe import JUMP_OPS
from unichef.core.registry import Operation, all_operations
from unichef.core.runner import run_operation

BINARY_INPUT = {"gunzip"}


def example_text(dish: Dish) -> str:
    """The output as the web playground shows it: bytes as UTF-8 when valid, otherwise hex."""
    if dish.type == "bytes":
        data = bytes(dish.value)  # type: ignore[arg-type]
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError:
            return data.hex(" ")
    if dish.type == "codepoints":
        return " ".join(f"U+{cp:04X}" for cp in dish.value)  # type: ignore[union-attr]
    return str(coerce(dish, "string").value)


@pytest.mark.parametrize("op", all_operations(), ids=lambda op: op.id)
def test_examples(op: Operation) -> None:
    # A jump needs a label in the same step list, so it cannot run as a one-step example,
    # a random op has no fixed output to state (seeded recipe vectors cover it), and gzip
    # data starts with 1F 8B, which no text encodes to in UTF-8 (vectors cover it).
    exempt = op.id in JUMP_OPS or op.parity == "nondeterministic" or op.id in BINARY_INPUT
    assert bool(op.examples) != exempt
    for example in op.examples:
        result = run_operation(op.id, dict(example.args), Dish("string", example.input))
        assert example_text(result.dish) == example.output
