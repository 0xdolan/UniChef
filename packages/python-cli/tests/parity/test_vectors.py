# SPDX-License-Identifier: GPL-3.0-or-later
"""Run every shared vector in spec/vectors (PRD §3.9, FR-010)."""

from typing import Any

import pytest

from conftest import VECTORS, dish_from_vector, load_json, vector_files
from unichef.core.errors import UniChefError
from unichef.core.recipe import parse_recipe
from unichef.core.registry import all_operations
from unichef.core.runner import bake, run_operation

pytestmark = pytest.mark.parity


def _cases() -> list[Any]:
    params = []
    for path in vector_files():
        doc = load_json(path)
        for case in doc["cases"]:
            label = f"{path.parent.name}/{path.stem}::{case['name']}"
            params.append(pytest.param(doc, case, id=label))
    return params


def _run(doc: dict[str, Any], case: dict[str, Any]) -> tuple[Any, list[str]]:
    dish = dish_from_vector(case["input"])
    if "op" in doc:
        result = run_operation(doc["op"], case.get("args", {}), dish)
    else:
        result = bake(parse_recipe(doc["recipe"]), dish)
    return result.dish, [w.code for w in result.warnings]


@pytest.mark.parametrize(("doc", "case"), _cases())
def test_vector(doc: dict[str, Any], case: dict[str, Any]) -> None:
    expected = case["expected"]
    if "error" in expected:
        with pytest.raises(UniChefError) as info:
            _run(doc, case)
        assert info.value.code == expected["error"], info.value.message
        return
    dish, warnings = _run(doc, case)
    assert dish == dish_from_vector(expected)
    assert warnings == case.get("warnings", [])


def test_vector_files_exist() -> None:
    assert vector_files(), f"no vectors under {VECTORS}"


def test_every_operation_has_vectors() -> None:
    """Each registered operation is exercised by an op vector file or a recipe vector."""
    covered: set[str] = set()

    def walk(steps: list[dict[str, Any]]) -> None:
        for step in steps:
            covered.add(step["op"])
            nested = step.get("args", {}).get("steps")
            if isinstance(nested, list):
                walk(nested)

    for path in vector_files():
        doc = load_json(path)
        if "op" in doc:
            covered.add(doc["op"])
            assert path.stem == doc["op"], f"{path.name} must be named after its op"
        else:
            walk(doc["recipe"]["steps"])
    missing = sorted(op.id for op in all_operations() if op.id not in covered)
    assert not missing, f"operations without vectors: {missing}"


def test_exact_ops_have_eight_cases() -> None:
    for op in all_operations():
        path = VECTORS / op.category.lower() / f"{op.id}.json"
        if op.parity == "exact" and path.exists():
            cases = load_json(path)["cases"]
            assert len(cases) >= 8, f"{op.id} has {len(cases)} cases"
            assert any("error" in c["expected"] for c in cases), f"{op.id} has no error case"
