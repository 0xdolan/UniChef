<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Set Union

Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. Write every item that is in either sample, once, in the order first seen.

| Id | Input | Output | Background |
|---|---|---|---|
| `set-union` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into two samples at `sample_delimiter` (a blank line by default), and each
sample into items at `item_delimiter`. Each sample is a set: an item that appears twice
counts once, and items are compared exactly, so `Bob` and `bob` differ.

The result is every item of the first sample, then the items of the second that were not
already listed, joined by `item_delimiter`.

**Worked example**

| Sample | Items |
|---|---|
| First | `1`, `2`, `3` |
| Second | `3`, `4` |
| Union | `1`, `2`, `3`, `4` |

Output: `1,2,3,4`. Exactly two samples are needed; one or three is an error.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `sample_delimiter` | string | `\n\n` | — |
| `item_delimiter` | string | `,` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `1,2,3\n\n3,4` | — | `1,2,3,4` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqTi3RLc0DSeooJRalA2Wqa2tjawE&i=M9Qx0jHm4jLWMQEA), or search for "Set Union" in the operation list.

**CLI:**

```sh
unichef op set-union
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("set-union", {}, Dish.of_string("1,2,3\n\n3,4"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("set-union", {}, { type: 'string', value: "1,2,3\n\n3,4" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Set operations on Wikipedia](https://en.wikipedia.org/wiki/Set_(mathematics)#Basic_operations)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Set Intersection](set-intersection.md), [Set Difference](set-difference.md), [Symmetric Difference](symmetric-difference.md)

<!-- docs:nav -->
---

[← Set Intersection](set-intersection.md) · [Contents](../../README.md) · [Symmetric Difference →](symmetric-difference.md)
<!-- /docs:nav -->
