<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Citrix CTX1 Decode

Reverse Citrix CTX1: read pairs of letters from `A` to `P` as bytes, XOR each with 0xA5 and the byte before it, and read the result as UTF-16LE. ASCII whitespace around the input is ignored.

| Id | Input | Output | Background |
|---|---|---|---|
| `citrix-ctx1-decode` | string | string | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

ASCII whitespace around the input is ignored. Each pair of letters from `A` to `P` is a byte
(high half, then low half). Each byte is XORed with 0xA5 and with the byte before it, and the
result is read as UTF-16LE. The input must be a multiple of 4 letters, and the result must be
valid UTF-16.

**Worked example: `NFHA`**

| Letters | Byte | XOR 0xA5 XOR previous |
|---|---|---|
| `NF` | 0xD5 | 0xD5 ⊕ 0xA5 ⊕ 0x00 = 0x70 |
| `HA` | 0x70 | 0x70 ⊕ 0xA5 ⊕ 0xD5 = 0x00 |

The bytes 70 00 are UTF-16LE for `p`. All of `NFHALEBBMHGCLEBB` decodes to `pass`.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `NFHALEBBMHGCLEBB` | — | `pass` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKziwpyqzQTS6pMNRNSU3OT0lV0lFKLEoHKqmurY2tBQA&i=83PzcPRxdXLy9XB3BtEA), or search for "Citrix CTX1 Decode" in the operation list.

**CLI:**

```sh
unichef op citrix-ctx1-decode NFHALEBBMHGCLEBB
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("citrix-ctx1-decode", {}, Dish.of_string("NFHALEBBMHGCLEBB"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("citrix-ctx1-decode", {}, { type: 'string', value: "NFHALEBBMHGCLEBB" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [XOR cipher on Wikipedia](https://en.wikipedia.org/wiki/XOR_cipher)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [Citrix CTX1 Encode](citrix-ctx1-encode.md)

<!-- docs:nav -->
---

[← Caret/M-decode](caret-m-decode.md) · [Contents](../../README.md) · [Citrix CTX1 Encode →](citrix-ctx1-encode.md)
<!-- /docs:nav -->
