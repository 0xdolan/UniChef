<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base64

Encode bytes as Base64 (RFC 4648 §4 or §5, or a custom alphabet).

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base64` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Base64 writes every three bytes (24 bits) as four characters, each standing for 6 bits.

**Worked example: `Hi!`**

```
bytes     48       69       21
bits      01001000 01101001 00100001
6-bit     010010 000110 100100 100001
index     18     6      36     33
char      S      G      k      h
```

The index picks a character from the alphabet:

| Index | 0–25 | 26–51 | 52–61 | 62 | 63 |
|---|---|---|---|---|---|
| `standard` | `A–Z` | `a–z` | `0–9` | `+` | `/` |
| `url` | `A–Z` | `a–z` | `0–9` | `-` | `_` |

When the input length is not a multiple of three, the last group is filled with zero bits and
the output is padded with `=` to a multiple of four characters: `Hi` gives `SGk=` and `H`
gives `SA==`. Turn `padding` off for base64url as used in JWTs and many URLs.

`custom` takes 64 distinct characters, plus an optional 65th as the padding character.
Malware and CTF challenges sometimes shuffle the alphabet so that standard decoders fail;
once you find the alphabet, the same operation decodes it.

Base64 grows the data by a third. Typical places: email attachments (MIME), `data:` URLs,
PEM certificates and keys, HTTP Basic authentication, JWTs, and payloads in PowerShell's
`-EncodedCommand` (which is Base64 of UTF-16LE text).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `standard` | `standard`, `url`, `custom` |
| `custom` | string | — | — |
| `padding` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello, world!` | — | `SGVsbG8sIHdvcmxkIQ==` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixONTNR0lFKLEoHylTX1sbWAgA&i=80jNycnXUSjPL8pJUQQA), or search for "To Base64" in the operation list.

**CLI:**

```sh
unichef op to-base64 'Hello, world!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base64", {}, Dish.of_string("Hello, world!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base64", {}, { type: 'string', value: "Hello, world!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4648 §4 and §5: Base64 and base64url](https://www.rfc-editor.org/rfc/rfc4648#section-4)
- [Base64 on Wikipedia](https://en.wikipedia.org/wiki/Base64)
- Related: [From Base64](from-base64.md), [To Base32](to-base32.md), [JWT Decode](jwt-decode.md)

<!-- docs:nav -->
---

[← To Base58](to-base58.md) · [Contents](../../README.md) · [To Base85 →](to-base85.md)
<!-- /docs:nav -->
