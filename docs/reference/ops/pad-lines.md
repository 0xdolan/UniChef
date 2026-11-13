<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Pad lines

Add `length` code points to the start or end of each line, made by repeating `character` and cutting it to length. A final LF is kept.

| Id | Input | Output | Background |
|---|---|---|---|
| `pad-lines` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`pad-lines` adds the same padding to the start or end of every line. The padding is
`character` repeated and cut to exactly `length` code points.

**Worked example: `x` with length 5 and character `ab`**

`ab` repeated is `ababab…`; the first five code points are `ababa`. With `position` `start`,
the result is `ababax`.

Lengths count code points, so `👋` with length 3 adds three emoji. Blank lines are padded too.
A final line feed is kept, as in the other line operations.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `position` | choice | `start` | `start`, `end` |
| `length` | integer 0 to 1000000 | `5` | — |
| `character` | string | ` ` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `a\nb` | `length=2`, `character=.` | `..a\n..b` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DcoxCsAgDAXQu_zZFtoxV5EOwQYVRCWRLuLd6_zexCdquVXQ5WBDuoH8ROsgdH6PkqsYHFjjlokiNY4Euh1CYuUwRHc9sdazfg&i=S-RKAgA), or search for "Pad lines" in the operation list.

**CLI:**

```sh
unichef op pad-lines --arg length=2 --arg character=.
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("pad-lines", {"length": 2, "character": "."}, Dish.of_string("a\nb"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("pad-lines", {"length": 2, "character": "."}, { type: 'string', value: "a\nb" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [MDN: String.prototype.padStart](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart)
- Related: [Add line numbers](add-line-numbers.md), [Trim](trim.md)

<!-- docs:nav -->
---

[← Join lines](join.md) · [Contents](../../README.md) · [Regex extract →](regex-extract.md)
<!-- /docs:nav -->
