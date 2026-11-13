<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Cartesian Product

Split the input on `sample_delimiter` into two or more samples and each sample on `item_delimiter` into items. Write every tuple that takes one item from each sample, as `(x,y)` with a comma inside, joined by `item_delimiter`. The last sample varies fastest. At most 100000 tuples.

| Id | Input | Output | Background |
|---|---|---|---|
| `cartesian-product` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into two or more samples at `sample_delimiter`, and each sample into items at
`item_delimiter`; repeated items in a sample count once. The result has one tuple for each way of
taking one item from every sample, written `(x,y)` with a comma inside and joined by
`item_delimiter`.

Tuples come in odometer order: the last sample turns fastest.

**Worked example:** `1,2`, `a` and `x,y` give

| # | Tuple |
|---|---|
| 1 | `(1,a,x)` |
| 2 | `(1,a,y)` |
| 3 | `(2,a,x)` |
| 4 | `(2,a,y)` |

The number of tuples is the product of the sample sizes (2 × 1 × 2 = 4). Above 100000 tuples
the operation stops with a limit error.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `sample_delimiter` | string | `\n\n` | — |
| `item_delimiter` | string | `,` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `1,2\n\na,b` | — | `(1,a),(1,b),(2,a),(2,b)` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKTiwqSS3OTMzTLSjKTylNLlHSUUosSgeqqK6tja0FAA&i=M9Qx4uJK1EkCAA), or search for "Cartesian Product" in the operation list.

**CLI:**

```sh
unichef op cartesian-product
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("cartesian-product", {}, Dish.of_string("1,2\n\na,b"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("cartesian-product", {}, { type: 'string', value: "1,2\n\na,b" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Cartesian product on Wikipedia](https://en.wikipedia.org/wiki/Cartesian_product)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Power Set](power-set.md), [Set Union](set-union.md)

<!-- docs:nav -->
---

[← Zlib Inflate](zlib-inflate.md) · [Contents](../../README.md) · [CSV to JSON →](csv-to-json.md)
<!-- /docs:nav -->
