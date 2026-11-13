<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Add line numbers

Put the line number and a space before each line, counting from `offset` + 1. Numbers are right-aligned to the width of the line count. A final LF is kept.

| Id | Input | Output | Background |
|---|---|---|---|
| `add-line-numbers` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`add-line-numbers` puts a number and a space in front of every line. Numbers start at
`offset` + 1 and are right-aligned to the number of digits in the line count.

**Worked example: ten lines**

The line count is 10, which has two digits, so the numbers are ` 1` to `10`:

```
 1 a
 2 b
…
10 j
```

A final line feed ends the last line rather than starting a new, empty one, as in the other
line operations. The alignment width comes from the line count, not the largest number, so a
large `offset` can make the numbers uneven.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `offset` | integer -9007199254740991 to 9007199254740991 | `0` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `one\ntwo` | — | `1 one\n2 two` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKTEnRzcnMS9XNK81NAipT0lFKLEoHKqiurY2tBQA&i=y89L5SopzwcA), or search for "Add line numbers" in the operation list.

**CLI:**

```sh
unichef op add-line-numbers
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("add-line-numbers", {}, Dish.of_string("one\ntwo"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("add-line-numbers", {}, { type: 'string', value: "one\ntwo" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Line number (Wikipedia)](https://en.wikipedia.org/wiki/Line_number)
- Related: [Remove line numbers](remove-line-numbers.md), [Pad lines](pad-lines.md)

<!-- docs:nav -->
---

[← Symmetric Difference](symmetric-difference.md) · [Contents](../../README.md) · [Alternating caps →](alternating-caps.md)
<!-- /docs:nav -->
