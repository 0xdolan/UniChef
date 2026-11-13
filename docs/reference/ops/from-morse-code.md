<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Morse code

Read International Morse code. Dashes may be `-`, `_`, hyphens, en or em dashes or the word `dash`; dots may be `.`, `·` or the word `dot`. Words are split on `word_delimiter` and joined with a space; a code that is not in the table is dropped.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-morse-code` | string | string | [Letter codes: Morse, Braille, NATO and leet](../../learn/letter-codes.md) |
<!-- /docs:head -->

## How it works

`from-morse-code` first normalises the signals: `-`, `_`, hyphens, the minus sign, en and em
dashes and the word `dash` (any case) become dashes; `.`, `·` and the word `dot` become dots.
It then splits words on `word_delimiter` and letters on `letter_delimiter`, and looks each code
up.

**Worked example: `.... ..` then a line feed and `.- .-.. .-..`**

The line feed splits two words. `....` is `H` and `..` is `I`; `.-` is `A` and `.-..` is `L`.
The words are joined with a space: `HI ALL`.

A code that is not in the table, such as `......`, is dropped without an error. The output is
always upper case. Seven dots decode as a space.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `letter_delimiter` | choice | `space` | `space`, `newline`, `crlf`, `slash`, `backslash`, `comma`, `semicolon`, `colon` |
| `word_delimiter` | choice | `newline` | `newline`, `crlf`, `slash`, `backslash`, `comma`, `semicolon`, `colon` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `... --- ...` | — | `SOS` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1c3NLypO1U3OT0lV0lFKLEoHylfX1sbWAgA&i=09PTU9DV1VXQ09MDAA), or search for "From Morse code" in the operation list.

**CLI:**

```sh
unichef op from-morse-code '... --- ...'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-morse-code", {}, Dish.of_string("... --- ..."))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-morse-code", {}, { type: 'string', value: "... --- ..." });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Morse code on Wikipedia](https://en.wikipedia.org/wiki/Morse_code)
- Related: [To Morse code](to-morse-code.md)

<!-- docs:nav -->
---

[← From Modhex](from-modhex.md) · [Contents](../../README.md) · [From Octal →](from-octal.md)
<!-- /docs:nav -->
