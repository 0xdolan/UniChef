<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Octal

Read bytes of 1-3 octal digits (at most 377). `auto` splits on runs of whitespace and ,:; and `none` reads groups of exactly three digits.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-octal` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each group of one to three octal digits (`0–7`) becomes one byte: each digit multiplies the
running value by 8 and adds itself. `151` is (1 × 8 + 5) × 8 + 1 = 105, the letter `i`.
Groups above `377` (255) do not fit in a byte and are an error.

With the default `auto` delimiter, groups are separated by runs of whitespace or `,` `:` `;`.
With `none`, the input is read in groups of exactly three digits.

**Worked example.** `110 151` gives 72 and 105, which is `Hi`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `auto` | `auto`, `space`, `comma`, `colon`, `newline`, `none` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `110 151` | — | `Hi` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1c1PLknMUdJRSixKB0pV19bG1gIA&i=MzQ0UDA0NQQA), or search for "From Octal" in the operation list.

**CLI:**

```sh
unichef op from-octal '110 151'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-octal", {}, Dish.of_string("110 151"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-octal", {}, { type: 'string', value: "110 151" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Octal on Wikipedia](https://en.wikipedia.org/wiki/Octal)
- Related: [To Octal](to-octal.md), [From Decimal](from-decimal.md)

<!-- docs:nav -->
---

[← From Morse code](from-morse-code.md) · [Contents](../../README.md) · [From Punycode →](from-punycode.md)
<!-- /docs:nav -->
