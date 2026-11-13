<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Braille

Replace each six-dot Braille pattern (U+2800 to U+283F) with its North American Braille ASCII character; letters come out in upper case. Other characters are copied.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-braille` | string | string | [Letter codes: Morse, Braille, NATO and leet](../../learn/letter-codes.md) |
<!-- /docs:head -->

## How it works

`from-braille` replaces each six-dot pattern, U+2800 to U+283F, with its North American
Braille ASCII character. Letters come out in upper case, because the table has one pattern per
letter.

**Worked example: `⠓⠊⠮`**

U+2813 is `H`, U+280A is `I` and U+282E is `!`, so the result is `HI!`. The blank pattern
U+2800 is a space.

Eight-dot patterns (U+2840 to U+28FF) and all other characters are copied.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `⠓⠊⠮` | — | `HI!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U0qSszMyUlV0lFKLEoHSlbX1sbWAgA&i=e7Rg8qMFXY8WrAMA), or search for "From Braille" in the operation list.

**CLI:**

```sh
unichef op from-braille '⠓⠊⠮'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-braille", {}, Dish.of_string("⠓⠊⠮"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-braille", {}, { type: 'string', value: "⠓⠊⠮" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Braille ASCII on Wikipedia](https://en.wikipedia.org/wiki/Braille_ASCII)
- Related: [To Braille](to-braille.md)

<!-- docs:nav -->
---

[← From Binary](from-binary.md) · [Contents](../../README.md) · [From Charcode →](from-charcode.md)
<!-- /docs:nav -->
