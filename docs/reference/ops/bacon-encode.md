<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# Bacon cipher encode

Write each ASCII letter as a five-symbol Bacon code. The `standard` alphabet gives I and J one code, and U and V another; `complete` gives all 26 letters their own. Codes are written in `0`/`1` or `A`/`B` and joined by spaces, or, with `keep_other`, written in place among the other characters. `invert` swaps the two symbols.

| Id | Input | Output | Background |
|---|---|---|---|
| `bacon-encode` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

`bacon-encode` writes each ASCII letter as five binary symbols. The `standard` alphabet is
Bacon's original 24 letters, where I and J share a code and so do U and V; `complete` gives all
26 letters their own code.

**Worked example: `Hi` with the defaults**

H is code 7, which is `00111` in five binary digits; I is code 8, `01000`. The codes are joined
with a space: `00111 01000`. With `translation` `ab` they are `AABBB ABAAA`.

`invert` swaps the two symbols. With `keep_other`, the codes are written in place and other
characters are kept, so `Hi, J!` becomes `0011101000, 01000!`. See
[Classical ciphers](../../learn/classical-ciphers.md) for how the symbols hide in ordinary text.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `standard` | `standard`, `complete` |
| `translation` | choice | `01` | `01`, `ab` |
| `keep_other` | boolean | `false` | — |
| `invert` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hi` | — | `00111 01000` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKSkzOz9NNzUvOT0lV0lFKLEoHSlbX1sbWAgA&i=88gEAA), or search for "Bacon cipher encode" in the operation list.

**CLI:**

```sh
unichef op bacon-encode Hi
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("bacon-encode", {}, Dish.of_string("Hi"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("bacon-encode", {}, { type: 'string', value: "Hi" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Bacon's cipher on Wikipedia](https://en.wikipedia.org/wiki/Bacon%27s_cipher)
- Related: [Bacon cipher decode](bacon-decode.md)

<!-- docs:nav -->
---

[← Bacon cipher decode](bacon-decode.md) · [Contents](../../README.md) · [Generate Random Bytes →](generate-random-bytes.md)
<!-- /docs:nav -->
