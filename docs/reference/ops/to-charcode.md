<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Charcode

Write each code point in `base`. Base 16 pads to 2, 4 or 6 digits; other bases do not pad.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-charcode` | codepoints | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

`to-charcode` writes the **Unicode code point** of each character as a number in the chosen
base, separated by `delimiter`. It works on characters, not bytes, so `é` is one code `e9`
rather than the two UTF-8 bytes `c3 a9`.

**Worked example: `Hé 👋` in base 16**

| Character | Code point | Written |
|---|---|---|
| `H` | U+0048 | `48` |
| `é` | U+00E9 | `e9` |
| space | U+0020 | `20` |
| `👋` | U+1F44B | `01f44b` |

Result: `48 e9 20 01f44b`. In base 16 each code is padded to 2, 4 or 6 digits so the width
shows the size of the code point; other bases are not padded.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `comma`, `semicolon`, `colon`, `newline`, `crlf` |
| `base` | integer 2 to 36 | `16` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hé 👋` | — | `48 e9 20 01f44b` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNzkgsSs5PSVXSUUosSgfKVdfWxtYCAA&i=8zi8UuHD_IndAA), or search for "To Charcode" in the operation list.

**CLI:**

```sh
unichef op to-charcode 'Hé 👋'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-charcode", {}, Dish.of_string("Hé 👋"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-charcode", {}, { type: 'string', value: "Hé 👋" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Code point (Wikipedia)](https://en.wikipedia.org/wiki/Code_point)
- [Unicode glossary: code point](https://www.unicode.org/glossary/#code_point)
- Related: [From Charcode](from-charcode.md), [Escape Unicode](escape-unicode.md)

<!-- docs:nav -->
---

[← To Braille](to-braille.md) · [Contents](../../README.md) · [To Decimal →](to-decimal.md)
<!-- /docs:nav -->
