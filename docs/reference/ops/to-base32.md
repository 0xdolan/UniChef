<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base32

Encode bytes as Base32 (RFC 4648 §6) or base32hex (§7).

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base32` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Base32 writes every five bytes (40 bits) as eight characters of 5 bits each.

**Worked example: `Hi`**

```
bytes     48       69
bits      01001000 01101001 (pad with 0 to a multiple of 5)
5-bit     01001 00001 10100 10000
index     9     1     20    16
char      J     B     U     Q
```

Two bytes fill four characters, and `=` pads the output to eight: `JBUQ====`.

| `alphabet` | Characters for 0–31 | Notes |
|---|---|---|
| `rfc4648` | `A–Z` then `2–7` | §6, the common one |
| `hex` | `0–9` then `A–V` | §7, keeps the sort order of the data |

Base32 is case-insensitive and avoids easily confused characters, so people can read it and
type it. It is used for TOTP secrets in authenticator apps (the `secret=` in an `otpauth://`
link), Tor onion addresses and DNS-based data channels, where only letters and digits survive.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `rfc4648` | `rfc4648`, `hex` |
| `padding` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello` | — | `JBSWY3DP` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixONTZS0lFKLEoHylTX1sbWAgA&i=80jNyckHAA), or search for "To Base32" in the operation list.

**CLI:**

```sh
unichef op to-base32 Hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base32", {}, Dish.of_string("Hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base32", {}, { type: 'string', value: "Hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4648 §6 and §7: Base32 and base32hex](https://www.rfc-editor.org/rfc/rfc4648#section-6)
- [Key URI format for TOTP secrets](https://github.com/google/google-authenticator/wiki/Key-Uri-Format)
- Related: [From Base32](from-base32.md), [To Base64](to-base64.md)

<!-- docs:nav -->
---

[← To Base](to-base.md) · [Contents](../../README.md) · [To Base45 →](to-base45.md)
<!-- /docs:nav -->
