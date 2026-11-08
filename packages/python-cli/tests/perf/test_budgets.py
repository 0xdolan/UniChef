# SPDX-License-Identifier: GPL-3.0-or-later
"""CLI performance budgets (PRD §13.1). Run with `make perf`, without coverage.

Each budget is checked against the median of a few runs after a warm-up run, so one slow
run on a shared CI machine does not fail the job.
"""

import statistics
import time
from collections.abc import Callable

import pytest

from unichef.core.dish import Dish
from unichef.core.recipe import parse_recipe
from unichef.core.runner import bake
from unichef.unicode.query import query

pytestmark = pytest.mark.perf

RUNS = 3
MIB = 1024 * 1024


def median_ms(fn: Callable[[], object]) -> float:
    fn()
    runs = []
    for _ in range(RUNS):
        started = time.perf_counter()
        fn()
        runs.append((time.perf_counter() - started) * 1000)
    return statistics.median(runs)


def test_nfr_002_base64_round_trip_and_sha256_on_10_mib() -> None:
    text = "UniChef ☕ ".ljust(64, "x") * (10 * MIB // 64)
    recipe = parse_recipe(
        {
            "version": 1,
            "steps": [
                {"op": "to-base64"},
                {"op": "from-base64"},
                {"op": "sha2", "args": {"size": "256"}},
            ],
        }
    )
    assert median_ms(lambda: bake(recipe, Dish("string", text))) <= 1500


@pytest.mark.parametrize("text", ["name~/WITH/", "name~/ARROW$/"])
def test_nfr_004_query_over_all_named_code_points(text: str) -> None:
    assert query(text).total > 0
    assert median_ms(lambda: query(text)) <= 400
