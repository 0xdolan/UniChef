<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Braille

Replace each character of North American Braille ASCII (space, ASCII letters in either case, digits and `!"#$%&'()*+,-./:;<=>?@[\]^_`) with its six-dot Braille pattern, U+2800 to U+283F. Other characters are copied.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-braille` | string | string | [Letter codes: Morse, Braille, NATO and leet](../../learn/letter-codes.md) |
<!-- /docs:head -->

## How it works

`to-braille` uses North American Braille ASCII, which pairs each of the 64 six-dot Braille
patterns (U+2800 to U+283F) with one ASCII character. Lower-case letters use the same patterns
as upper case.

**Worked example: `Hi!`**

`H` is the 20th entry of the table, U+2813 `⠓` (dots 1, 2 and 5); `I` is U+280A `⠊`; `!` is
U+282E `⠮`. The result is `⠓⠊⠮`.

Characters outside the table (such as `é`, `` ` `` and `{`) are copied. This is a character
table, not Grade 1 or Grade 2 reading Braille, so there are no capital or number signs.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi!` | — | `⠓⠊⠮` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNKkrMzMlJVdJRSixKB0pV19bG1gIA&i=88hUBAA), or search for "To Braille" in the operation list.

**CLI:**

```sh
unichef op to-braille 'Hi!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-braille", {}, Dish.of_string("Hi!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-braille", {}, { type: 'string', value: "Hi!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Braille ASCII on Wikipedia](https://en.wikipedia.org/wiki/Braille_ASCII)
- [Unicode Braille Patterns chart (PDF)](https://www.unicode.org/charts/PDF/U2800.pdf)
- Related: [From Braille](from-braille.md)

<!-- docs:nav -->
---

[← To Binary](to-binary.md) · [Contents](../../README.md) · [To Charcode →](to-charcode.md)
<!-- /docs:nav -->
