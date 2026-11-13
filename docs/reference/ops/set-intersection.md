<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Set Intersection

Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. Write the items that are in both samples, once, in the order of the first sample.

| Id | Input | Output | Background |
|---|---|---|---|
| `set-intersection` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into two samples at `sample_delimiter` (a blank line by default), and each
sample into items at `item_delimiter`. Each sample is a set: an item that appears twice
counts once, and items are compared exactly, so `Bob` and `bob` differ.

The result is the items of the first sample that also occur in the second, in the order of the
first sample.

**Worked example:** `c,a,b` and `b,c,d` share `c` and `b`. The output is `c,b`: the order comes
from the first sample.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `sample_delimiter` | string | `\n\n` | — |
| `item_delimiter` | string | `,` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `1,2,3\n\n3,2,4` | — | `2,3` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqTi3RzcwrASpITS4BqdFRSixKByqorq2NrQUA&i=M9Qx0jHm4jIGUiYA), or search for "Set Intersection" in the operation list.

**CLI:**

```sh
unichef op set-intersection
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("set-intersection", {}, Dish.of_string("1,2,3\n\n3,2,4"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("set-intersection", {}, { type: 'string', value: "1,2,3\n\n3,2,4" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Set operations on Wikipedia](https://en.wikipedia.org/wiki/Set_(mathematics)#Basic_operations)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Set Union](set-union.md), [Set Difference](set-difference.md), [Symmetric Difference](symmetric-difference.md)

<!-- docs:nav -->
---

[← Set Difference](set-difference.md) · [Contents](../../README.md) · [Set Union →](set-union.md)
<!-- /docs:nav -->
