<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Bech32

Encode bytes as Bech32 or Bech32m: the human-readable part `hrp`, a `1`, the data in a 32-character alphabet and a six-character checksum. `segwit` mode writes a Bitcoin SegWit address from a witness program and `witness_version`.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-bech32` | bytes | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

A Bech32 string has three parts: a human-readable part (`hrp`) that names what the data is,
the separator `1`, and the data with a checksum, written in a 32-character alphabet
(`qpzry9x8gf2tvdw0s3jn54khce6mua7l`) that leaves out `1`, `b`, `i` and `o` because they are
easy to misread.

1. The bytes are regrouped from 8 bits to 5 bits, padded with zero bits at the end.
2. A six-character checksum is computed over the `hrp` and the data. It is a BCH code that
   finds any error in up to four characters. Bech32 and Bech32m differ only in the constant
   mixed into the checksum (1 and 0x2bc830a3).
3. Each 5-bit value is written as one character of the alphabet.

With `mode=segwit`, the input is a witness program and `witness_version` (0 to 16) is written
as one extra character before it. Bitcoin uses Bech32 for version 0 and Bech32m for version 1
and later; a version 0 program must be 20 or 32 bytes. The result may be at most 90 characters.

**Worked example: `Hi` with `hrp=test`**

| Step | Value |
|---|---|
| Bytes | `48 69` = `01001000 01101001` |
| 5-bit groups | `01001 00001 10100 10000` (the last padded with four zeros) = 9, 1, 20, 16 |
| Characters | `f`, `p`, `5`, `s` |
| Checksum | `jj6w55` |

Result: `test1fp5sjj6w55`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `hrp` | string | `bc` | — |
| `encoding` | choice | `bech32` | `bech32`, `bech32m` |
| `mode` | choice | `generic` | `generic`, `segwit` |
| `witness_version` | integer 0 to 16 | `0` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | `hrp=test` | `test1fp5sjj6w55` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSk3OMDZS0lFKLEoHylQrZRSBZVKLS5Rqa2NrAQ&i=88gEAA), or search for "To Bech32" in the operation list.

**CLI:**

```sh
unichef op to-bech32 --arg hrp=test Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-bech32", {"hrp": "test"}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-bech32", {"hrp": "test"}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [BIP-173: Bech32](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki)
- [BIP-350: Bech32m](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [From Bech32](from-bech32.md), [To Base32](to-base32.md), [To Base58](to-base58.md)

<!-- docs:nav -->
---

[← To BCD](to-bcd.md) · [Contents](../../README.md) · [To Binary →](to-binary.md)
<!-- /docs:nav -->
