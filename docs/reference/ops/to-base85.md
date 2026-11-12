<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base85

Encode bytes as Ascii85 (`z` for a group of four zero bytes) or Z85.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base85` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Base85 writes every four bytes as five characters. Four bytes are a 32-bit number *n* below
85⁵, so *n* can be written as five base-85 digits.

**Ascii85** (Adobe, btoa) adds 33 to each digit, so the characters run from `!` (0) to `u`
(84). A group of four zero bytes is written as the single character `z`.

**Worked example: `Hell`**

1. The bytes `48 65 6c 6c` are the number 1 214 606 444.
2. In base 85 that is the digits 23, 22, 66, 52, 49 (23 × 85⁴ + 22 × 85³ + 66 × 85² + 52 × 85 + 49).
3. Adding 33 gives the characters `8`, `7`, `c`, `U`, `R`.

A last group of one to three bytes is padded with zero bytes, encoded, and cut to one
character more than the number of bytes. So `Hello` is `87cUR` plus `DZ`: `87cURDZ`.
With `delimiters`, the output is wrapped in `<~` and `~>` as in PostScript and PDF.

**Z85** (ZeroMQ) uses the same arithmetic with a different alphabet that avoids quotes,
backslash and other characters that need escaping in source code, and has no `z`
abbreviation. `Hello` is `nm=QNzV` in Z85.

Base85 is 25% larger than the input, against 33% for Base64. You meet it in PDF streams
(`/ASCII85Decode`), Git binary patches and IPv6 address puzzles (RFC 1924, a joke RFC).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `ascii85` | `ascii85`, `z85` |
| `delimiters` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello` | — | `87cURDZ` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixOtTBV0lFKLEoHylTX1sbWAgA&i=80jNyckHAA), or search for "To Base85" in the operation list.

**CLI:**

```sh
unichef op to-base85 Hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base85", {}, Dish.of_string("Hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base85", {}, { type: 'string', value: "Hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Ascii85 on Wikipedia](https://en.wikipedia.org/wiki/Ascii85)
- [ZeroMQ RFC 32: Z85](https://rfc.zeromq.org/spec/32/)
- Related: [From Base85](from-base85.md), [To Base64](to-base64.md)

<!-- docs:nav -->
---

[← To Base64](to-base64.md) · [Contents](../../README.md) · [To Base92 →](to-base92.md)
<!-- /docs:nav -->
