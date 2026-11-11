<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# Vigenère Encode

Shift each ASCII letter forward by the next letter of `key` (A=0, case kept). Other characters are unchanged and do not use up a key letter.

| Id | Input | Output | Background |
|---|---|---|---|
| `vigenere-encode` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

The Vigenère cipher shifts each letter by a different amount, taken from the letters of a key
(A = 0, B = 1 … Z = 25). The key repeats as needed.

**Worked example: `ATTACK AT DAWN` with key `LEMON`**

| Plain | A | T | T | A | C | K | A | T | D | A | W | N |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Key | L | E | M | O | N | L | E | M | O | N | L | E |
| Shift | 11 | 4 | 12 | 14 | 13 | 11 | 4 | 12 | 14 | 13 | 11 | 4 |
| Cipher | L | X | F | O | P | V | E | F | R | N | H | R |

Result: `LXFOPV EF RNHR`. Spaces and other non-letters are copied and do not use up a key
letter, and the case of each letter is kept.

## Security notes

Vigenère resisted casual attack for three centuries, but the Kasiski examination and the index
of coincidence reveal the key length, and then each position is a simple Caesar cipher. Do not
use it to protect anything.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `key` | string | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello, World!` | `key=key` | `Rijvs, Uyvjn!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqy0xPzUstStVNzUvOT0lV0lFKLEoHylcrZadWAuVBZG1tbC0A&i=80jNycnXUQjPL8pJUQQA), or search for "Vigenère Encode" in the operation list.

**CLI:**

```sh
unichef op vigenere-encode --arg key=key 'Hello, World!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("vigenere-encode", {"key": "key"}, Dish.of_string("Hello, World!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("vigenere-encode", {"key": "key"}, { type: 'string', value: "Hello, World!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Vigenère cipher on Wikipedia](https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher)
- [Kasiski examination](https://en.wikipedia.org/wiki/Kasiski_examination)
- Related: [Vigenère Decode](vigenere-decode.md), [ROT13](rot13.md), [Classical ciphers](../../learn/classical-ciphers.md)

<!-- docs:nav -->
---

[← Vigenère Decode](vigenere-decode.md) · [Contents](../../README.md) · [XOR →](xor.md)
<!-- /docs:nav -->
