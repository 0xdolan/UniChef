<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Tail

The last `count` lines (keeping a final LF), graphemes or code points.

| Id | Input | Output | Background |
|---|---|---|---|
| `tail` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Tail keeps the last `count` units of the text: lines (split at LF, a final LF is kept),
graphemes or code points.

**Worked example.** `one`, `two`, `three` on three lines (ending with a line break) with
`count=1` gives `three` and its line break.

Use it on a log to see the latest entries, or with `graphemes` to keep the end of a string
without splitting a character. With `code-points`, the result can start with a combining mark
or a skin-tone modifier whose base was cut off.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `count` | integer 0 to 9007199254740991 | `10` | — |
| `unit` | choice | `lines` | `lines`, `graphemes`, `code-points` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `one\ntwo\nthree` | `count=2` | `two\nthree` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSczMUdJRSixKBwpWKyXnl-aVKFkZ1dbG1gIA&i=y89L5Sopz-cqyShKTQUA), or search for "Tail" in the operation list.

**CLI:**

```sh
unichef op tail --arg count=2
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("tail", {"count": 2}, Dish.of_string("one\ntwo\nthree"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("tail", {"count": 2}, { type: 'string', value: "one\ntwo\nthree" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #29: grapheme clusters](https://www.unicode.org/reports/tr29/)
- Related: [Head](head.md), [Count](count.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Swap case](swap-case.md) · [Contents](../../README.md) · [To Camel case →](to-camel-case.md)
<!-- /docs:nav -->
