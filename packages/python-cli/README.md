# unichef (Python)

The UniChef command-line tool and its Python core: a cybersecurity and Unicode workbench for the terminal. It encodes, decodes, hashes, encrypts and compresses data in deterministic recipes, inspects text down to the code point, and catches invisible, bidi and look-alike characters (`unichef scan` blocks Trojan Source in CI).

UniChef computes every Unicode result from its own copy of the Unicode Character Database, so the output does not depend on the Python version that runs it.

## Development

```sh
uv sync --all-groups
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run mypy
```

See the repository [README](https://github.com/0xdolan/unichef#readme) for the full documentation.

License: GPL-3.0-or-later.
