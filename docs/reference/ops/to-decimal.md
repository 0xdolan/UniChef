<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Decimal

Write each byte as a decimal number without padding, separated by `delimiter`.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-decimal` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each byte is written as an ordinary base-10 number from 0 to 255, without leading zeros.
`H` is 72 and `i` is 105, so `Hi` becomes `72 105`.

This is the format of byte arrays in many languages (`[72, 105]` in Python or Java) and of
`String.fromCharCode(72, 105)` in JavaScript, a common way to hide strings in obfuscated
scripts. Note that it works on **bytes**: `é` gives two numbers, `195 169`. For one number per
character, use [To Code Points](to-code-points.md) with the `decimal` format.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `comma`, `colon`, `newline` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | — | `72 105` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSU3OzE3MUdJRSixKB0pV19bG1gIA&i=88gEAA), or search for "To Decimal" in the operation list.

**CLI:**

```sh
unichef op to-decimal Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-decimal", {}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-decimal", {}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [ASCII table on Wikipedia](https://en.wikipedia.org/wiki/ASCII#Printable_characters)
- Related: [From Decimal](from-decimal.md), [To Code Points](to-code-points.md)

<!-- docs:nav -->
---

[← To Charcode](to-charcode.md) · [Contents](../../README.md) · [To Float →](to-float.md)
<!-- /docs:nav -->
