<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Join lines

Join the lines with `delimiter`. A final LF is dropped.

| Id | Input | Output | Background |
|---|---|---|---|
| `join` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Join puts the lines of the input together, separated by `delimiter`. A final LF is dropped
first, so it does not create an empty last item.

**Worked example.** `a`, `b`, `c` on three lines (ending with a line break) with
`delimiter= | ` gives `a | b | c`.

Typical uses: turn a list of IP addresses into a comma-separated filter, or build a regex
alternation by joining with `|`. [Split](split.md) does the reverse.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | string | `,` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `one\ntwo\nthree` | `delimiter=, ` | `one, two, three` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKys_MU9JRSixKBwpWK6Wk5mTmZpakFgGldBSUamtjawE&i=y89L5Sopz-cqyShKTQUA), or search for "Join lines" in the operation list.

**CLI:**

```sh
unichef op join --arg 'delimiter=, '
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("join", {"delimiter": ", "}, Dish.of_string("one\ntwo\nthree"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("join", {"delimiter": ", "}, { type: 'string', value: "one\ntwo\nthree" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Python str.join](https://docs.python.org/3/library/stdtypes.html#str.join)
- Related: [Split](split.md), [Sort Lines](sort-lines.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Head](head.md) · [Contents](../../README.md) · [Regex extract →](regex-extract.md)
<!-- /docs:nav -->
