<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# A1Z26 encode

Write each ASCII letter as its place in the alphabet (`a` and `A` are 1, `z` and `Z` are 26), joined by `delimiter`. Other characters are dropped.

| Id | Input | Output | Background |
|---|---|---|---|
| `a1z26-encode` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

`a1z26-encode` writes each ASCII letter as its position in the alphabet, `a` and `A` as 1
through `z` and `Z` as 26, and joins the numbers with `delimiter`. Other characters, including
spaces and digits, are dropped.

**Worked example: `Hello`**

H is the 8th letter, e the 5th, l the 12th and o the 15th: `8 5 12 12 15`.

Because spaces are dropped, word breaks are lost. Letters outside ASCII, such as `é`, are
dropped too; run [Strip diacritics](strip-diacritics.md) first to keep their base letters.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `comma`, `semicolon`, `colon`, `newline`, `crlf` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello` | — | `8 5 12 12 15` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKNKwyMtNNzUvOT0lV0lFKLEoHSlbX1sbWAgA&i=80jNyckHAA), or search for "A1Z26 encode" in the operation list.

**CLI:**

```sh
unichef op a1z26-encode Hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("a1z26-encode", {}, Dish.of_string("Hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("a1z26-encode", {}, { type: 'string', value: "Hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [A1Z26 on dCode](https://www.dcode.fr/letter-number-cipher)
- Related: [A1Z26 decode](a1z26-decode.md), [Classical ciphers](../../learn/classical-ciphers.md)

<!-- docs:nav -->
---

[← A1Z26 decode](a1z26-decode.md) · [Contents](../../README.md) · [AES Decrypt →](aes-decrypt.md)
<!-- /docs:nav -->
