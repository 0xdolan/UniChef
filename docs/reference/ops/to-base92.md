<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Base92

Encode bytes as Base92: every 13 bits become two printable ASCII characters.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-base92` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Base92 reads the input as a stream of bits and writes every **13 bits** as **two
characters**. Its 91 digits are `!`, then `#` to `_`, then `a` to `}`: printable ASCII
without the double quote, the backtick and the tilde, so the output can sit inside a quoted
string. Two digits hold 91 × 91 = 8281 values, enough for 13 bits (8192).

**Worked example: `Hello`**

1. The bytes are 40 bits: `0100100001100 1010110110001 1011000110111 1`.
2. Each 13-bit group is a number, split into two digits by dividing by 91:
   2316 = 25 × 91 + 41, 5553 = 61 × 91 + 2, 5687 = 62 × 91 + 45.
3. The digits pick characters: 25 is `;`, 41 is `K`, 61 is `_`, 2 is `$`, 62 is `a`,
   45 is `O`.
4. One bit is left. Fewer than seven left-over bits are padded with zeros to 6 bits and
   written as **one** character: `100000` is 32, which is `B`. Seven or more are padded to
   13 bits and written as two.

Result: `;K_$aOB`.

The output is about 1.23 times the input, slightly smaller than [Base85](to-base85.md).
Empty input gives empty output; the reference implementation writes `~` for it instead.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello` | — | `;K_$aOB` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNSixOtTRS0lFKLEoHylTX1sbWAgA&i=80jNyckHAA), or search for "To Base92" in the operation list.

**CLI:**

```sh
unichef op to-base92 Hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-base92", {}, Dish.of_string("Hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-base92", {}, { type: 'string', value: "Hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [base92: the reference implementation and format notes](https://github.com/thenoviceoof/base92)
- Related: [From Base92](from-base92.md), [To Base85](to-base85.md)

<!-- docs:nav -->
---

[← To Base85](to-base85.md) · [Contents](../../README.md) · [To Binary →](to-binary.md)
<!-- /docs:nav -->
