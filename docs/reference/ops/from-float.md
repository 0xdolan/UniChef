<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Float

Read decimal numbers separated by `delimiter` and write each as an IEEE 754 `float` (4 bytes) or `double` (8 bytes), rounded to the nearest value. `Infinity`, `-Infinity` and `NaN` are accepted.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-float` | string | bytes | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

The input is split at `delimiter` and each piece is read as a decimal number: an optional
sign, digits with an optional point, and an optional exponent such as `e-3`. `Infinity`,
`-Infinity` and `NaN` are accepted too. Anything else, including an empty piece or a hex
number, is an error.

Each number is rounded to the nearest value the chosen size can hold (ties go to the even
fraction) and written as 4 or 8 bytes. A number too large for the size becomes infinity, and
one too small becomes zero. `NaN` is always written as the quiet NaN `7f c0 00 00` or
`7f f8 00 00 00 00 00 00`.

**Worked example: `0.5 0.5`**

0.5 is 1.0 × 2^−1: sign 0, exponent 127 − 1 = 126 (`01111110`), fraction 0. As a big-endian
float that is `3f 00 00 00`, so the output is the eight bytes `3f 00 00 00 3f 00 00 00`. With
`endianness=little` each group is reversed: `00 00 00 3f 00 00 00 3f`.

Most decimal fractions have no exact binary form: `0.1` as a float reads back as
`0.10000000149011612`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `endianness` | choice | `big` | `big`, `little` |
| `size` | choice | `float` | `float`, `double` |
| `delimiter` | choice | `space` | `space`, `comma`, `semicolon`, `colon`, `newline`, `crlf` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `12.141422271728516` | — | `ABCD` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U3LyU8sUdJRSixKB0pV19bG1gIA&i=MzTSMzQxNDEyMjI3NDeyMDU0AwA), or search for "From Float" in the operation list.

**CLI:**

```sh
unichef op from-float 12.141422271728516
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-float", {}, Dish.of_string("12.141422271728516"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-float", {}, { type: 'string', value: "12.141422271728516" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [IEEE 754 on Wikipedia](https://en.wikipedia.org/wiki/IEEE_754)
- [What Every Computer Scientist Should Know About Floating-Point Arithmetic](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [To Float](to-float.md), [From Hex](from-hex.md)

<!-- docs:nav -->
---

[← From Decimal](from-decimal.md) · [Contents](../../README.md) · [From Hex →](from-hex.md)
<!-- /docs:nav -->
