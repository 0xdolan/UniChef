<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base58

Decode Base58. Without `strict`, it skips characters outside the alphabet.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base58` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each character's position in the alphabet is a digit in base 58. Starting from zero, the
decoder multiplies by 58 and adds each digit, then writes the resulting number as bytes,
most significant first. Each leading `1` (the alphabet's zero digit) adds one leading `00`
byte. `9Ajdvzr` gives 0x48656c6c6f, which is `Hello`.

Without `strict`, characters outside the alphabet, such as spaces and line breaks, are
skipped. With `strict`, any such character is an error. A `0`, `O`, `I` or `l` in the input
is never valid Base58, which helps tell it apart from Base62 or Base64.

To check a Bitcoin address, decode it, then compare the last four bytes with the first four
bytes of SHA-256(SHA-256(the rest)).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `bitcoin` | `bitcoin`, `flickr` |
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `9Ajdvzr` | — | `Hello` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE41tVDSUUosSgfKVdfWxtYCAA&i=s3TMSimrKgIA), or search for "From Base58" in the operation list.

**CLI:**

```sh
unichef op from-base58 9Ajdvzr
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base58", {}, Dish.of_string("9Ajdvzr"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base58", {}, { type: 'string', value: "9Ajdvzr" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Base58Check encoding (Bitcoin wiki)](https://en.bitcoin.it/wiki/Base58Check_encoding)
- Related: [To Base58](to-base58.md), [SHA-2](sha2.md)

<!-- docs:nav -->
---

[← From Base45](from-base45.md) · [Contents](../../README.md) · [From Base62 →](from-base62.md)
<!-- /docs:nav -->
