<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base45

Encode bytes as Base45 (RFC 9285), the QR-code encoding: 2 bytes become 3 characters.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base45` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Base45 (RFC 9285) takes the input **two bytes at a time** and writes each pair as **three
characters** from a 45-character alphabet: `0–9`, `A–Z`, then space and `$%*+-./:`. These
are exactly the characters of a QR code's alphanumeric mode, so Base45 text packs into a QR
code more tightly than Base64 does.

**Worked example: `AB`**

1. The bytes `41 42` are the number 0x4142 = 16 706.
2. Write it in base 45: 16 706 = 11 + 11 × 45 + 8 × 45². The digits are 11, 11, 8, the
   **least significant first**.
3. Each digit picks a character: 11 is `B`, 8 is `8`.

Result: `BB8`.

A final single byte is written as **two** characters (value = c + d × 45). Three characters
can hold up to 91 124, more than two bytes need, so the output is always 1.5 times the input
and some character groups are not valid. There is no padding.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `AB` | — | `BB8` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixONTFV0lFKLEoHylTX1sbWAgA&i=c3QCAA), or search for "To Base45" in the operation list.

**CLI:**

```sh
unichef op to-base45 AB
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base45", {}, Dish.of_string("AB"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base45", {}, { type: 'string', value: "AB" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 9285: the Base45 data encoding](https://www.rfc-editor.org/rfc/rfc9285)
- [QR code alphanumeric mode (Wikipedia)](https://en.wikipedia.org/wiki/QR_code#Information_capacity)
- Related: [From Base45](from-base45.md), [To Base64](to-base64.md)

<!-- docs:nav -->
---

[← To Base32](to-base32.md) · [Contents](../../README.md) · [To Base58 →](to-base58.md)
<!-- /docs:nav -->
