<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# Atbash

Mirror the ASCII alphabet (A<->Z, case kept). Other characters are unchanged.

| Id | Input | Output | Background |
|---|---|---|---|
| `atbash` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

Atbash mirrors the alphabet: A becomes Z, B becomes Y, and so on, keeping the case. A letter at
position *n* (from 0) becomes the one at 25 − *n*. It is its own inverse, and it has no key.

**Worked example.** `Hello, World!` becomes `Svool, Dliow!`: `H` (7) becomes `S` (18),
`e` (4) becomes `v` (21). Characters other than ASCII letters are unchanged.

Atbash was first used with the Hebrew alphabet and appears in the Bible. Today it is a
classroom and puzzle cipher.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello` | — | `Svool` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKLElKLM5Q0lFKLEoHClfX1sbWAgA&i=80jNyckHAA), or search for "Atbash" in the operation list.

**CLI:**

```sh
unichef op atbash Hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("atbash", {}, Dish.of_string("Hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("atbash", {}, { type: 'string', value: "Hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Atbash on Wikipedia](https://en.wikipedia.org/wiki/Atbash)
- Related: [ROT13](rot13.md), [Vigenère Encode](vigenere-encode.md), [Classical ciphers](../../learn/classical-ciphers.md)

<!-- docs:nav -->
---

[← AES Encrypt](aes-encrypt.md) · [Contents](../../README.md) · [Bacon cipher decode →](bacon-decode.md)
<!-- /docs:nav -->
