<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# From Code Points

Read code points separated by whitespace, commas or semicolons. A `U+` or `0x` prefix always means hex; bare numbers use `base`. Surrogates are kept as code points (they become U+FFFD if the dish is later used as text).

| Id | Input | Output | Background |
|---|---|---|---|
| `from-code-points` | string | codepoints | [Text and bytes](../../learn/text-and-bytes.md) |
<!-- /docs:head -->

## How it works

From Code Points reads a list of numbers and turns each into the character with that code
point. Numbers can be separated by whitespace, commas or semicolons. A `U+` or `0x` prefix
always means hex; a bare number is read in the `base` you choose.

**Worked example.** With `base=decimal`, `U+0048 69 0x1F44B` gives `H` (hex 48), `E` (decimal
69) and `👋` (hex 1F44B): `HE👋`. With the default `base=hex`, the bare `69` is U+0069 `i`, so
the result is `Hi👋`.

A number above 10FFFF is an error. Surrogates (D800–DFFF) are kept as code points, so
[Analyse Characters](analyse-characters.md) can show them, but they become U+FFFD when the
result is turned into bytes, because UTF-8 cannot encode them.

Use it to decode `String.fromCodePoint(…)` lists, the `\N{U+…}` notation of documentation,
or numbers copied from a character table.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `base` | choice | `hex` | `hex`, `decimal` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `48 69 1F44B` | — | `U+0048 U+0069 U+1F44B` |
| `72 105 128075` | `base=decimal` | `U+0048 U+0069 U+1F44B` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U3OT0nVLcjPzCspVtJRSixKByqorq2NrQUA&i=M7FQMLNUMHQzMXECAA), or search for "From Code Points" in the operation list.

**CLI:**

```sh
unichef op from-code-points '48 69 1F44B'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-code-points", {}, Dish.of_string("48 69 1F44B"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-code-points", {}, { type: 'string', value: "48 69 1F44B" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Unicode Standard, chapter 3: code points and encoding forms](https://www.unicode.org/versions/latest/core-spec/chapter-3/)
- Related: [To Code Points](to-code-points.md), [From Decimal](from-decimal.md), [Unescape Unicode](unescape-unicode.md)

<!-- docs:nav -->
---

[← Filter by Property](filter-by-property.md) · [Contents](../../README.md) · [Grapheme Split →](grapheme-split.md)
<!-- /docs:nav -->
