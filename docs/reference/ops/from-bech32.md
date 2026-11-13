<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Bech32

Check the checksum of a Bech32 or Bech32m string and write its data as hex. A SegWit address gives the witness version byte and then the program. Other formats: `raw` (one character per byte), `script-pubkey`, `hrp-hex` and `json`.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-bech32` | string | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

1. The string is split at its last `1` into the human-readable part and the data. It must be
   at most 90 characters, all lower case or all upper case, and use only the Bech32 alphabet.
2. The checksum over both parts is checked. With `encoding=auto` either the Bech32 or the
   Bech32m constant is accepted; otherwise only the one you chose. A wrong checksum is an
   error, which is the point of the format: a mistyped address does not decode.
3. The data is regrouped from 5 bits to 8 bits. Leftover bits must be zero and fewer than five.

When the human-readable part is a Bitcoin or Litecoin one (`bc`, `tb`, `bcrt`, `ltc`, `tltc`)
and the data is a valid witness program, the first character is the witness version and the
output starts with it as one byte. `format=script-pubkey` then writes the script that locks
coins to the address: the version opcode, the length and the program.

**Worked example: `bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`**

| Part | Value |
|---|---|
| Human-readable part | `bc` (Bitcoin mainnet) |
| First data character | `q` = 0, the witness version |
| Checksum | `v8f3t4`, valid as Bech32 |
| `hex` | `00751e76e8199196d454941c45d1b3a323f1433bd6` |
| `script-pubkey` | `0014751e76e8199196d454941c45d1b3a323f1433bd6` |

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `encoding` | choice | `auto` | `auto`, `bech32`, `bech32m` |
| `format` | choice | `hex` | `hex`, `raw`, `script-pubkey`, `hrp-hex`, `json` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `test1fp5sjj6w55` | — | `4869` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KTc4wNlLSUUosSgfKVdfWxtYCAA&i=K0ktLjFMKzAtzsoyKzc1BQA), or search for "From Bech32" in the operation list.

**CLI:**

```sh
unichef op from-bech32 test1fp5sjj6w55
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-bech32", {}, Dish.of_string("test1fp5sjj6w55"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-bech32", {}, { type: 'string', value: "test1fp5sjj6w55" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [BIP-173: Bech32](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki)
- [BIP-350: Bech32m](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [To Bech32](to-bech32.md), [From Base58](from-base58.md), [To Hex](to-hex.md)

<!-- docs:nav -->
---

[← From BCD](from-bcd.md) · [Contents](../../README.md) · [From Binary →](from-binary.md)
<!-- /docs:nav -->
