<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Morse code

Write each character as International Morse code. Letters are joined by `letter_delimiter` and words (split on runs of spaces) by `word_delimiter`; lines stay on their own lines. A character with no code is written as nothing but still gets its delimiters.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-morse-code` | string | string | [Letter codes: Morse, Braille, NATO and leet](../../learn/letter-codes.md) |
<!-- /docs:head -->

## How it works

`to-morse-code` looks up each character in the International Morse table: A–Z (either
case), 0–9 and `.,:;!?'"/-+()@=&_$`. Codes are joined with `letter_delimiter`, words (split on
runs of spaces) with `word_delimiter`, and lines stay on separate lines.

**Worked example: `Hi all` with the defaults**

`H` is `....` and `i` is `..`, so the first word is `.... ..`. The space starts a new word,
which goes on a new line because the default word delimiter is a line feed: `.- .-.. .-..`.

`format` picks how dashes and dots are written: `Dash/Dot` turns `SOS` into
`DotDotDot DashDashDash DotDotDot`. A character with no code, such as `é` or a tab, is written
as nothing, but its letter delimiters stay. See [Letter codes](../../learn/letter-codes.md) for more.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `format` | choice | `-/.` | `-/.`, `_/.`, `Dash/Dot`, `DASH/DOT`, `dash/dot` |
| `letter_delimiter` | choice | `space` | `space`, `newline`, `crlf`, `slash`, `backslash`, `comma`, `semicolon`, `colon` |
| `word_delimiter` | choice | `newline` | `newline`, `crlf`, `slash`, `backslash`, `comma`, `semicolon`, `colon` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `SOS` | — | `... --- ...` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNzS8qTtVNzk9JVdJRSixKB8pW19bG1gIA&i=C_YPBgA), or search for "To Morse code" in the operation list.

**CLI:**

```sh
unichef op to-morse-code SOS
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-morse-code", {}, Dish.of_string("SOS"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-morse-code", {}, { type: 'string', value: "SOS" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Morse code on Wikipedia](https://en.wikipedia.org/wiki/Morse_code)
- [ITU-R M.1677-1, International Morse code](https://www.itu.int/rec/R-REC-M.1677-1-200910-I/)
- Related: [From Morse code](from-morse-code.md), [To NATO alphabet](to-nato-alphabet.md)

<!-- docs:nav -->
---

[← To Modhex](to-modhex.md) · [Contents](../../README.md) · [To NATO alphabet →](to-nato-alphabet.md)
<!-- /docs:nav -->
