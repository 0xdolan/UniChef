<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Split

Split on the literal `delimiter` and join the parts with `join`.

| Id | Input | Output | Background |
|---|---|---|---|
| `split` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Split cuts the text at every occurrence of the literal `delimiter` and joins the parts with
`join` (a new line by default). The delimiter is plain text, not a regex.

**Worked example.** `a;b;c` with `delimiter=;` and `join= + ` gives `a + b + c`. With the
defaults, `a,b,c` becomes three lines.

Splitting into lines lets line-based operations work on parts of one line: split a
comma-separated list, then [Sort Lines](sort-lines.md) and [Unique Lines](unique-lines.md),
then [Join](join.md) it back. To run a recipe on each part, use [Fork](fork.md).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | string | `,` | — |
| `join` | string | `\n` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `a,b,c` | `delimiter=,`, `join=
` | `a\nb\nc` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DYuxCoAwDAX_5c1ZXPsr6lAwSKQ2pSkuIf9uuO2Oc3w8TbSjbARbPAxld-hAgY0mC4Q677SOi5u8snhmo-RRyQ9HR8QZPw&i=S9RJ0kkGAA), or search for "Split" in the operation list.

**CLI:**

```sh
unichef op split --arg delimiter=, --arg 'join=
' a,b,c
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("split", {"delimiter": ",", "join": "\n"}, Dish.of_string("a,b,c"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("split", {"delimiter": ",", "join": "\n"}, { type: 'string', value: "a,b,c" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Python str.split](https://docs.python.org/3/library/stdtypes.html#str.split)
- Related: [Join](join.md), [Fork](fork.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Sort lines](sort-lines.md) · [Contents](../../README.md) · [Strip HTML tags →](strip-html-tags.md)
<!-- /docs:nav -->
