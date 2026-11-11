<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Sort lines

Stable sort of the lines. `code-point` compares code points; `case-insensitive` compares full case folds; `numeric` compares a leading decimal number, with lines that have none after the rest; `length` counts code points. `descending` reverses the order of the keys, keeping equal lines in input order.

| Id | Input | Output | Background |
|---|---|---|---|
| `sort-lines` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Sort Lines orders the lines of the input. The sort is *stable*: lines with equal keys keep
their input order.

| `key` | Compares | `b`, `B`, `a`, `10`, `9` becomes |
|---|---|---|
| `code-point` | code points (digits before upper case before lower case) | `10`, `9`, `B`, `a`, `b` |
| `case-insensitive` | full case folds | `10`, `9`, `a`, `b`, `B` |
| `numeric` | a leading decimal number; lines without one go last | `9`, `10`, then `b`, `B`, `a` |
| `length` | the number of code points | `b`, `B`, `a`, `9`, `10` |

**Worked example.** With `key=numeric`, `10 apples`, `9 pears`, `fig`, `-2 kiwis` becomes
`-2 kiwis`, `9 pears`, `10 apples`, `fig`: a sign counts, and `fig` has no number.

`order=descending` reverses the order of the keys while equal lines stay in input order.
Code-point order is not dictionary order for most languages (`é` sorts after `z`); it is
predictable and the same everywhere.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `key` | choice | `code-point` | `code-point`, `case-insensitive`, `numeric`, `length` |
| `order` | choice | `ascending` | `ascending`, `descending` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `pear\napple\nÉclair\nbanana` | — | `apple\nbanana\npear\nÉclair` |
| `10 apples\n9 pears\n100 plums` | `key=numeric` | `9 pears\n10 apples\n100 plums` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzi8q0c3JzEstVtJRSixKB0pV19bG1gIA&i=K0hNLOJKLCjISeU63Jmck5hZxJWUmAeEAA), or search for "Sort lines" in the operation list.

**CLI:**

```sh
unichef op sort-lines
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("sort-lines", {}, Dish.of_string("pear\napple\nÉclair\nbanana"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("sort-lines", {}, { type: 'string', value: "pear\napple\nÉclair\nbanana" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Unicode Collation Algorithm (UTS #10)](https://www.unicode.org/reports/tr10/), for language-aware sorting
- [Sorting algorithm: stability](https://en.wikipedia.org/wiki/Sorting_algorithm#Stability)
- Related: [Unique Lines](unique-lines.md), [Unicode Case](unicode-case.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Reverse](reverse.md) · [Contents](../../README.md) · [Split →](split.md)
<!-- /docs:nav -->
