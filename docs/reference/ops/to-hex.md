<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Hex

Write each byte as two hex digits, separated or prefixed by `delimiter`.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-hex` | bytes | string | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Hexadecimal is base 16: the digits `0–9` and `a–f` stand for the values 0 to 15. One hex
digit holds exactly four bits (a *nibble*), so every byte is written as exactly two digits:
the high nibble, then the low nibble.

**Worked example: `Héllo`**

1. The text is encoded as UTF-8 first: `H` is one byte, `é` is two (`c3 a9`), `l`, `l` and
   `o` are one each.
2. Each byte is split into nibbles. `H` is 72 = `0100 1000`, so `4` and `8`: `48`. The byte
   195 = `1100 0011` gives `c3`.
3. The pairs are joined with the delimiter: `48 c3 a9 6c 6c 6f`.

The output is always twice as long as the input in bytes (plus delimiters). The `0x` and `\x`
delimiters put the prefix before each byte, as C, Python and shell code write byte literals:
`\x48\xc3\xa9…`.

Hex is the standard way to show binary data: hash digests, keys, IVs, packet captures and
file signatures (magic numbers) such as `89 50 4e 47` for PNG or `4d 5a` (`MZ`) for Windows
executables.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `space` | `none`, `space`, `comma`, `colon`, `newline`, `0x`, `\x` |
| `case` | choice | `lower` | `lower`, `upper` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Héllo` | — | `48 c3 a9 6c 6c 6f` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNSK1Q0lFKLEoHClfX1sbWAgA&i=8zi8MicnHwA), or search for "To Hex" in the operation list.

**CLI:**

```sh
unichef op to-hex 'Héllo'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-hex", {}, Dish.of_string("Héllo"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-hex", {}, { type: 'string', value: "Héllo" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4648 §8: Base16](https://www.rfc-editor.org/rfc/rfc4648#section-8)
- [List of file signatures](https://en.wikipedia.org/wiki/List_of_file_signatures)
- Related: [From Hex](from-hex.md), [To Binary](to-binary.md), [UTF-8 Explain](utf8-explain.md)

<!-- docs:nav -->
---

[← To Decimal](to-decimal.md) · [Contents](../../README.md) · [To Octal →](to-octal.md)
<!-- /docs:nav -->
