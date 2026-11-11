<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# To Code Points

Write each code point as `U+0041`, `0041`, `0x0041` or `65`.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-code-points` | codepoints | string | [Text and bytes](../../learn/text-and-bytes.md) |
<!-- /docs:head -->

## How it works

A code point is the number Unicode assigns to a character, from U+0000 to U+10FFFF. This
operation decodes the input as UTF-8 and writes each code point's number, so you see the
characters themselves rather than the bytes that store them.

**Worked example: `é👋`**

| Character | `u-plus` | `hex` | `0x` | `decimal` |
|---|---|---|---|---|
| `é` | `U+00E9` | `00E9` | `0x00E9` | `233` |
| `👋` | `U+1F44B` | `1F44B` | `0x1F44B` | `128075` |

Hex forms have at least four digits, as in the Unicode Standard. Compare with
[To Hex](to-hex.md), which shows the UTF-8 bytes `c3 a9 f0 9f 91 8b`: six bytes, two code
points.

One code point is not always one visible character. `é` can also be the two code points
`U+0065 U+0301` (e plus a combining acute accent), and a flag is two regional indicator code
points. Use [Grapheme Split](grapheme-split.md) to see user-perceived characters, and
[Analyse Characters](analyse-characters.md) for names and properties.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `format` | choice | `u-plus` | `u-plus`, `hex`, `0x`, `decimal` |
| `delimiter` | choice | `space` | `space`, `comma`, `newline` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi 👋` | — | `U+0048 U+0069 U+0020 U+1F44B` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNzk9J1S3Iz8wrKVbSUUosSgdKV9fWxtYCAA&i=88hU-DB_YjcA), or search for "To Code Points" in the operation list.

**CLI:**

```sh
unichef op to-code-points 'Hi 👋'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-code-points", {}, Dish.of_string("Hi 👋"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-code-points", {}, { type: 'string', value: "Hi 👋" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Unicode Standard, chapter 2: code points](https://www.unicode.org/versions/latest/core-spec/chapter-2/)
- [Code point on Wikipedia](https://en.wikipedia.org/wiki/Code_point)
- Related: [From Code Points](from-code-points.md), [Analyse Characters](analyse-characters.md), [Unicode](../../learn/unicode.md)

<!-- docs:nav -->
---

[← Strip Diacritics](strip-diacritics.md) · [Contents](../../README.md) · [Unescape Unicode →](unescape-unicode.md)
<!-- /docs:nav -->
