<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base85

Decode Ascii85 (optionally inside `<~ ~>`) or Z85. Without `strict`, it skips characters outside the alphabet.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base85` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each group of five characters is turned back into a base-85 number and written as four
bytes. In Ascii85, 33 is subtracted from each character first, a `z` stands for four zero
bytes, and the `<~` and `~>` delimiters are removed if present. A short last group is padded
with the highest digit (`u`), decoded, and cut back to one byte fewer than its characters.

**Worked example.** `87cURDZ`: the first five characters `87cUR` are the digits 23, 22, 66, 52,
49, which is 1 214 606 444 = `48 65 6c 6c` (`Hell`). The last two, `DZ`, padded to `DZuuu`,
decode to `6f …`, cut to one byte: `o`. Result: `Hello`.

A group whose value is larger than 2³² − 1 is invalid. Without `strict`, characters outside
the alphabet, such as line breaks in a PDF stream, are skipped. Choose `z85` for ZeroMQ data.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `ascii85` | `ascii85`, `z85` |
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `87cURDZ` | — | `Hello` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE61MFXSUUosSgfKVdfWxtYCAA&i=szBPDg1yiQIA), or search for "From Base85" in the operation list.

**CLI:**

```sh
unichef op from-base85 87cURDZ
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base85", {}, Dish.of_string("87cURDZ"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base85", {}, { type: 'string', value: "87cURDZ" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Ascii85 on Wikipedia](https://en.wikipedia.org/wiki/Ascii85)
- [ZeroMQ RFC 32: Z85](https://rfc.zeromq.org/spec/32/)
- Related: [To Base85](to-base85.md), [From Base64](from-base64.md)

<!-- docs:nav -->
---

[← From Base64](from-base64.md) · [Contents](../../README.md) · [From Base92 →](from-base92.md)
<!-- /docs:nav -->
