# SPDX-License-Identifier: GPL-3.0-or-later
"""Every reference page's web app link opens its example and gives the stated output (FR-013)."""

import base64
import json
import re
import zlib
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from test_examples import example_text

from unichef.core.dish import Dish
from unichef.core.recipe import parse_recipe
from unichef.core.registry import Operation, all_operations
from unichef.core.runner import bake

OPS_DIR = Path(__file__).resolve().parents[4] / "docs/reference/ops"
LINK = re.compile(r"\[open this example in UniChef\]\(([^)]+)\)")


def unpack(field: str) -> str:
    """Undo the share-link packing: URL-safe Base64 of raw DEFLATE of UTF-8."""
    raw = base64.urlsafe_b64decode(field + "=" * (-len(field) % 4))
    return zlib.decompress(raw, -15).decode("utf-8")


@pytest.mark.parametrize("op", [op for op in all_operations() if op.examples], ids=lambda op: op.id)
def test_fr_013_docs_link_runs_example(op: Operation) -> None:
    """FR-013: the page's link decodes to a valid recipe whose output is the first example's."""
    page = (OPS_DIR / f"{op.id}.md").read_text("utf-8")
    links = LINK.findall(page)
    assert len(links) == 1, f"{op.id}.md must have one example link"
    query = parse_qs(urlsplit(links[0]).fragment.partition("?")[2], keep_blank_values=True)
    recipe = parse_recipe(json.loads(unpack(query["r"][0])))
    text = unpack(query["i"][0]) if "i" in query else ""
    example = op.examples[0]
    assert text == example.input
    assert example_text(bake(recipe, Dish("string", text)).dish) == example.output
