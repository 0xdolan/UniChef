<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Leet speak

`to` replaces the ASCII letters a, e, i, o, s and t, in either case, with 4, 3, 1, 0, 5 and 7. `from` replaces those digits with the lower-case letters. Other characters are copied.

| Id | Input | Output | Background |
|---|---|---|---|
| `leet-speak` | string | string | [Letter codes: Morse, Braille, NATO and leet](../../learn/letter-codes.md) |
<!-- /docs:head -->

## How it works

`leet-speak` swaps six ASCII letters for digits that look like them, or back.

| Letter | a | e | i | o | s | t |
|---|---|---|---|---|---|---|
| Digit | 4 | 3 | 1 | 0 | 5 | 7 |

**Worked example: `Leet speak` with `to`**

`e` becomes `3`, `t` becomes `7`, `s` becomes `5` and `a` becomes `4`; other letters are kept:
`L337 5p34k`.

`from` turns the digits into lower-case letters, so `L337 5P34K` becomes `Leet sPeaK`. It
changes every 0, 1, 3, 4, 5 and 7 in the text, including real numbers.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `direction` | choice | `to` | `to`, `from` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Leet speak` | — | `L337 5p34k` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKSU0t0S0uSE3MVtJRSixKB0pV19bG1gIA&i=80lNLVEoLkhNzAYA), or search for "Leet speak" in the operation list.

**CLI:**

```sh
unichef op leet-speak 'Leet speak'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("leet-speak", {}, Dish.of_string("Leet speak"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("leet-speak", {}, { type: 'string', value: "Leet speak" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Leet on Wikipedia](https://en.wikipedia.org/wiki/Leet)
- Related: [Letter codes](../../learn/letter-codes.md), [Swap case](swap-case.md)

<!-- docs:nav -->
---

[← Join lines](join.md) · [Contents](../../README.md) · [Pad lines →](pad-lines.md)
<!-- /docs:nav -->
