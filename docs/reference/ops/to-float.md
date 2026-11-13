<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Float

Read the bytes as IEEE 754 numbers, 4 bytes each for `float` or 8 for `double`, and write them in decimal joined by `delimiter`. Each number is written with the fewest digits that give the same value back.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-float` | bytes | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

An IEEE 754 number has three fields: a sign bit, an exponent and a fraction. A `float` packs
them into 32 bits (1, 8 and 23) and a `double` into 64 (1, 11 and 52). The value is
`(1 + fraction) × 2^(exponent − bias)`, where the bias is 127 for a float and 1023 for a double.

The input is cut into groups of 4 or 8 bytes; `endianness` says whether the first byte of a
group is the most significant (`big`) or the least (`little`). A length that is not a whole
number of groups is an error.

Each number is written the way JavaScript writes it: the shortest digits that read back as the
same double, with an exponent (`1e+21`, `5e-324`) for very large and very small values. A float
is widened to a double first, so its output shows the exact value the 32 bits hold. The specials
are `Infinity`, `-Infinity`, `NaN` and `-0`.

**Worked example: `ABCD` as a big-endian float**

| Field | Bits | Value |
|---|---|---|
| Bytes | `41 42 43 44` | |
| Sign | `0` | plus |
| Exponent | `10000010` | 130, so 2^(130 − 127) = 8 |
| Fraction | `10000100100001101000100` | 1.5176777839660645 |

8 × 1.5176777839660645 = `12.141422271728516`.

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
| `ABCD` | — | `12.141422271728516` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNy8lPLFHSUUosSgdKVNfWxtYCAA&i=c3RydgEA), or search for "To Float" in the operation list.

**CLI:**

```sh
unichef op to-float ABCD
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-float", {}, Dish.of_string("ABCD"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-float", {}, { type: 'string', value: "ABCD" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [IEEE 754 on Wikipedia](https://en.wikipedia.org/wiki/IEEE_754)
- [Float Toy: flip the bits and watch the value](https://evanw.github.io/float-toy/)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [From Float](from-float.md), [To Hex](to-hex.md), [Swap Endianness](swap-endianness.md)

<!-- docs:nav -->
---

[← To Decimal](to-decimal.md) · [Contents](../../README.md) · [To Hex →](to-hex.md)
<!-- /docs:nav -->
