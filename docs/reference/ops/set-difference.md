<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Set Difference

Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. Write the items of the first sample that are not in the second, once, in their order.

| Id | Input | Output | Background |
|---|---|---|---|
| `set-difference` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into two samples at `sample_delimiter` (a blank line by default), and each
sample into items at `item_delimiter`. Each sample is a set: an item that appears twice
counts once, and items are compared exactly, so `Bob` and `bob` differ.

The result is the items of the first sample that do not occur in the second. Swap the samples to
get the other direction.

**Worked example:** an export lists `ann,bo,cy` and the directory lists `bo,cy,dee`. The
difference is `ann`: the one account missing from the directory.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `sample_delimiter` | string | `\n\n` | — |
| `item_delimiter` | string | `,` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `1,2,3\n\n3,4` | — | `1,2` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqTi3RTclMS0stSs1LTlXSUUosSgdKV9fWxtYCAA&i=M9Qx0jHm4jLWMQEA), or search for "Set Difference" in the operation list.

**CLI:**

```sh
unichef op set-difference
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("set-difference", {}, Dish.of_string("1,2,3\n\n3,4"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("set-difference", {}, { type: 'string', value: "1,2,3\n\n3,4" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Set operations on Wikipedia](https://en.wikipedia.org/wiki/Set_(mathematics)#Basic_operations)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Symmetric Difference](symmetric-difference.md), [Set Intersection](set-intersection.md), [Set Union](set-union.md)

<!-- docs:nav -->
---

[← Power Set](power-set.md) · [Contents](../../README.md) · [Set Intersection →](set-intersection.md)
<!-- /docs:nav -->
