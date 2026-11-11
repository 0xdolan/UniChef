<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# MD5

MD5 digest (RFC 1321). Warns W_INSECURE.

| Id | Input | Output | Background |
|---|---|---|---|
| `md5` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

MD5 (RFC 1321) turns any input into a 128-bit digest, written as 32 hex digits.

1. **Pad** the message: append the byte `80`, then zero bytes until the length is 56 mod 64,
   then the original length in bits as a 64-bit little-endian number. The padded message is a
   whole number of 64-byte blocks.
2. **Start** with four fixed 32-bit words A, B, C, D (`67452301`, `efcdab89`, `98badcfe`,
   `10325476`).
3. **Compress** each block in 64 steps, four rounds of 16. Each step mixes one 32-bit word of
   the block into the state with a non-linear function (F, G, H or I of B, C, D), adds a
   constant derived from the sine function, and rotates left by a fixed amount.
4. **Add** the result to the state, and continue with the next block.
5. **Output** A, B, C, D as little-endian bytes.

**Worked example.** `abc` gives `900150983cd24fb0d6963f7d28e17f72`, and the empty input gives
`d41d8cd98f00b204e9800998ecf8427e`. Changing one input bit changes about half the output bits.

## Security notes

MD5 is **broken**: anyone can make two different inputs with the same digest in seconds, and
attackers have used that to forge a certificate authority (2008) and to sign the Flame malware
(2012). UniChef warns `W_INSECURE`. Use it only to match known MD5 values, such as malware
hashes in threat intelligence feeds or old checksums, never for signatures, integrity against
an attacker, or passwords. Use [SHA-2](sha2.md), [SHA-3](sha3.md) or [BLAKE2b](blake2b.md)
instead.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | — | `900150983cd24fb0d6963f7d28e17f72` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKTTFV0lFKLEoHilXX1sbWAgA&i=S0xKBgA), or search for "MD5" in the operation list.

**CLI:**

```sh
unichef op md5 abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("md5", {}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("md5", {}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1321: MD5](https://www.rfc-editor.org/rfc/rfc1321)
- [RFC 6151: security considerations for MD5](https://www.rfc-editor.org/rfc/rfc6151)
- Related: [SHA-1](sha1.md), [SHA-2](sha2.md), [HMAC](hmac.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← HMAC](hmac.md) · [Contents](../../README.md) · [SHA-1 →](sha1.md)
<!-- /docs:nav -->
