<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base58

Encode bytes as Base58. Each leading zero byte becomes the alphabet's first digit.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base58` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Base58 treats the whole input as one big unsigned number, most significant byte first, and
writes it in base 58.

**Worked example: `Hello`**

1. The bytes `48 65 6c 6c 6f` are the number 0x48656c6c6f = 310 939 249 775.
2. Divide by 58 repeatedly and keep each remainder (a digit from 0 to 57) until the number
   is zero. Read in reverse, the digits are 8, 9, 42, 36, 53, 57, 49.
3. Each digit picks a character from
   `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz` (Bitcoin).
   8 is `9`, 9 is `A`, 42 is `j`, and so on.

Result: `9Ajdvzr`.

Because the conversion is arithmetic, leading zero bytes would vanish (a leading zero does not
change a number). Base58 therefore writes each leading `00` byte as the first alphabet
character, `1`. That is why Bitcoin addresses, which start with a version byte of zero,
start with `1`.

The alphabet leaves out `0`, `O`, `I` and `l` and all punctuation, so values are unambiguous
to read and select with a double-click. The `flickr` alphabet swaps the case order
(`a–z` before `A–Z`). Bitcoin's Base58Check adds a 4-byte double-SHA-256 checksum before
encoding; this operation is the plain encoding without it.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `bitcoin` | `bitcoin`, `flickr` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello` | — | `9Ajdvzr` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixONbVQ0lFKLEoHylTX1sbWAgA&i=80jNyckHAA), or search for "To Base58" in the operation list.

**CLI:**

```sh
unichef op to-base58 Hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base58", {}, Dish.of_string("Hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base58", {}, { type: 'string', value: "Hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Base58Check encoding (Bitcoin wiki)](https://en.bitcoin.it/wiki/Base58Check_encoding)
- [IETF draft: the Base58 encoding scheme](https://datatracker.ietf.org/doc/html/draft-msporny-base58)
- Related: [From Base58](from-base58.md), [To Base64](to-base64.md)

<!-- docs:nav -->
---

[← To Base32](to-base32.md) · [Contents](../../README.md) · [To Base64 →](to-base64.md)
<!-- /docs:nav -->
