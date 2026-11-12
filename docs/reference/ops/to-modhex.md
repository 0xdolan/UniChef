<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Modhex

Write each byte as two Modhex digits, separated by `delimiter`. With `bytes_per_line`, a line feed follows the delimiter after every that many bytes.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-modhex` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Modhex is hexadecimal with a different set of sixteen letters: `cbdefghijklnrtuv` stand for
`0–f`. YubiKeys use it because these letters sit in the same place on most keyboard layouts, so
the key types the same text whatever layout the computer uses.

**Worked example: `Hi!`**

| Byte | Hex | Modhex |
|---|---|---|
| `H` | `48` | `fj` |
| `i` | `69` | `hk` |
| `!` | `21` | `db` |

Result: `fj hk db`. With `bytes_per_line` set to N, a line feed follows the delimiter after
every N bytes (except the last), so long output wraps.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `percent`, `comma`, `semicolon`, `colon`, `newline`, `crlf`, `none` |
| `bytes_per_line` | integer ≥ 0 | `0` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi!` | — | `fj hk db` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNzU_JSK1Q0lFKLEoHylTX1sbWAgA&i=88hUBAA), or search for "To Modhex" in the operation list.

**CLI:**

```sh
unichef op to-modhex 'Hi!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-modhex", {}, Dish.of_string("Hi!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-modhex", {}, { type: 'string', value: "Hi!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Modhex (Yubico developer docs)](https://developers.yubico.com/OTP/Modhex_Converter.html)
- [Hexadecimal (Wikipedia)](https://en.wikipedia.org/wiki/Hexadecimal)
- Related: [From Modhex](from-modhex.md), [To Hex](to-hex.md)

<!-- docs:nav -->
---

[← To Hex](to-hex.md) · [Contents](../../README.md) · [To Octal →](to-octal.md)
<!-- /docs:nav -->
