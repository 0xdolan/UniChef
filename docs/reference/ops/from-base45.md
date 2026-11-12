<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base45

Decode Base45 (RFC 9285). Without `strict`, it skips characters outside the alphabet.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base45` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each character's position in the alphabet (`0–9`, `A–Z`, space, `$%*+-./:`) is a digit from
0 to 44. The decoder takes **three characters** at a time, computes
c + d × 45 + e × 45² (the first character is the least significant) and writes the result as
**two bytes**. A final group of two characters gives one byte. `BB8` is
11 + 11 × 45 + 8 × 2025 = 16 706 = 0x4142, which is `AB`.

These inputs are errors (`E_DECODE`), as RFC 9285 requires:

- a group of three whose value is above 65 535, such as `GGW`;
- a final pair whose value is above 255, such as `::`;
- one character left over at the end.

Without `strict`, characters outside the alphabet, such as line breaks and lower-case
letters, are skipped. With `strict`, any such character is an error. A space is a Base45
digit, so it is never skipped.

EU Digital COVID Certificates are Base45: strip the `HC1:` prefix, decode, then
[Zlib Inflate](zlib-inflate.md) the result to reach the signed CBOR data.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `BB8` | — | `AB` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE41MVXSUUosSgfKVdfWxtYCAA&i=c3KyAAA), or search for "From Base45" in the operation list.

**CLI:**

```sh
unichef op from-base45 BB8
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base45", {}, Dish.of_string("BB8"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base45", {}, { type: 'string', value: "BB8" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 9285: the Base45 data encoding](https://www.rfc-editor.org/rfc/rfc9285)
- [EU Digital COVID Certificate: the HCERT specification](https://github.com/ehn-dcc-development/eu-dcc-hcert-spec/blob/main/hcert_spec.md)
- Related: [To Base45](to-base45.md), [Zlib Inflate](zlib-inflate.md)

<!-- docs:nav -->
---

[← From Base32](from-base32.md) · [Contents](../../README.md) · [From Base58 →](from-base58.md)
<!-- /docs:nav -->
