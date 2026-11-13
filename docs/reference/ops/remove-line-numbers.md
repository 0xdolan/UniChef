<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Remove line numbers

At the start of each line, remove up to five spaces or tabs, ASCII digits and one following separator: whitespace (including a line feed) or one of `:|-,.)]`.

| Id | Input | Output | Background |
|---|---|---|---|
| `remove-line-numbers` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`remove-line-numbers` strips a leading number from each line. At the start of a line it looks
for up to five spaces or tabs, one or more ASCII digits, and one separator: whitespace or one
of `:`, `|`, `-`, `,`, `.`, `)` or `]`. All of that is removed.

**Worked example**

| Line | Removed | Left |
|---|---|---|
| `  9 nine` | `  9 ` | `nine` |
| `2:two` | `2:` | `two` |
| `2) two` | `2)` | ` two` |

Only one separator is removed, so `2) two` keeps its space. The separator may be a line feed,
so a line that holds only a number is joined to the next one. A line that starts with a number
but no separator, such as `123abc`, is kept.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `1 one\n2:two` | — | `one\ntwo` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSs3NL0vVzcnMS9XNK81NAqpU0lFKLEoHqqmurY2tBQA&i=M1TIz0vlMrIqKc8HAA), or search for "Remove line numbers" in the operation list.

**CLI:**

```sh
unichef op remove-line-numbers
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("remove-line-numbers", {}, Dish.of_string("1 one\n2:two"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("remove-line-numbers", {}, { type: 'string', value: "1 one\n2:two" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Line number (Wikipedia)](https://en.wikipedia.org/wiki/Line_number)
- Related: [Add line numbers](add-line-numbers.md)

<!-- docs:nav -->
---

[← Remove ANSI escape codes](remove-ansi-escape-codes.md) · [Contents](../../README.md) · [Remove null bytes →](remove-null-bytes.md)
<!-- /docs:nav -->
