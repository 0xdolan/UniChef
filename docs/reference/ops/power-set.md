<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Power Set

Split the input on `item_delimiter` into items, dropping empty ones and repeats. Write every subset on its own line, items joined by `item_delimiter` and each line ending in a line feed: the empty set first, then smaller subsets before larger ones, and subsets of one size in input order. At most 16 items.

| Id | Input | Output | Background |
|---|---|---|---|
| `power-set` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into items at `item_delimiter`; empty items and repeats are dropped. The result
lists every subset, one per line, with each line ending in a line feed. The empty set comes first
(an empty line), then the one-item subsets, then the two-item subsets and so on. Within one size,
subsets follow the input order.

**Worked example:** `1 2 4` with `item_delimiter` set to a space gives eight lines:

```text

1
2
4
1 2
1 4
2 4
1 2 4
```

*n* items have 2ⁿ subsets, so the input may hold at most 16 items.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `item_delimiter` | string | `,` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `a,b` | — | `\na\nb\na,b\n` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyC9PLdItTi1R0lFKLEoHylTX1sbWAgA&i=S9RJAgA), or search for "Power Set" in the operation list.

**CLI:**

```sh
unichef op power-set a,b
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("power-set", {}, Dish.of_string("a,b"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("power-set", {}, { type: 'string', value: "a,b" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Power set on Wikipedia](https://en.wikipedia.org/wiki/Power_set)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Cartesian Product](cartesian-product.md), [Set Union](set-union.md)

<!-- docs:nav -->
---

[← Parse URL](parse-url.md) · [Contents](../../README.md) · [Set Difference →](set-difference.md)
<!-- /docs:nav -->
