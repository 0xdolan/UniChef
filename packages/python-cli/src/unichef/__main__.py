# SPDX-License-Identifier: GPL-3.0-or-later
"""``python -m unichef`` and the ``unichef`` console script."""

import sys
from collections.abc import Sequence

_PLAIN_VERSION = (["version"], ["--version"])


def fast_version(argv: Sequence[str]) -> bool:
    """Answer a bare ``unichef version`` without loading Rich or the registry (PRD §5.8:
    cold start). Any other flag takes the normal path."""
    if list(argv) not in _PLAIN_VERSION:
        return False
    from unichef.cli.about import version_line  # noqa: PLC0415

    sys.stdout.buffer.write((version_line() + "\n").encode("utf-8"))
    sys.stdout.flush()
    return True


def main() -> int:
    if fast_version(sys.argv[1:]):
        return 0
    from unichef.cli.main import run  # noqa: PLC0415 - keep ``import unichef`` cheap

    return run()


if __name__ == "__main__":
    sys.exit(main())
