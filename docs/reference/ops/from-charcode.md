<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Charcode

Read code points written in `base` and separated by `delimiter`. Whitespace around each code is ignored and empty codes are skipped.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-charcode` | string | codepoints | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

`from-charcode` is the reverse of [To Charcode](to-charcode.md): it splits the input on
`delimiter`, reads each piece as a number in `base`, and turns it into the character with that
code point.

**Worked example: `48 e9 20 01f44b` in base 16**

The pieces are 0x48, 0xE9, 0x20 and 0x1F44B, which are `H`, `é`, space and `👋`: the text
`Hé 👋`.

Spaces around each piece are ignored, and empty pieces (from a doubled delimiter) are skipped.
A piece that is not a number in the base, or a value above U+10FFFF, is an error. Each number
becomes one code point, so the result is Unicode text, not raw bytes.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `comma`, `semicolon`, `colon`, `newline`, `crlf` |
| `base` | integer 2 to 36 | `16` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `48 e9 20 1f44b` | — | `U+0048 U+00E9 U+0020 U+1F44B` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U3OSCxKzk9JVdJRSixKB8pW19bG1gIA&i=M7FQSLVUMDJQMEwzMUkCAA), or search for "From Charcode" in the operation list.

**CLI:**

```sh
unichef op from-charcode '48 e9 20 1f44b'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-charcode", {}, Dish.of_string("48 e9 20 1f44b"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-charcode", {}, { type: 'string', value: "48 e9 20 1f44b" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Code point (Wikipedia)](https://en.wikipedia.org/wiki/Code_point)
- [Unicode glossary: code point](https://www.unicode.org/glossary/#code_point)
- Related: [To Charcode](to-charcode.md), [Unescape Unicode](unescape-unicode.md)

<!-- docs:nav -->
---

[← From Braille](from-braille.md) · [Contents](../../README.md) · [From Decimal →](from-decimal.md)
<!-- /docs:nav -->
