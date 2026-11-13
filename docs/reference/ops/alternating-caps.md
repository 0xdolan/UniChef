<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Alternating caps

Lower-case the first letter, upper-case the next, and so on. Only letters (General_Category L*) take part; other characters are copied and do not break the alternation.

| Id | Input | Output | Background |
|---|---|---|---|
| `alternating-caps` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`alternating-caps` walks through the letters and switches case at each one: the first letter is
lower-cased, the second upper-cased, and so on. A letter is any character in General_Category
L (Lu, Ll, Lt, Lm, Lo).

**Worked example: `Hello, world!`**

The letters are `H e l l o w o r l d`. They become `h E l L o W o R l D`, and the comma,
space and `!` are copied without breaking the pattern. Result: `hElLo, WoRlD!`.

Letters without case, such as `中`, still take a turn, so the next letter's case is not
affected by whether a letter could change.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello world` | — | `hElLo WoRlD` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKzClJLcpLLMnMS9dNTgTK6CglFqUDFVTX1sbWAgA&i=80jNyclXKM8vykkBAA), or search for "Alternating caps" in the operation list.

**CLI:**

```sh
unichef op alternating-caps 'Hello world'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("alternating-caps", {}, Dish.of_string("Hello world"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("alternating-caps", {}, { type: 'string', value: "Hello world" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Unicode case mapping FAQ](https://www.unicode.org/faq/casemap_charprop.html)
- [General Category (Unicode)](https://www.unicode.org/reports/tr44/#General_Category_Values)
- Related: [Swap case](swap-case.md)

<!-- docs:nav -->
---

[← Add line numbers](add-line-numbers.md) · [Contents](../../README.md) · [Find / replace →](find-replace.md)
<!-- /docs:nav -->
