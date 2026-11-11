<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# CRC-32

CRC-32 (ISO-HDLC, as in zlib and PNG) as 8 hex digits.

| Id | Input | Output | Background |
|---|---|---|---|
| `crc32` | bytes | string | [Hashing](../../learn/hashing.md) |
<!-- /docs:head -->

## How it works

CRC-32 is a *checksum*, not a cryptographic hash. It treats the input as a long binary
polynomial and returns the remainder of dividing it by the generator polynomial `04C11DB7`.
This parameter set (CRC-32/ISO-HDLC) is the one used by zlib, gzip, PNG, ZIP and Ethernet:

| Parameter | Value |
|---|---|
| Polynomial | `04C11DB7` (processed bit-reversed as `EDB88320`) |
| Initial value | `FFFFFFFF` |
| Input and output reflected | yes |
| Final XOR | `FFFFFFFF` |

**How it is calculated.** Start with `FFFFFFFF`. For each byte, XOR it into the low 8 bits,
then eight times: shift right by one, and if the bit shifted out was 1, XOR with `EDB88320`.
At the end, XOR with `FFFFFFFF`. Fast implementations use a 256-entry table.

**Worked example.** `abc` gives `352441c2`, the same as Python's `zlib.crc32(b"abc")`.

## Security notes

CRC-32 detects accidental errors such as flipped bits and burst errors well, but anyone can
change data and fix the CRC with four chosen bytes. Never use it to protect against an
attacker; use [HMAC](hmac.md) or a cryptographic hash.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `The quick brown fox jumps over the lazy dog` | — | `414fa339` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKLko2NlLSUUosSgeKVtfWxtYCAA&i=C8lIVSgszUzOVkgqyi_PU0jLr1DIKs0tKFbIL0stUigBSuckVlUqpOSnAwA), or search for "CRC-32" in the operation list.

**CLI:**

```sh
unichef op crc32 'The quick brown fox jumps over the lazy dog'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("crc32", {}, Dish.of_string("The quick brown fox jumps over the lazy dog"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("crc32", {}, { type: 'string', value: "The quick brown fox jumps over the lazy dog" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [CRC catalogue: CRC-32/ISO-HDLC](https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-iso-hdlc)
- [Cyclic redundancy check on Wikipedia](https://en.wikipedia.org/wiki/Cyclic_redundancy_check)
- Related: [Adler-32](adler32.md), [Gunzip](gunzip.md), [Hashing](../../learn/hashing.md)

<!-- docs:nav -->
---

[← BLAKE2s](blake2s.md) · [Contents](../../README.md) · [HMAC →](hmac.md)
<!-- /docs:nav -->
