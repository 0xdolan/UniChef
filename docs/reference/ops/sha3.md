<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# SHA-3

SHA-3 digest (FIPS 202); `size` is 256 (default), 224, 384 or 512.

| Id | Input | Output | Background |
|---|---|---|---|
| `sha3` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

SHA-3 (FIPS 202) is built on a completely different design from SHA-2: the **sponge**
construction with the Keccak-f[1600] permutation.

1. The state is 1 600 bits (a 5 × 5 array of 64-bit lanes), all zero at the start.
2. **Absorb**: the padded message is split into blocks of *r* bits (the *rate*). Each block is
   XORed into the first *r* bits of the state, then the whole state is mixed by Keccak-f: 24
   rounds of the steps θ, ρ, π, χ and ι.
3. **Squeeze**: the first bits of the state are the digest.

The remaining *c* = 1 600 − *r* bits (the *capacity*) are never output, which is what makes
the sponge secure. For SHA3-256, *c* = 512 and *r* = 1 088 bits.

| `size` | Rate *r* (bytes) | Security against collisions |
|---|---|---|
| `224` | 144 | 112 bits |
| `256` | 136 | 128 bits |
| `384` | 104 | 192 bits |
| `512` | 72 | 256 bits |

**Worked example.** `abc` gives
`3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532`.

SHA-3 is not the same as the original Keccak used by Ethereum (`keccak256`): FIPS 202 changed
the padding, so the digests differ. SHA-3 resists length extension, so `SHA3(key + message)` is
a valid MAC, although [HMAC](hmac.md) is the more common choice.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `size` | choice | `256` | `256`, `224`, `384`, `512` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | — | `3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzkg0VtJRSixKBwpW19bG1gIA&i=S0xKBgA), or search for "SHA-3" in the operation list.

**CLI:**

```sh
unichef op sha3 abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("sha3", {}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("sha3", {}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [FIPS 202: SHA-3 Standard](https://csrc.nist.gov/pubs/fips/202/final)
- [The Keccak team: sponge functions](https://keccak.team/sponge_duplex.html)
- Related: [SHAKE](shake.md), [SHA-2](sha2.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← SHA-2](sha2.md) · [Contents](../../README.md) · [SHAKE →](shake.md)
<!-- /docs:nav -->
