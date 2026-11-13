<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Caret/M-decode

Turn the caret and M- notation of `cat -v` back into bytes: `^@` to `^_` are 0x00 to 0x1F, `^?` is 0x7F, and `M-` adds 0x80 to the character or caret code after it. Other text is kept as UTF-8.

| Id | Input | Output | Background |
|---|---|---|---|
| `caret-m-decode` | string | bytes | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

The input is read as text. Each caret or M- sequence becomes one byte, and all other text is
written as UTF-8:

| Notation | Byte |
|---|---|
| `^@` to `^_` | 0x00 to 0x1F (the character's code minus 0x40) |
| `^?` | 0x7F |
| `M-` + a printable character | the character's code plus 0x80 |
| `M-^@` to `M-^_`, `M-^?` | 0x80 to 0x9F, 0xFF |

A `^` or `M-` that does not start a valid sequence, such as `^a` or a `^` at the end, is kept
as text.

**Worked example: `M-bM-^@M-^]`**

| Token | Byte |
|---|---|
| `M-b` | 0x80 + 0x62 = 0xE2 |
| `M-^@` | 0x80 + 0x00 = 0x80 |
| `M-^]` | 0x80 + 0x1D = 0x9D |

The bytes E2 80 9D are the UTF-8 encoding of `”` (U+201D). This is how `cat -v` shows a curly
quote.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `M-bM-^@M-^] ^I!` | — | `” \t!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKTixKLdHN1U1JTc5PSVXSUUosSgdKV9fWxtYCAA&i=89VN8tWNcwDiWIU4T0UA), or search for "Caret/M-decode" in the operation list.

**CLI:**

```sh
unichef op caret-m-decode 'M-bM-^@M-^] ^I!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("caret-m-decode", {}, Dish.of_string("M-bM-^@M-^] ^I!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("caret-m-decode", {}, { type: 'string', value: "M-bM-^@M-^] ^I!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [cat invocation in the GNU coreutils manual](https://www.gnu.org/software/coreutils/manual/html_node/cat-invocation.html)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [From Hex](from-hex.md), [Escape Unicode](escape-unicode.md)

<!-- docs:nav -->
---

[← Operation reference](../README.md) · [Contents](../../README.md) · [Citrix CTX1 Decode →](citrix-ctx1-decode.md)
<!-- /docs:nav -->
