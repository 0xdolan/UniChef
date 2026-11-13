<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# PEM to Hex

Find each PEM block (BEGIN and END lines with the same label), decode its Base64 body and write the bytes as hex, one line per block.

| Id | Input | Output | Background |
|---|---|---|---|
| `pem-to-hex` | string | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

PEM is the text wrapper for keys and certificates: a `-----BEGIN LABEL-----` line, the binary
data as Base64, and a matching `-----END LABEL-----` line. The data inside is usually DER, the
binary form of an ASN.1 structure.

The operation finds every BEGIN line whose label is three or more capital letters and spaces,
takes the text up to the END line with the same label, drops everything that is not a Base64
character (line breaks, spaces, padding) and decodes the rest. Each block gives one line of
hex. Text outside the blocks is ignored. A BEGIN line with no matching END line is an error.

**Worked example**

```
-----BEGIN DATA-----
SGk=
-----END DATA-----
```

The body `SGk=` is Base64 for the bytes `48 69`, so the output is `4869`. For a real
certificate the output starts with `3082`, the DER header of a long SEQUENCE.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `-----BEGIN DATA-----\nSGk=\n-----END DATA-----` | — | `4869` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSM3VLcnXzUitUNJRSixKB0pV19bG1gIA&i=09UFAidXd08_BRfHEEcQT5cr2D3blgvMdPVzQYgDAA), or search for "PEM to Hex" in the operation list.

**CLI:**

```sh
unichef op pem-to-hex
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("pem-to-hex", {}, Dish.of_string("-----BEGIN DATA-----\nSGk=\n-----END DATA-----"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("pem-to-hex", {}, { type: 'string', value: "-----BEGIN DATA-----\nSGk=\n-----END DATA-----" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 7468: Textual Encodings of PKIX, PKCS, and CMS Structures](https://www.rfc-editor.org/rfc/rfc7468)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [Hex to PEM](hex-to-pem.md), [From Base64](from-base64.md), [To Hex](to-hex.md)

<!-- docs:nav -->
---

[← IDNA To Unicode](idna-to-unicode.md) · [Contents](../../README.md) · [Quoted-Printable Decode →](quoted-printable-decode.md)
<!-- /docs:nav -->
