<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Trim

Remove White_Space characters from the start, end or both ends of the text, or of every line with `lines` (a final LF is kept).

| Id | Input | Output | Background |
|---|---|---|---|
| `trim` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Trim removes White_Space characters from the start, the end or both ends (`side`). It uses
the Unicode White_Space property, so besides space, tab and line breaks, it also removes
NO-BREAK SPACE (U+00A0), IDEOGRAPHIC SPACE (U+3000), the EN and EM spaces, and others.

**Worked example.** Two spaces, a no-break space, `hi`, an ideographic space and a space
become `hi`.

With `lines`, every line is trimmed separately, and a final LF is kept: `a  ` and `b` plus a
tab, with `side=end`, become `a` and `b`.

Zero-width characters such as ZERO WIDTH SPACE are not White_Space, so Trim keeps them; use
[Detect Invisible](detect-invisible.md) to find them.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `side` | choice | `both` | `both`, `start`, `end` |
| `lines` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `  padded  ` | — | `padded` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqKcrMVdJRSixKBwpW19bG1gIA&i=U1AoSExJSU1RUAAA), or search for "Trim" in the operation list.

**CLI:**

```sh
unichef op trim '  padded  '
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("trim", {}, Dish.of_string("  padded  "))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("trim", {}, { type: 'string', value: "  padded  " });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [PropList.txt: White_Space](https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt)
- Related: [Detect Invisible](detect-invisible.md), [Find / Replace](find-replace.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Tail](tail.md) · [Contents](../../README.md) · [Unique lines →](unique-lines.md)
<!-- /docs:nav -->
