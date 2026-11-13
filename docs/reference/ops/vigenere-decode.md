<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# Vigenère Decode

Undo `vigenere-encode`: shift each ASCII letter back by the next letter of `key`.

| Id | Input | Output | Background |
|---|---|---|---|
| `vigenere-decode` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

Vigenère Decode shifts each letter back by the matching key letter (A = 0 … Z = 25), the
reverse of [Vigenère Encode](vigenere-encode.md). Non-letters are copied and do not use up a
key letter.

**Worked example.** `LXFOPV EF RNHR` with key `LEMON` gives `ATTACK AT DAWN`: `L` (11) minus
`L` (11) is `A`, `X` (23) minus `E` (4) is `T`, and so on.

If you know part of the plaintext, subtract it from the ciphertext to get the key: decoding
`LXFOPV` with the key `ATTACK` gives `LEMONL`, which shows the key `LEMON` repeating.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `key` | string | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Rijvs, Uyvjn!` | `key=key` | `Hello, World!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqy0xPzUstStVNSU3OT0lV0lFKLEoHylcrZadWAuVBZG1tbC0A&i=C8rMKivWUQitLMvKUwQA), or search for "Vigenère Decode" in the operation list.

**CLI:**

```sh
unichef op vigenere-decode --arg key=key 'Rijvs, Uyvjn!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("vigenere-decode", {"key": "key"}, Dish.of_string("Rijvs, Uyvjn!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("vigenere-decode", {"key": "key"}, { type: 'string', value: "Rijvs, Uyvjn!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Vigenère cipher on Wikipedia](https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher)
- Related: [Vigenère Encode](vigenere-encode.md), [Atbash](atbash.md), [Classical ciphers](../../learn/classical-ciphers.md)

<!-- docs:nav -->
---

[← ROT8000](rot8000.md) · [Contents](../../README.md) · [Vigenère Encode →](vigenere-encode.md)
<!-- /docs:nav -->
