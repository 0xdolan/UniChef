<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# SHA-1

SHA-1 digest (FIPS 180-4). Warns W_INSECURE.

| Id | Input | Output | Background |
|---|---|---|---|
| `sha1` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

SHA-1 (FIPS 180-4) produces a 160-bit digest, written as 40 hex digits. It works like
[MD5](md5.md): pad the message to 64-byte blocks (with the length as a 64-bit big-endian
number), then compress each block into a state of five 32-bit words. Each block is first
expanded from 16 to 80 words, and 80 steps of add, rotate and a non-linear function mix it
into the state.

**Worked example.** `abc` gives `a9993e364706816aba3e25717850c26c9cd0d89d`, the test vector of
FIPS 180.

## Security notes

SHA-1 is **broken** for collision resistance: the SHAttered attack (2017) produced two
different PDF files with the same SHA-1, and later attacks made chosen-prefix collisions
practical (2020). UniChef warns `W_INSECURE`. Browsers stopped trusting SHA-1 certificates in
2017, and Git is moving to SHA-256. It is still fine to match existing values, such as file
hashes in old reports. Inside [HMAC](hmac.md), SHA-1 is not yet broken, but choose SHA-256 for
new designs.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | — | `a9993e364706816aba3e25717850c26c9cd0d89d` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzkg0VNJRSixKBwpW19bG1gIA&i=S0xKBgA), or search for "SHA-1" in the operation list.

**CLI:**

```sh
unichef op sha1 abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("sha1", {}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("sha1", {}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [FIPS 180-4: Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
- [SHAttered: the first SHA-1 collision](https://shattered.io/)
- Related: [MD5](md5.md), [SHA-2](sha2.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← MD5](md5.md) · [Contents](../../README.md) · [SHA-2 →](sha2.md)
<!-- /docs:nav -->
