<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# SHA-2

SHA-2 digest (FIPS 180-4); `size` is 256 (default), 224, 384, 512, 512-224 or 512-256.

| Id | Input | Output | Background |
|---|---|---|---|
| `sha2` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

SHA-2 (FIPS 180-4) is the family of hash functions used most today: in TLS certificates, code
signing, Bitcoin, Git's new object format and password-hashing schemes.

| `size` | Digest bits | Word size | Block | Rounds |
|---|---|---|---|---|
| `224`, `256` | 224, 256 | 32-bit | 64 bytes | 64 |
| `384`, `512`, `512-224`, `512-256` | 384, 512, 224, 256 | 64-bit | 128 bytes | 80 |

**How it works** (SHA-256):

1. Pad the message to a whole number of 64-byte blocks, ending with its length in bits as a
   64-bit big-endian number.
2. Start from eight 32-bit words (the first 32 bits of the fractional parts of the square
   roots of the first eight primes).
3. For each block, expand its 16 words to 64 with shifts, rotations and additions, then run 64
   rounds. Each round uses the choose and majority functions, rotations of the state words and
   one of 64 constants (from the cube roots of the first 64 primes).
4. Add the block's result to the state. After the last block, the eight words are the digest.

SHA-224 and SHA-384 are SHA-256 and SHA-512 with different starting values and a truncated
output. SHA-512/256 is SHA-512 truncated to 256 bits, and is faster than SHA-256 on 64-bit
processors.

**Worked example.** `abc` gives
`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`, and `abd` gives
`a52d159f262b2c6ddb724a61840befc36eb30c88877a4030b65cbe86298449c9`: one changed letter, a
completely different digest (the avalanche effect).

## Security notes

SHA-256 and SHA-512 are secure. They are fast, which is right for files and signatures and
wrong for passwords: use [PBKDF2](pbkdf2.md) or a dedicated password hash. A bare
`SHA-256(secret + message)` is open to length-extension attacks (except with SHA-384 and the
512/t variants); use [HMAC](hmac.md) to authenticate messages.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `size` | choice | `256` | `256`, `224`, `384`, `512`, `512-224`, `512-256` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | — | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzkg0UtJRSixKBwpW19bG1gIA&i=S0xKBgA), or search for "SHA-2" in the operation list.

**CLI:**

```sh
unichef op sha2 abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("sha2", {}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("sha2", {}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [FIPS 180-4: Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
- [Length extension attack on Wikipedia](https://en.wikipedia.org/wiki/Length_extension_attack)
- Related: [SHA-3](sha3.md), [HMAC](hmac.md), [PBKDF2](pbkdf2.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← SHA-1](sha1.md) · [Contents](../../README.md) · [SHA-3 →](sha3.md)
<!-- /docs:nav -->
