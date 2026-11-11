<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# BLAKE2b

BLAKE2b (RFC 7693); `size` is the digest length in bytes (1-64, default 64) and `key` an optional key of up to 64 bytes.

| Id | Input | Output | Background |
|---|---|---|---|
| `blake2b` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

BLAKE2b (RFC 7693) is a fast, secure hash function optimised for 64-bit processors. It is
often faster than MD5 while being as secure as SHA-3.

1. The state is eight 64-bit words: the SHA-512 starting values, with the first word XORed
   with a *parameter block* that holds the digest `size` and the key length.
2. If there is a `key`, it is padded to a full 128-byte block and hashed first.
3. Each 128-byte block is compressed in 12 rounds. Each round applies the G function (add,
   XOR, rotate by 32, 24, 16 and 63 bits) to the columns, then the diagonals, of a 4 × 4 matrix
   of words, with the message words in a different order each round.
4. A counter of bytes so far and a final-block flag go into every compression, so no padding
   with the length is needed.
5. The first `size` bytes of the state are the digest.

**Worked examples.**
- `abc` with `size=64` gives `ba80a53f981c4d0d…d4009923` (128 hex digits).
- `abc` with `size=32` gives `bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319`.

Because the size is in the parameter block, BLAKE2b-256 is **not** the first half of
BLAKE2b-512: each size gives unrelated digests.

With a `key` of up to 64 bytes, BLAKE2b is a MAC on its own, with no need for
[HMAC](hmac.md). It is used in Argon2, WireGuard, libsodium's `crypto_generichash`, and
Zcash.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `size` | integer 1 to 64 | `64` | — |
| `key` | bytes (hex, utf8, base64, latin1), secret | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | `size=32` | `bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKyknMTjVKUtJRSixKB4pXKxVnVqUqWRkb1dbG1gIA&i=S0xKBgA), or search for "BLAKE2b" in the operation list.

**CLI:**

```sh
unichef op blake2b --arg size=32 abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("blake2b", {"size": 32}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("blake2b", {"size": 32}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 7693: BLAKE2](https://www.rfc-editor.org/rfc/rfc7693)
- [BLAKE2 website](https://www.blake2.net/)
- Related: [BLAKE2s](blake2s.md), [SHA-3](sha3.md), [HMAC](hmac.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← Adler-32](adler32.md) · [Contents](../../README.md) · [BLAKE2s →](blake2s.md)
<!-- /docs:nav -->
