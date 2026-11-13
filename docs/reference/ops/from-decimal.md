<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Decimal

Read bytes of 1-3 decimal digits (at most 255). `auto` splits on runs of whitespace and ,:;

| Id | Input | Output | Background |
|---|---|---|---|
| `from-decimal` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each group of one to three decimal digits becomes one byte. A value above 255 does not fit in
a byte and is an error. With the default `auto` delimiter, groups are separated by runs of
whitespace or `,` `:` `;`, so `72,105` and `72 105` both work.

**Worked example.** `72 105` gives the bytes 72 (`H`) and 105 (`i`): `Hi`.

To decode `String.fromCharCode(…)` lists from JavaScript, paste the numbers. If the numbers
go above 255 they are code points, not bytes: use [From Code Points](from-code-points.md) with
`base` set to `decimal` instead.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `auto` | `auto`, `space`, `comma`, `colon`, `newline` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `72 105` | — | `Hi` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1JTc7MTcxR0lFKLEoHSlbX1sbWAgA&i=MzdSMDQwBQA), or search for "From Decimal" in the operation list.

**CLI:**

```sh
unichef op from-decimal '72 105'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-decimal", {}, Dish.of_string("72 105"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-decimal", {}, { type: 'string', value: "72 105" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [ASCII table on Wikipedia](https://en.wikipedia.org/wiki/ASCII#Printable_characters)
- Related: [To Decimal](to-decimal.md), [From Code Points](from-code-points.md)

<!-- docs:nav -->
---

[← From Charcode](from-charcode.md) · [Contents](../../README.md) · [From Hex →](from-hex.md)
<!-- /docs:nav -->
