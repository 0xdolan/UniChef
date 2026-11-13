<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Binary

Read bytes of 1-8 binary digits. `auto` splits on runs of whitespace and ,:; and `none` reads groups of exactly eight digits.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-binary` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each group of binary digits is read as one byte: every digit doubles the running value and
adds itself. `01101001` is ((((((0×2+1)×2+1)×2+0)×2+1)×2+0)×2+0)×2+1 = 105, the letter `i`.

With the default `auto` delimiter, groups are separated by runs of whitespace or `,` `:`
`;`, and a group may have one to eight digits, so `1001000 1101001` (leading zeros dropped)
also works. With `none`, the input is one long string of bits read eight at a time, which is
how binary often appears in CTF puzzles; its length must then be a multiple of eight.

**Worked example.** `01001000 01101001` gives 72 and 105, which is `Hi`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `auto` | `auto`, `space`, `comma`, `colon`, `newline`, `none` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `01001000 01101001` | — | `Hi` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U3KzEssqlTSUUosSgfKVdfWxtYCAA&i=MzA0MAAiAwUDQ0MQwxAA), or search for "From Binary" in the operation list.

**CLI:**

```sh
unichef op from-binary '01001000 01101001'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-binary", {}, Dish.of_string("01001000 01101001"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-binary", {}, { type: 'string', value: "01001000 01101001" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Binary number on Wikipedia](https://en.wikipedia.org/wiki/Binary_number)
- Related: [To Binary](to-binary.md), [From Hex](from-hex.md)

<!-- docs:nav -->
---

[← From Bech32](from-bech32.md) · [Contents](../../README.md) · [From Braille →](from-braille.md)
<!-- /docs:nav -->
