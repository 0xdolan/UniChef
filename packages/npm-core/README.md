# @unichef/core

The UniChef core for JavaScript and TypeScript: Unicode character analysis and deterministic data-transformation recipes, for Node.js 22+ and browsers.

UniChef computes every Unicode result from its own copy of the Unicode Character Database, so the output does not depend on the JavaScript engine that runs it. It produces the same results as the Python core, checked against shared test vectors.

## Development

```sh
pnpm install
pnpm --filter @unichef/core test
pnpm --filter @unichef/core typecheck
pnpm --filter @unichef/core build
```

See the repository [README](https://github.com/0xdolan/unichef#readme) for the full documentation.

License: GPL-3.0-or-later.
