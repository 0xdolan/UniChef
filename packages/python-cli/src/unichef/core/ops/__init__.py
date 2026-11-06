# SPDX-License-Identifier: GPL-3.0-or-later
"""Built-in operations. Importing a module registers its operations."""

import importlib

MODULES = ("flow", "encoding", "text", "html", "unicode")


def load() -> None:
    for name in MODULES:
        importlib.import_module(f"unichef.core.ops.{name}")
