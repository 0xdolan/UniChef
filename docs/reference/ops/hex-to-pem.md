<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Hex to PEM

Write hex bytes (usually DER) as a PEM block: a BEGIN line with the `header` label, the bytes as Base64 in lines of 64 characters, and an END line. Lines end in CR LF.

| Id | Input | Output | Background |
|---|---|---|---|
| `hex-to-pem` | string | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

The hex digits (spaces and line breaks are ignored) are turned into bytes, the bytes into
Base64, and the Base64 is cut into lines of 64 characters between a BEGIN and an END line.
`header` is the label on both lines; it tells the reader what the bytes are, for example
`CERTIFICATE`, `PUBLIC KEY` or `EC PRIVATE KEY`. Lines end in CR LF.

The operation does not look inside the bytes: a wrong label gives a file that looks right and
that other tools will refuse.

**Worked example: `4869` with `header=DATA`**

```
-----BEGIN DATA-----
SGk=
-----END DATA-----
```

`48 69` is `SGk=` in Base64. 48 bytes fill one 64-character line exactly; the 49th starts a
second line.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `header` | string | `CERTIFICATE` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `4869` | `header=DATA` | `-----BEGIN DATA-----\r\nSGk=\r\n-----END DATA-----\r\n` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKSK3QLcnXLUjNVdJRSixKB0pVAwUTU1KLgLIujiGOSrW1sbUA&i=M7EwswQA), or search for "Hex to PEM" in the operation list.

**CLI:**

```sh
unichef op hex-to-pem --arg header=DATA 4869
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("hex-to-pem", {"header": "DATA"}, Dish.of_string("4869"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("hex-to-pem", {"header": "DATA"}, { type: 'string', value: "4869" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 7468: Textual Encodings of PKIX, PKCS, and CMS Structures](https://www.rfc-editor.org/rfc/rfc7468)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [PEM to Hex](pem-to-hex.md), [To Base64](to-base64.md), [From Hex](from-hex.md)

<!-- docs:nav -->
---

[← From Punycode](from-punycode.md) · [Contents](../../README.md) · [HTML Entity Decode →](html-entity-decode.md)
<!-- /docs:nav -->
