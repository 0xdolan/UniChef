<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# ROT13

Rotate ASCII letters by `amount` (default 13, case kept); with `digits`, also rotate 0-9 by the same amount mod 10. Other characters are unchanged.

| Id | Input | Output | Background |
|---|---|---|---|
| `rot13` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

ROT13 replaces each ASCII letter with the one `amount` places later in the alphabet, wrapping
from Z to A and keeping the case. With the default 13, applying it twice gives back the
original, because the alphabet has 26 letters.

**Worked examples.**
- `Hello, World!` becomes `Uryyb, Jbeyq!`. Punctuation, digits and non-ASCII letters are
  unchanged.
- With `amount=3`, it is the Caesar cipher: `Hello` becomes `Khoor`. Use `amount=-3` (or 23)
  to decode.
- With `digits=true`, digits rotate by the same amount mod 10: `Call 555-0123` becomes
  `Pnyy 888-3456`.

ROT13 hides spoilers and puzzle answers; it was never meant to keep secrets. In CTFs, try all
25 amounts: only one gives readable text.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `amount` | integer -1000000 to 1000000 | `13` | — |
| `digits` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello, World!` | — | `Uryyb, Jbeyq!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyi8xNFbSUUosSgeKVtfWxtYCAA&i=80jNycnXUQjPL8pJUQQA), or search for "ROT13" in the operation list.

**CLI:**

```sh
unichef op rot13 'Hello, World!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("rot13", {}, Dish.of_string("Hello, World!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("rot13", {}, { type: 'string', value: "Hello, World!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [ROT13 on Wikipedia](https://en.wikipedia.org/wiki/ROT13)
- [Caesar cipher on Wikipedia](https://en.wikipedia.org/wiki/Caesar_cipher)
- Related: [ROT47](rot47.md), [Atbash](atbash.md), [Vigenère Encode](vigenere-encode.md), [Classical ciphers](../../learn/classical-ciphers.md)

<!-- docs:nav -->
---

[← PBKDF2](pbkdf2.md) · [Contents](../../README.md) · [ROT47 →](rot47.md)
<!-- /docs:nav -->
