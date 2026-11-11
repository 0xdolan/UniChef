<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Octal

Write each byte as three octal digits, separated by `delimiter`.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-octal` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Octal is base 8: each digit holds three bits. A byte needs at most three octal digits
(the largest byte, 255, is `377`), and UniChef always writes three, padding with zeros.

**Worked example: `é`**

`é` is the UTF-8 bytes `c3 a9`. The byte 195 = `11 000 011` in groups of three bits from the
right gives `3 0 3`, so `303`. The byte 169 = `10 101 001` gives `251`. Result: `303 251`.

Octal survives in Unix file permissions (`chmod 755`), in C and shell escapes (`\303\251`) and
in old protocols. `printf '\303\251'` prints `é`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `space`, `comma`, `colon`, `newline`, `none` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | — | `110 151` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNTy5JzFHSUUosSgdKVNfWxtYCAA&i=88gEAA), or search for "To Octal" in the operation list.

**CLI:**

```sh
unichef op to-octal Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-octal", {}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-octal", {}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Octal on Wikipedia](https://en.wikipedia.org/wiki/Octal)
- Related: [From Octal](from-octal.md), [To Hex](to-hex.md)

<!-- docs:nav -->
---

[← To Hex](to-hex.md) · [Contents](../../README.md) · [To Punycode →](to-punycode.md)
<!-- /docs:nav -->
