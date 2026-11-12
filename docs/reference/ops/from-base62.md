<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base62

Decode a base-62 number to bytes. Without `strict`, it skips other characters.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base62` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each character's position in the alphabet is a digit in base 62. Starting from zero, the
decoder multiplies by 62 and adds each digit, then writes the resulting number as bytes,
most significant first. `5TP3P3v` gives 0x48656c6c6f, which is `Hello`.

The alphabet must match the encoder's: `upper-first` is `0–9A–Za–z` and `lower-first` is
`0–9a–zA–Z`. The wrong one still decodes, but to different bytes.

Leading `0` digits add nothing to the number, so they add no bytes, and any leading zero
bytes of the original data cannot be recovered. `0` on its own decodes to one zero byte.

Without `strict`, characters outside the alphabet, such as hyphens and line breaks, are
skipped. With `strict`, any such character is an error.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `upper-first` | `upper-first`, `lower-first` |
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `5TP3P3v` | — | `Hello` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE41M1LSUUosSgfKVdfWxtYCAA&i=Mw0JMA4wLgMA), or search for "From Base62" in the operation list.

**CLI:**

```sh
unichef op from-base62 5TP3P3v
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base62", {}, Dish.of_string("5TP3P3v"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base62", {}, { type: 'string', value: "5TP3P3v" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Base62 (Wikipedia)](https://en.wikipedia.org/wiki/Base62)
- Related: [To Base62](to-base62.md), [From Base58](from-base58.md)

<!-- docs:nav -->
---

[← From Base58](from-base58.md) · [Contents](../../README.md) · [From Base64 →](from-base64.md)
<!-- /docs:nav -->
