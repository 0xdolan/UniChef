<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base

Write a decimal number in a radix from 2 to 36 with lower-case digits. A fraction gets at most 20 digits, rounded half up.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base` | string | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

`to-base` reads a decimal number and writes it in any radix from 2 to 36, using the digits
`0–9` then `a–z`. It works on text, not on a fixed-width integer, so numbers of any size (up to
4000 digits) convert exactly.

**Worked example: 255 in base 16**

1. 255 ÷ 16 = 15 remainder **15**, which is the digit `f`.
2. 15 ÷ 16 = 0 remainder **15**, again `f`.
3. Read the remainders from last to first: `ff`.

A fraction is converted by repeated multiplication: 0.5 × 2 = **1**.0, so 10.5 in base 2 is
`1010.1`. A fraction that never ends in the new base (0.1 in base 2) is cut to 20 digits and
rounded half up. A leading `-` is kept; `-0` becomes `0`. Whitespace in the input is ignored.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `radix` | integer 2 to 36 | `36` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `255` | `radix=16` | `ff` |
| `10.5` | `radix=2` | `1010.1` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixOVdJRSixKB4pXKxUlpmRWAJWa1dbG1gIA&i=MzI1BQA), or search for "To Base" in the operation list.

**CLI:**

```sh
unichef op to-base --arg radix=16 255
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base", {"radix": 16}, Dish.of_string("255"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base", {"radix": 16}, { type: 'string', value: "255" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Radix (Wikipedia)](https://en.wikipedia.org/wiki/Radix)
- [Positional notation (Wikipedia)](https://en.wikipedia.org/wiki/Positional_notation)
- Related: [From Base](from-base.md), [To Hex](to-hex.md), [To Binary](to-binary.md)

<!-- docs:nav -->
---

[← Text-Integer Conversion](text-integer.md) · [Contents](../../README.md) · [To Base32 →](to-base32.md)
<!-- /docs:nav -->
