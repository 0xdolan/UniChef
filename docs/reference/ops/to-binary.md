<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Binary

Write each byte as eight binary digits, separated by `delimiter`.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-binary` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each byte is written as its eight bits, most significant first, padded with leading zeros.
A bit is worth 2⁷ = 128 in the first position down to 2⁰ = 1 in the last.

**Worked example: `Hi`**

| Byte | Value | 128 | 64 | 32 | 16 | 8 | 4 | 2 | 1 | Binary |
|---|---|---|---|---|---|---|---|---|---|---|
| `H` | 72 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | `01001000` |
| `i` | 105 | 0 | 1 | 1 | 0 | 1 | 0 | 0 | 1 | `01101001` |

72 = 64 + 8 and 105 = 64 + 32 + 8 + 1. Result: `01001000 01101001`.

Binary is useful for seeing bit flags, the UTF-8 lead and continuation bit patterns, and XOR
results. In ASCII, bit 5 (value 32) is the only difference between `A` (`01000001`) and `a`
(`01100001`).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `comma`, `colon`, `newline`, `none` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | — | `01001000 01101001` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNysxLLKpU0lFKLEoHylTX1sbWAgA&i=88gEAA), or search for "To Binary" in the operation list.

**CLI:**

```sh
unichef op to-binary Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-binary", {}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-binary", {}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Binary number on Wikipedia](https://en.wikipedia.org/wiki/Binary_number)
- Related: [From Binary](from-binary.md), [To Hex](to-hex.md), [UTF-8 Explain](utf8-explain.md)

<!-- docs:nav -->
---

[← To Base85](to-base85.md) · [Contents](../../README.md) · [To Decimal →](to-decimal.md)
<!-- /docs:nav -->
