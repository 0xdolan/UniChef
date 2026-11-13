<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Head

The first `count` lines (keeping a final LF), graphemes or code points.

| Id | Input | Output | Background |
|---|---|---|---|
| `head` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Head keeps the first `count` units of the text.

| `unit` | Counts | `count=3` on `é👋🏽🇮🇶x` |
|---|---|---|
| `lines` | LF-separated lines; a final LF is kept | — |
| `graphemes` | user-perceived characters | `é👋🏽🇮🇶` |
| `code-points` | code points | `é👋` plus the skin-tone modifier on its own |

**Worked example.** `one`, `two`, `three` on three lines with `count=2` gives `one` and `two`,
with the line break after `two` kept.

Use `graphemes` to shorten text for display without cutting an emoji or a flag in half. Cutting
by code points can split `👋🏽` and leave a lone skin-tone modifier.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `count` | integer 0 to 9007199254740991 | `10` | — |
| `unit` | choice | `lines` | `lines`, `graphemes`, `code-points` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `one\ntwo\nthree` | `count=2` | `one\ntwo` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKSE1MUdJRSixKBwpWKyXnl-aVKFkZ1dbG1gIA&i=y89L5Sopz-cqyShKTQUA), or search for "Head" in the operation list.

**CLI:**

```sh
unichef op head --arg count=2
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("head", {"count": 2}, Dish.of_string("one\ntwo\nthree"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("head", {"count": 2}, { type: 'string', value: "one\ntwo\nthree" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #29: grapheme clusters](https://www.unicode.org/reports/tr29/)
- Related: [Tail](tail.md), [Count](count.md), [Grapheme Split](grapheme-split.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Get all casings](get-all-casings.md) · [Contents](../../README.md) · [Join lines →](join.md)
<!-- /docs:nav -->
