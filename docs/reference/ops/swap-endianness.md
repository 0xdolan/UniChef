<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Swap Endianness

Reverse the byte order inside each word of `word_length` bytes. With `hex`, the input is hex text (as From Hex reads it with `auto`) and the output is space-separated lower-case hex. With `pad`, a short final word is filled with zero bytes first.

| Id | Input | Output | Background |
|---|---|---|---|
| `swap-endianness` | bytes | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Endianness is the order in which the bytes of a multi-byte number are stored. Big-endian puts
the most significant byte first; little-endian puts it last. `swap-endianness` cuts the data
into words of `word_length` bytes and reverses the bytes inside each word.

**Worked example: `0a0b0c0d 01`, word length 4**

1. In `hex` format the input is read as hex: `0a 0b 0c 0d 01`.
2. The last word is short, so with `pad` on it is filled with zeros: `01 00 00 00`.
3. Reverse each word: `0d 0c 0b 0a` and `00 00 00 01`.

Result: `0d 0c 0b 0a 00 00 00 01`. In `raw` format the bytes themselves are swapped and the
output is bytes. With `pad` off, a short final word is reversed as it is.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `format` | choice | `hex` | `hex`, `raw` |
| `word_length` | integer ≥ 1 | `4` | — |
| `pad` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `0a0b0c0d 01` | — | `0d 0c 0b 0a 00 00 00 01` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLk8s0E3NS8lMzMtLLS5W0lFKLEoHylfX1sbWAgA&i=M0g0SDJINkhRMDAEAA), or search for "Swap Endianness" in the operation list.

**CLI:**

```sh
unichef op swap-endianness '0a0b0c0d 01'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("swap-endianness", {}, Dish.of_string("0a0b0c0d 01"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("swap-endianness", {}, { type: 'string', value: "0a0b0c0d 01" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Endianness (Wikipedia)](https://en.wikipedia.org/wiki/Endianness)
- Related: [To Hex](to-hex.md), [From Hex](from-hex.md)

<!-- docs:nav -->
---

[← Quoted-Printable Encode](quoted-printable-encode.md) · [Contents](../../README.md) · [Text-Integer Conversion →](text-integer.md)
<!-- /docs:nav -->
