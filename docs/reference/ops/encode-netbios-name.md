<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Encode NetBIOS Name

Pad the name with spaces to 16 bytes and write each byte as two, its high and low nibble each added to `offset` (65, `A`, by RFC 1001). The name may be at most 16 bytes.

| Id | Input | Output | Background |
|---|---|---|---|
| `encode-netbios-name` | bytes | bytes | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

The name is padded with spaces (0x20) to 16 bytes. Each byte is split into its high and low
4 bits, and each half is added to `offset`, so each byte becomes two. RFC 1001 uses 65 (`A`),
which turns each half into a letter from `A` to `P`. A name longer than 16 bytes is an error.

**Worked example: `UNICHEF`**

| Byte | Halves | Letters |
|---|---|---|
| `U` 0x55 | 5, 5 | `FF` |
| `N` 0x4E | 4, 14 | `EO` |
| space 0x20 (×9) | 2, 0 | `CA` |

Result: `FFEOEJEDEIEFEGCACACACACACACACACA`, 32 letters.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `offset` | integer 0 to 240 | `65` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `UNICHEF` | — | `FFEOEJEDEIEFEGCACACACACACACACACA` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKzUvOT0nVzUstScrML9bNS8xNVdJRSixKB6qprq2NrQUA&i=C_XzdPZwdQMA), or search for "Encode NetBIOS Name" in the operation list.

**CLI:**

```sh
unichef op encode-netbios-name UNICHEF
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("encode-netbios-name", {}, Dish.of_string("UNICHEF"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("encode-netbios-name", {}, { type: 'string', value: "UNICHEF" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 1001, section 14.1](https://www.rfc-editor.org/rfc/rfc1001#section-14.1)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [Decode NetBIOS Name](decode-netbios-name.md)

<!-- docs:nav -->
---

[← Decode Text](decode-text.md) · [Contents](../../README.md) · [Encode Text →](encode-text.md)
<!-- /docs:nav -->
