<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Citrix CTX1 Encode

Obscure a password the way Citrix CTX1 does: take its UTF-16LE bytes, XOR each with 0xA5 and the previous result, and write each result as two letters from `A` to `P`. This is not encryption.

| Id | Input | Output | Background |
|---|---|---|---|
| `citrix-ctx1-encode` | string | string | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

The text is encoded as UTF-16LE, two bytes per code unit. Each byte is XORed with 0xA5 and
with the previous result (0 for the first), and each result is written as two letters from
`A` to `P`: its high 4 bits, then its low 4 bits, each added to `A`.

**Worked example: `pass`**

| Byte | XOR 0xA5 XOR previous | Letters |
|---|---|---|
| `p` 0x70 | 0x70 ⊕ 0xA5 ⊕ 0x00 = 0xD5 | `NF` |
| 0x00 | 0x00 ⊕ 0xA5 ⊕ 0xD5 = 0x70 | `HA` |
| `a` 0x61 | 0x61 ⊕ 0xA5 ⊕ 0x70 = 0xB4 | `LE` |
| 0x00 | 0x00 ⊕ 0xA5 ⊕ 0xB4 = 0x11 | `BB` |

Going on through `s`, `s` gives `NFHALEBBMHGCLEBB`. CTX1 has no key, so this hides a password
only from a casual look.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `pass` | — | `NFHALEBBMHGCLEBB` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKziwpyqzQTS6pMNRNzUvOT0lV0lFKLEoHKqmurY2tBQA&i=K0gsLgYA), or search for "Citrix CTX1 Encode" in the operation list.

**CLI:**

```sh
unichef op citrix-ctx1-encode pass
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("citrix-ctx1-encode", {}, Dish.of_string("pass"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("citrix-ctx1-encode", {}, { type: 'string', value: "pass" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [XOR cipher on Wikipedia](https://en.wikipedia.org/wiki/XOR_cipher)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [Citrix CTX1 Decode](citrix-ctx1-decode.md), [XOR](xor.md)

<!-- docs:nav -->
---

[← Citrix CTX1 Decode](citrix-ctx1-decode.md) · [Contents](../../README.md) · [Decode NetBIOS Name →](decode-netbios-name.md)
<!-- /docs:nav -->
