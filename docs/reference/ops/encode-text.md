<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Encode Text

Encode text in a character encoding. Lone surrogates become U+FFFD; no BOM.

| Id | Input | Output | Background |
|---|---|---|---|
| `encode-text` | string | bytes | [Text and bytes](../../learn/text-and-bytes.md) |
<!-- /docs:head -->

## How it works

Encode Text turns characters into bytes using a character encoding.

**Worked example: `é👋` in UTF-16LE**

1. `é` is U+00E9. It fits in one 16-bit unit, `00E9`, written little-endian (low byte first):
   `e9 00`.
2. `👋` is U+1F44B, above U+FFFF, so it becomes a surrogate pair. Subtract 0x10000 to get
   0xF44B, split it into a high 10 bits (0x03D) and a low 10 bits (0x04B), and add them to
   D800 and DC00: `D83D DC4B`. Little-endian: `3d d8 4b dc`.

Result: `e9 00 3d d8 4b dc`.

| `encoding` | Bytes per character | Can encode |
|---|---|---|
| `utf-8` | 1 to 4 | everything |
| `utf-16le`, `utf-16be` | 2 or 4 | everything |
| `utf-32le`, `utf-32be` | 4 | everything |
| `iso-8859-1` | 1 | U+0000 to U+00FF |
| `windows-1252` | 1 | Latin-1 plus `€`, curly quotes, `…` and others in 80–9F |
| `ascii` | 1 | U+0000 to U+007F |

A character the encoding cannot represent becomes `?` with `errors=replace`, or fails the step
with `errors=strict`. No byte order mark is written. Lone surrogates (possible in text that
came from broken UTF-16) cannot be encoded and become U+FFFD.

Use it before a hash or a cipher when the other side expects a specific encoding: Windows
APIs and PowerShell `-EncodedCommand` use UTF-16LE, and older systems use Windows-1252.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `encoding` | choice | `utf-8` | `utf-8`, `utf-16le`, `utf-16be`, `utf-32le`, `utf-32be`, `iso-8859-1`, `windows-1252`, `ascii` |
| `errors` | choice | `replace` | `replace`, `strict` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `café` | `encoding=iso-8859-1` | `63 61 66 e9` |
| `é👋` | `encoding=utf-16le` | `e9 00 3d d8 4b dc` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKzUvOT0nVLUmtKFHSUUosSgfKVUNEM_PSgQoyi_N1LSxMLXUNlWprY2sB&i=S05MO7wSAA), or search for "Encode Text" in the operation list.

**CLI:**

```sh
unichef op encode-text --arg encoding=iso-8859-1 'café'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("encode-text", {"encoding": "iso-8859-1"}, Dish.of_string("café"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("encode-text", {"encoding": "iso-8859-1"}, { type: 'string', value: "café" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)
- [RFC 2781: UTF-16](https://www.rfc-editor.org/rfc/rfc2781)
- Related: [Decode Text](decode-text.md), [To Hex](to-hex.md), [UTF-8 Explain](utf8-explain.md)

<!-- docs:nav -->
---

[← Encode NetBIOS Name](encode-netbios-name.md) · [Contents](../../README.md) · [Escape String →](escape-string.md)
<!-- /docs:nav -->
