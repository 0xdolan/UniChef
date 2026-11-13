<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Decode NetBIOS Name

Read pairs of bytes, each `offset` plus a nibble, as one byte each, and remove the trailing spaces. The input may be at most 32 bytes, in pairs.

| Id | Input | Output | Background |
|---|---|---|---|
| `decode-netbios-name` | bytes | bytes | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

Each pair of input bytes becomes one byte: `offset` is taken from each, and the two 4-bit
values are the high and low half. The trailing space padding is removed. The input must be an
even number of bytes, at most 32, and every byte must be between `offset` and `offset` + 15.

**Worked example: `FFEOCACA`**

| Pair | Halves | Byte |
|---|---|---|
| `FF` | 5, 5 | `U` |
| `EO` | 4, 14 | `N` |
| `CA` `CA` | 2, 0 | spaces, removed |

Result: `UN`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `offset` | integer 0 to 240 | `65` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `FFEOEJEDEIEFEGCACACACACACACACACA` | — | `UNICHEF` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKSU3OT0nVzUstScrML9bNS8xNVdJRSixKB6qprq2NrQUA&i=c3Nz9Xf1cnVx9XR1c3V3dkSHAA), or search for "Decode NetBIOS Name" in the operation list.

**CLI:**

```sh
unichef op decode-netbios-name FFEOEJEDEIEFEGCACACACACACACACACA
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("decode-netbios-name", {}, Dish.of_string("FFEOEJEDEIEFEGCACACACACACACACACA"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("decode-netbios-name", {}, { type: 'string', value: "FFEOEJEDEIEFEGCACACACACACACACACA" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1001, section 14.1](https://www.rfc-editor.org/rfc/rfc1001#section-14.1)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [Encode NetBIOS Name](encode-netbios-name.md)

<!-- docs:nav -->
---

[← Citrix CTX1 Encode](citrix-ctx1-encode.md) · [Contents](../../README.md) · [Decode Text →](decode-text.md)
<!-- /docs:nav -->
