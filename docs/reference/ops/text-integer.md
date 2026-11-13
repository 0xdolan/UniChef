<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Text-Integer Conversion

Convert between text and the big-endian integer its bytes spell: `ABC` is 0x414243 is 4276803. Input that is all digits is read as decimal, input starting with 0x as hex and anything else, quoted or not, as text. `output` picks the form to write.

| Id | Input | Output | Background |
|---|---|---|---|
| `text-integer` | string | string | [Number and key formats: floats, BCD, text as a number, Bech32 and PEM](../../learn/number-formats.md) |
<!-- /docs:head -->

## How it works

Any text is a row of bytes, and a row of bytes is a number in base 256. This operation moves
between the three ways of writing that number: the text itself, decimal and hex. It is the
conversion textbook RSA uses to turn a message into a number.

The input form is detected:

| Input | Read as |
|---|---|
| Only digits, with an optional sign: `4276803` | Decimal |
| Starts with `0x`: `0x414243` | Hex |
| Anything else, in quotes or not: `ABC`, `"123"` | Text, one byte per character |

Text is read as Latin-1, so every character must be U+00FF or below; run
[Encode Text](encode-text.md) and [To Hex](to-hex.md) first for other text. Put digits in
quotes to treat them as text. The number may be up to 1024 bytes long.

**Worked example: `ABC`**

| Character | `A` | `B` | `C` |
|---|---|---|---|
| Byte | `41` | `42` | `43` |

Hex: `0x414243`. Decimal: 65 × 65536 + 66 × 256 + 67 = `4276803`. Going back, `4276803` with
`output=string` gives `ABC`. Leading zero bytes do not survive, because a number has no
leading zeros.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `output` | choice | `string` | `string`, `decimal`, `hex` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `ABC` | `output=decimal` | `4276803` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DckxCsAgDAXQu_zZDl1zldJBbJBAq8HEUhDvXt_6Bl5uJrWA9gBzVgMdA1VBcP58k-KcuSEgtrxyXXftvv7iJE-8Mec5fw&i=c3RyBgA), or search for "Text-Integer Conversion" in the operation list.

**CLI:**

```sh
unichef op text-integer --arg output=decimal ABC
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("text-integer", {"output": "decimal"}, Dish.of_string("ABC"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("text-integer", {"output": "decimal"}, { type: 'string', value: "ABC" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Positional notation on Wikipedia](https://en.wikipedia.org/wiki/Positional_notation)
- [PKCS #1: octet string to integer (RFC 8017, section 4.2)](https://www.rfc-editor.org/rfc/rfc8017#section-4.2)
- Guide: [Number and key formats](../../learn/number-formats.md)
- Related: [To Base](to-base.md), [To Hex](to-hex.md), [To Decimal](to-decimal.md)

<!-- docs:nav -->
---

[← Swap Endianness](swap-endianness.md) · [Contents](../../README.md) · [To Base →](to-base.md)
<!-- /docs:nav -->
