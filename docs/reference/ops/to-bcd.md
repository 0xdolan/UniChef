<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To BCD

Write a decimal integer as binary-coded decimal: four bits per digit in the chosen `scheme`. `packed` puts two digits in a byte, `signed` adds a sign nibble (1100 plus, 1101 minus) at the end, and `format` shows nibbles, bytes or one character per byte.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-bcd` | string | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

Binary-coded decimal keeps the decimal digits and codes each one in four bits, instead of
converting the whole number to binary. It is used where digits must survive exactly: money,
clocks, displays and mainframe data.

`scheme` names the weight of each bit. In `8421` the code is the digit in binary. The other
schemes give the bits other weights (`2421`, `84-2-1`), add 3 to the digit (`excess-3`), or
write zero as `1010` (`ibm-8421`).

- `packed` puts two digits in each byte. Without it, each digit gets a byte of its own with a
  zero high nibble.
- `signed` adds a sign nibble at the end: `1100` for plus, `1101` for minus. A packed number
  is given a leading zero when that makes a whole number of bytes.
- `format` shows the result as nibbles, as bytes, or as `raw` text with one character per byte.

**Worked example: `-123`, `signed`, `format=bytes`**

| Digit or sign | `1` | `2` | `3` | minus |
|---|---|---|---|---|
| Nibble | `0001` | `0010` | `0011` | `1101` |

Packed in pairs: `00010010 00111101`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `scheme` | choice | `8421` | `8421`, `7421`, `4221`, `2421`, `84-2-1`, `excess-3`, `ibm-8421` |
| `packed` | boolean | `true` | — |
| `signed` | boolean | `false` | — |
| `format` | choice | `nibbles` | `nibbles`, `bytes`, `raw` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `1234` | — | `0001 0010 0011 0100` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSk5R0lFKLEoHClfX1sbWAgA&i=MzQyNgEA), or search for "To BCD" in the operation list.

**CLI:**

```sh
unichef op to-bcd 1234
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-bcd", {}, Dish.of_string("1234"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-bcd", {}, { type: 'string', value: "1234" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Binary-coded decimal on Wikipedia](https://en.wikipedia.org/wiki/Binary-coded_decimal)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [From BCD](from-bcd.md), [To Binary](to-binary.md), [To Base](to-base.md)

<!-- docs:nav -->
---

[← To Base92](to-base92.md) · [Contents](../../README.md) · [To Bech32 →](to-bech32.md)
<!-- /docs:nav -->
