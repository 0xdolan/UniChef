<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Get all casings

Every combination of upper and lower case, one per line. The input is lower-cased, then line k upper-cases the code points whose bit is set in k (the first code point is bit 0). At most 16 code points.

| Id | Input | Output | Background |
|---|---|---|---|
| `get-all-casings` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`get-all-casings` lists every way to write the input in upper and lower case. It lower-cases
the input, then counts from 0 to 2ⁿ − 1, where n is the number of code points. In line k,
code point j is upper-cased when bit j of k is set.

**Worked example: `ab`**

| k | Bits (b a) | Line |
|---|---|---|
| 0 | 00 | `ab` |
| 1 | 01 | `Ab` |
| 2 | 10 | `aB` |
| 3 | 11 | `AB` |

Characters without case still use a bit, so `a1` gives `a1`, `A1`, `a1`, `A1`. The output
doubles with each code point, so the input may have at most 16 (65 536 lines).
Use it to build every case variant of a word, for example to test a case-sensitive filter.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `ab` | — | `ab\nAb\naB\nAB` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKTy3RTczJ0U1OLM7MSy9W0lFKLAJSVtW1tbG1AA&i=S0wCAA), or search for "Get all casings" in the operation list.

**CLI:**

```sh
unichef op get-all-casings ab
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("get-all-casings", {}, Dish.of_string("ab"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("get-all-casings", {}, { type: 'string', value: "ab" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Power set (Wikipedia)](https://en.wikipedia.org/wiki/Power_set)
- [Unicode case mapping FAQ](https://www.unicode.org/faq/casemap_charprop.html)
- Related: [Swap case](swap-case.md)

<!-- docs:nav -->
---

[← Find / replace](find-replace.md) · [Contents](../../README.md) · [Head →](head.md)
<!-- /docs:nav -->
