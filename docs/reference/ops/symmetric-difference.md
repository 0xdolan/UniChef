<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Symmetric Difference

Split the input on `sample_delimiter` into two samples and each sample on `item_delimiter` into items. Write the items that are in exactly one sample, once: those of the first sample, then those of the second.

| Id | Input | Output | Background |
|---|---|---|---|
| `symmetric-difference` | string | string | [Sets and distances: comparing lists and strings](../../learn/sets-and-distances.md) |
<!-- /docs:head -->

## How it works

The input is cut into two samples at `sample_delimiter` (a blank line by default), and each
sample into items at `item_delimiter`. Each sample is a set: an item that appears twice
counts once, and items are compared exactly, so `Bob` and `bob` differ.

The result is the items that occur in only one sample: first those only in the first sample,
then those only in the second. It is the union minus the intersection.

**Worked example**

| | First `1,2,3` | Second `3,4` |
|---|---|---|
| Only here | `1`, `2` | `4` |

Output: `1,2,4`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `sample_delimiter` | string | `\n\n` | — |
| `item_delimiter` | string | `,` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `1,2,3\n\n3,4` | — | `1,2,4` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqrszNTS0pykzWTclMS0stSs1LTlXSUUosSgcqqq6tja0FAA&i=M9Qx0jHm4jLWMQEA), or search for "Symmetric Difference" in the operation list.

**CLI:**

```sh
unichef op symmetric-difference
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("symmetric-difference", {}, Dish.of_string("1,2,3\n\n3,4"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("symmetric-difference", {}, { type: 'string', value: "1,2,3\n\n3,4" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Set operations on Wikipedia](https://en.wikipedia.org/wiki/Set_(mathematics)#Basic_operations)
- Guide: [Sets and distances](../../learn/sets-and-distances.md)
- Related: [Set Difference](set-difference.md), [Set Union](set-union.md), [Set Intersection](set-intersection.md)

<!-- docs:nav -->
---

[← Set Union](set-union.md) · [Contents](../../README.md) · [Add line numbers →](add-line-numbers.md)
<!-- /docs:nav -->
