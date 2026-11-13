<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# A1Z26 decode

Split on `delimiter` and write each number from 1 to 26 as a lower-case letter. Spaces, tabs and line breaks around a number are ignored. Anything else is `E_DECODE`.

| Id | Input | Output | Background |
|---|---|---|---|
| `a1z26-decode` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

`a1z26-decode` splits the input on `delimiter` and writes each number from 1 to 26 as a
lower-case letter. Spaces, tabs and line breaks around each number are ignored, so a trailing
line feed is fine.

**Worked example: `8 5 12 12 15`**

8 is `h`, 5 is `e`, 12 is `l` and 15 is `o`: `hello`.

Any piece that is not a number from 1 to 26 stops the operation with `E_DECODE`: `0`, `27`,
`+1`, a letter, or an empty piece from two delimiters in a row. That usually means the
delimiter is wrong.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `comma`, `semicolon`, `colon`, `newline`, `crlf` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `8 5 12 12 15` | — | `hello` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKNKwyMtNNSU3OT0lV0lFKLEoHSlbX1sbWAgA&i=s1AwVTA0AiNTAA), or search for "A1Z26 decode" in the operation list.

**CLI:**

```sh
unichef op a1z26-decode '8 5 12 12 15'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("a1z26-decode", {}, Dish.of_string("8 5 12 12 15"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("a1z26-decode", {}, { type: 'string', value: "8 5 12 12 15" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [A1Z26 on dCode](https://www.dcode.fr/letter-number-cipher)
- Related: [A1Z26 encode](a1z26-encode.md)

<!-- docs:nav -->
---

[← SHAKE](shake.md) · [Contents](../../README.md) · [A1Z26 encode →](a1z26-encode.md)
<!-- /docs:nav -->
