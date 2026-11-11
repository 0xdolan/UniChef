<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# BLAKE2s

BLAKE2s (RFC 7693); `size` is the digest length in bytes (1-32, default 32) and `key` an optional key of up to 32 bytes.

| Id | Input | Output | Background |
|---|---|---|---|
| `blake2s` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

BLAKE2s (RFC 7693) is the 32-bit variant of [BLAKE2b](blake2b.md): the same design with
32-bit words, 64-byte blocks, 10 rounds, rotations by 16, 12, 8 and 7 bits, and the SHA-256
starting values. The digest is 1 to 32 bytes, and a `key` can be up to 32 bytes.

**Worked example.** `abc` gives
`508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982`.

Choose BLAKE2s on 32-bit and embedded processors, and where a 256-bit digest is enough. As with
BLAKE2b, the digest size is part of the parameters, so a shorter digest is not a prefix of a
longer one. WireGuard uses BLAKE2s for hashing and as a keyed MAC.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `size` | integer 1 to 32 | `32` | — |
| `key` | bytes (hex, utf8, base64, latin1), secret | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | — | `508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKyknMTjUqVtJRSixKB4pX19bG1gIA&i=S0xKBgA), or search for "BLAKE2s" in the operation list.

**CLI:**

```sh
unichef op blake2s abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("blake2s", {}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("blake2s", {}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 7693: BLAKE2](https://www.rfc-editor.org/rfc/rfc7693)
- [WireGuard protocol: cryptography](https://www.wireguard.com/protocol/)
- Related: [BLAKE2b](blake2b.md), [SHA-2](sha2.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← BLAKE2b](blake2b.md) · [Contents](../../README.md) · [CRC-32 →](crc32.md)
<!-- /docs:nav -->
