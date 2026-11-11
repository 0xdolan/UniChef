<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# SHAKE

SHAKE extendable-output function (FIPS 202); `size` is 128 (default) or 256 and `length` is the output length in bytes (default 32).

| Id | Input | Output | Background |
|---|---|---|---|
| `shake` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

SHAKE128 and SHAKE256 (FIPS 202) are *extendable-output functions*: the same Keccak sponge as
[SHA-3](sha3.md), but you choose how many bytes to squeeze out. After absorbing the input, the
sponge outputs *r* bits, runs the Keccak-f permutation, outputs *r* more, and so on until
`length` bytes have been produced.

| `size` | Rate *r* | Security |
|---|---|---|
| `128` | 168 bytes | 128 bits (if the output is at least 32 bytes) |
| `256` | 136 bytes | 256 bits (if the output is at least 64 bytes) |

**Worked example.** `abc` with SHAKE128:
- `length=32` gives `5881092dd818bf5cf8a3ddb793fbcba74097d5c526a6d35f97b83351940f2cc8`;
- `length=16` gives `5881092dd818bf5cf8a3ddb793fbcba7`, which is the first 16 bytes of the
  same stream.

That prefix property is the difference from hash functions with a fixed size: a shorter output
is a truncation of a longer one. SHAKE is used where a protocol needs output of any length,
such as in the post-quantum standards ML-KEM and ML-DSA, and as a key derivation building
block.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `size` | choice | `128` | `128`, `256` |
| `length` | integer 1 to 65536 | `32` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | `length=16` | `5881092dd818bf5cf8a3ddb793fbcba7` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzkjMTlXSUUosSgeKVivlpOall2QAVZrV1sbWAgA&i=S0xKBgA), or search for "SHAKE" in the operation list.

**CLI:**

```sh
unichef op shake --arg length=16 abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("shake", {"length": 16}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("shake", {"length": 16}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [FIPS 202: SHA-3 Standard](https://csrc.nist.gov/pubs/fips/202/final)
- [NIST SP 800-185: cSHAKE, KMAC and TupleHash](https://csrc.nist.gov/pubs/sp/800/185/final)
- Related: [SHA-3](sha3.md), [BLAKE2b](blake2b.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← SHA-3](sha3.md) · [Contents](../../README.md) · [AES Decrypt →](aes-decrypt.md)
<!-- /docs:nav -->
