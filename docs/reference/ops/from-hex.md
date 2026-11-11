<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Hex

Read hex digit pairs. `auto` strips 0x and \x prefixes, whitespace and ,:;-.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-hex` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

From Hex reads pairs of hex digits and turns each pair into one byte: the first digit is the
high nibble (×16) and the second the low nibble. `c3` is 12 × 16 + 3 = 195.

With the default `auto` delimiter it first removes everything that commonly surrounds hex in
the wild: `0x` and `\x` prefixes, whitespace, and the separators `,` `:` `;` `-`. So all of
these give the same bytes:

```
48656c6c6f
48 65 6c 6c 6f
0x48, 0x65, 0x6c, 0x6c, 0x6f
\x48\x65\x6c\x6c\x6f
48:65:6c:6c:6f
```

Upper and lower case digits are both accepted. What remains must be an even number of hex
digits: an odd count or a character such as `g` is an error, because there is no safe way
to guess which byte is incomplete. Choose a specific delimiter to be strict about the format.

**Worked example.** `48 c3 a9 6c 6c 6f` gives the bytes 72, 195, 169, 108, 108, 111. As UTF-8
text that is `Héllo`, because `c3 a9` is the encoding of `é`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `auto` | `auto`, `none`, `space`, `comma`, `colon`, `newline`, `0x`, `\x` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `48 c3 a9 6c 6c 6f` | — | `Héllo` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1c1IrVDSUUosSgdKVNfWxtYCAA&i=M7FQSDZWSLRUMEsGozQA), or search for "From Hex" in the operation list.

**CLI:**

```sh
unichef op from-hex '48 c3 a9 6c 6c 6f'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-hex", {}, Dish.of_string("48 c3 a9 6c 6c 6f"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-hex", {}, { type: 'string', value: "48 c3 a9 6c 6c 6f" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4648 §8: Base16](https://www.rfc-editor.org/rfc/rfc4648#section-8)
- Related: [To Hex](to-hex.md), [Decode Text](decode-text.md), [From Base64](from-base64.md)

<!-- docs:nav -->
---

[← From Decimal](from-decimal.md) · [Contents](../../README.md) · [From Octal →](from-octal.md)
<!-- /docs:nav -->
