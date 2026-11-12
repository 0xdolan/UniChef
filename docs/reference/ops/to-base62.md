<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base62

Write the bytes, read as one big-endian number, in base 62. Leading zeros are not kept.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base62` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Base62 treats the whole input as one big unsigned number, most significant byte first, and
writes it in base 62 with digits and letters only. The result has no punctuation, so it is
safe in URLs, file names and identifiers.

**Worked example: `Hello`**

1. The bytes `48 65 6c 6c 6f` are the number 0x48656c6c6f = 310 939 249 775.
2. Divide by 62 repeatedly and keep each remainder (a digit from 0 to 61) until the number
   is zero. Read in reverse, the digits are 5, 29, 25, 3, 25, 3, 57.
3. Each digit picks a character from `0–9A–Za–z`: 5 is `5`, 29 is `T`, 25 is `P`, 57 is `v`.

Result: `5TP3P3v`.

The `lower-first` alphabet is `0–9a–zA–Z`, which some libraries use; the same input gives
`5tp3p3V`. Check which order the other side expects, because both look alike.

Because the conversion is arithmetic, **leading zero bytes are lost**: `00 00 48` and `48`
encode to the same text. Unlike [Base58](to-base58.md), Base62 has no convention to keep
them. Input that is only zero bytes gives `0`, and empty input gives empty output.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `upper-first` | `upper-first`, `lower-first` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello` | — | `5TP3P3v` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixONTNS0lFKLEoHylTX1sbWAgA&i=80jNyckHAA), or search for "To Base62" in the operation list.

**CLI:**

```sh
unichef op to-base62 Hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base62", {}, Dish.of_string("Hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base62", {}, { type: 'string', value: "Hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Base62 (Wikipedia)](https://en.wikipedia.org/wiki/Base62)
- Related: [From Base62](from-base62.md), [To Base58](to-base58.md)

<!-- docs:nav -->
---

[← To Base58](to-base58.md) · [Contents](../../README.md) · [To Base64 →](to-base64.md)
<!-- /docs:nav -->
