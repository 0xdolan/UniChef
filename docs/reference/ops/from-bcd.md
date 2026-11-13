<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From BCD

Read binary-coded decimal back into a decimal integer. The input is binary digits (`nibbles` or `bytes`, spaces ignored) or one character per byte (`raw`). With `signed`, the last nibble is the sign: 1101 or 1011 is minus.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-bcd` | string | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

The input is read as nibbles: binary digits in groups of four (spaces and line breaks are
ignored), or with `format=raw` two nibbles from each character. Use the same `scheme`,
`packed` and `signed` settings the data was written with.

1. Without `packed`, every byte holds one digit, so the high nibble of each byte is dropped.
2. With `signed`, the last nibble is the sign: `1101` or `1011` means minus, anything else plus.
3. Each remaining nibble is looked up in the scheme. A nibble that is no digit there, such as
   `1010` in `8421`, is an error.
4. Leading zeros are removed.

**Worked example: `00010010 00111101`, `signed`, `format=bytes`**

| Nibble | `0001` | `0010` | `0011` | `1101` |
|---|---|---|---|---|
| Meaning | 1 | 2 | 3 | minus |

Result: `-123`.

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
| `0001 0010 0011 0100` | — | `1234` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KTlHSUUosSgdKVNfWxtYCAA&i=MzAwMFQAYgMQAWQZGhgAAA), or search for "From BCD" in the operation list.

**CLI:**

```sh
unichef op from-bcd '0001 0010 0011 0100'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-bcd", {}, Dish.of_string("0001 0010 0011 0100"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-bcd", {}, { type: 'string', value: "0001 0010 0011 0100" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Binary-coded decimal on Wikipedia](https://en.wikipedia.org/wiki/Binary-coded_decimal)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [To BCD](to-bcd.md), [From Binary](from-binary.md), [From Base](from-base.md)

<!-- docs:nav -->
---

[← From Base92](from-base92.md) · [Contents](../../README.md) · [From Bech32 →](from-bech32.md)
<!-- /docs:nav -->
