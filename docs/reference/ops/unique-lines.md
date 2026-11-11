<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Unique lines

Keep the first of each set of equal lines, in input order. `ignore_case` compares full case folds; `count` prefixes each line with its number of copies and a tab.

| Id | Input | Output | Background |
|---|---|---|---|
| `unique-lines` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Unique Lines keeps the first of each set of equal lines, in input order. Unlike the Unix
`uniq`, the duplicates do not need to be next to each other, so you do not have to sort first.

**Worked examples.**
- With `count`, `a`, `b`, `a`, `A` gives `2⇥a`, `1⇥b`, `1⇥A` (count, a tab, the line).
- With `ignore_case`, `a`, `b`, `A` gives `a` and `b`: lines are compared by their full case
  folds, so `A` is a copy of `a`.

Combine it with [Regex Extract](regex-extract.md) to list each distinct IP address, domain or
e-mail address in a log, and with [Sort Lines](sort-lines.md) to order them.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `ignore_case` | boolean | `false` | — |
| `count` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `b\na\nb\nc\na` | — | `b\na\nc` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzcssLE3VzcnMSy1W0lFKLEoHSlbX1sbWAgA&i=S-JK5EriSuZKBAA), or search for "Unique lines" in the operation list.

**CLI:**

```sh
unichef op unique-lines
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("unique-lines", {}, Dish.of_string("b\na\nb\nc\na"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("unique-lines", {}, { type: 'string', value: "b\na\nb\nc\na" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [GNU coreutils: uniq](https://www.gnu.org/software/coreutils/manual/html_node/uniq-invocation.html)
- Related: [Sort Lines](sort-lines.md), [Regex Extract](regex-extract.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Trim](trim.md) · [Contents](../../README.md) · [Comment →](comment.md)
<!-- /docs:nav -->
