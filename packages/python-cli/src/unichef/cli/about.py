# SPDX-License-Identifier: GPL-3.0-or-later
"""Version strings. Kept free of heavy imports so ``unichef version`` starts fast (PRD §5.8)."""

import re
import sys

from unichef import __version__
from unichef.unicode.version import UCD_VERSION

_PEP440 = re.compile(r"(\d+\.\d+\.\d+)(?:(a|b|rc)(\d+))?")
_PRE = {"a": "alpha", "b": "beta", "rc": "rc"}


def semver(version: str = __version__) -> str:
    """``0.1.0a1`` (PEP 440, as Python packages spell it) -> ``0.1.0-alpha.1``."""
    found = _PEP440.fullmatch(version)
    if found is None:
        return version
    core, pre, number = found.groups()
    return core if pre is None else f"{core}-{_PRE[pre]}.{number}"


def version_line() -> str:
    return f"unichef {semver()} (UCD {UCD_VERSION}, Python {sys.version.split()[0]})"
