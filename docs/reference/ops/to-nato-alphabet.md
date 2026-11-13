<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To NATO alphabet

Replace each ASCII letter, digit, `,`, `/` and `.` with its NATO spelling word and a space. Other characters are copied.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-nato-alphabet` | string | string | [Letter codes: Morse, Braille, NATO and leet](../../learn/letter-codes.md) |
<!-- /docs:head -->

## How it works

`to-nato-alphabet` replaces each ASCII letter, digit, `,`, `/` and `.` with its NATO spelling
word followed by one space. Everything else, including spaces and line breaks, is copied.

**Worked example: `Hi 5`**

`H` is `Hotel `, `i` is `India `, the space is copied, and `5` is `Five `: the result is
`Hotel India  Five `, with two spaces before `Five` and one at the end.

The punctuation words are `Comma`, `Fraction bar` and `Full stop`. There is no reverse
operation; the words are easy to read back by eye.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi 5` | — | `Hotel India  Five ` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNSwQSiTkFGYlJqSVKOkqJRelABdW1tbG1AA&i=88hUMAUA), or search for "To NATO alphabet" in the operation list.

**CLI:**

```sh
unichef op to-nato-alphabet 'Hi 5'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-nato-alphabet", {}, Dish.of_string("Hi 5"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-nato-alphabet", {}, { type: 'string', value: "Hi 5" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [NATO phonetic alphabet on Wikipedia](https://en.wikipedia.org/wiki/NATO_phonetic_alphabet)
- Related: [To Morse code](to-morse-code.md)

<!-- docs:nav -->
---

[← To Morse code](to-morse-code.md) · [Contents](../../README.md) · [To Octal →](to-octal.md)
<!-- /docs:nav -->
