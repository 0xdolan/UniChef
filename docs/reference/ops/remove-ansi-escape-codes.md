<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Remove ANSI escape codes

Remove ANSI control sequences (ESC `[`, parameter bytes, intermediate bytes and a final byte), such as colour and cursor codes.

| Id | Input | Output | Background |
|---|---|---|---|
| `remove-ansi-escape-codes` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Terminals read **ANSI escape sequences** to set colours, move the cursor or clear the screen.
`remove-ansi-escape-codes` removes the most common kind, the control sequence: ESC (0x1B),
`[`, any parameter bytes (`0`–`?`), any intermediate bytes (space to `/`) and one final byte
(`@` to `~`).

**Worked example: `ESC[1;31mredESC[0m`**

`ESC[1;31m` (bold red) and `ESC[0m` (reset) are both control sequences, so the result is
`red`.

Use it to clean up logs captured from a coloured terminal. A lone ESC that does not start a
sequence is kept, and a broken sequence takes the next valid final byte with it.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `\u001b[1;31mred\u001b[0m` | — | `red` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DcoxDoAgDAXQu_wZBtZexTg0-GMYpIQaFtK765vfxuL0Zh1SEvzlcMixYQOCyccWs3ZvmV51MFe76EjQef9xR5zxAQ&i=k442tDY2zC1KTZGONsgFAA), or search for "Remove ANSI escape codes" in the operation list.

**CLI:**

```sh
unichef op remove-ansi-escape-codes $'\u001b[1;31mred\u001b[0m'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("remove-ansi-escape-codes", {}, Dish.of_string("\u001b[1;31mred\u001b[0m"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("remove-ansi-escape-codes", {}, { type: 'string', value: "\u001b[1;31mred\u001b[0m" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [ANSI escape code (Wikipedia)](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [ECMA-48: control functions](https://ecma-international.org/publications-and-standards/standards/ecma-48/)
- Related: [Strip HTML tags](strip-html-tags.md)

<!-- docs:nav -->
---

[← Regex extract](regex-extract.md) · [Contents](../../README.md) · [Remove line numbers →](remove-line-numbers.md)
<!-- /docs:nav -->
