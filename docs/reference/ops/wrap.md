<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Wrap

Break each line into lines of at most `width` characters. Existing line breaks, blank lines and a CR before a line feed are kept.

| Id | Input | Output | Background |
|---|---|---|---|
| `wrap` | string | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

Each line is cut into pieces of at most `width` characters (code points), counted without
looking for spaces. Existing line breaks stay, blank lines stay blank, and a CR before a line
feed stays at the end of the last piece.

**Worked example: `abcdefghij`, CR LF, an empty line, `xy`, with `width=5`**

`abcdefghij` becomes `abcde` and `fghij`; the CR stays after `fghij`; the empty line and `xy`
are copied.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `width` | integer 1 to 65536 | `64` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abcdefg` | `width=3` | `abc\ndef\ng` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqL0osUNJRSixKBwpWK5VnppRkKFkZ19bG1gIA&i=S0xKTklNSwcA), or search for "Wrap" in the operation list.

**CLI:**

```sh
unichef op wrap --arg width=3 abcdefg
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("wrap", {"width": 3}, Dish.of_string("abcdefg"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("wrap", {"width": 3}, { type: 'string', value: "abcdefg" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Line wrap and word wrap on Wikipedia](https://en.wikipedia.org/wiki/Line_wrap_and_word_wrap)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [Pad lines](pad-lines.md)

<!-- docs:nav -->
---

[← Unique lines](unique-lines.md) · [Contents](../../README.md) · [Comment →](comment.md)
<!-- /docs:nav -->
