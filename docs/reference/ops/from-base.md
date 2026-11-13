<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base

Read a number written in a radix from 2 to 36 and write it in decimal. Digits are case-insensitive, whitespace is ignored and a leading + or - is allowed. A fraction gets at most 20 decimal places, rounded half up.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base` | string | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

`from-base` reads a number written in a radix from 2 to 36 and prints it in decimal. Digits
are `0–9` then `a–z`, in either case.

**Worked example: `ff` in base 16**

1. `f` is 15. Each digit is worth 16 times the one to its right.
2. 15 × 16 + 15 = **255**.

Digits after a `.` are a fraction: `10.1` in base 2 is 2 + 1/2 = `2.5`. The result is exact and
then rounded half up to 20 decimal places, with trailing zeros removed. A digit that is not
valid in the radix (such as `2` in base 2) is an error rather than a silent stop.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `radix` | integer 2 to 36 | `36` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `ff` | `radix=16` | `255` |
| `10.1` | `radix=2` | `2.5` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE5V0lFKLEoHylQrFSWmZFYAFZvV1sbWAgA&i=S0sDAA), or search for "From Base" in the operation list.

**CLI:**

```sh
unichef op from-base --arg radix=16 ff
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base", {"radix": 16}, Dish.of_string("ff"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base", {"radix": 16}, { type: 'string', value: "ff" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Radix (Wikipedia)](https://en.wikipedia.org/wiki/Radix)
- [Positional notation (Wikipedia)](https://en.wikipedia.org/wiki/Positional_notation)
- Related: [To Base](to-base.md), [From Hex](from-hex.md)

<!-- docs:nav -->
---

[← Encode Text](encode-text.md) · [Contents](../../README.md) · [From Base32 →](from-base32.md)
<!-- /docs:nav -->
