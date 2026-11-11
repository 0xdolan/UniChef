<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# XOR

XOR with a repeating `key`. `rolling` adds the number of completed passes over the key to each key byte (mod 256), so the key stream changes on every pass. Both schemes are their own inverse.

| Id | Input | Output | Background |
|---|---|---|---|
| `xor` | bytes | bytes | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

XOR (exclusive or) compares two bits: the result is 1 when they differ. Applying the same key
twice gives back the original, because *x* XOR *k* XOR *k* = *x*. This operation XORs each
input byte with the next byte of `key`, repeating the key as needed.

**Worked example: `secret` with `key=utf8:KEY`**

| Input | `s` 73 | `e` 65 | `c` 63 | `r` 72 | `e` 65 | `t` 74 |
|---|---|---|---|---|---|---|
| Key | `K` 4b | `E` 45 | `Y` 59 | `K` 4b | `E` 45 | `Y` 59 |
| XOR | `38` | `20` | `3a` | `39` | `20` | `2d` |

Running XOR again with the same key on `38 20 3a 39 20 2d` gives `secret`.

With `scheme=rolling`, 1 is added to every key byte after each full pass over the key (mod 256),
so the second pass uses `LFZ`: `secretsecret` gives `38 20 3a 3e 23 2e 3e 22 38 3c 2d 28`.

A one-byte key `20` flips bit 5 of ASCII letters, which switches their case: `hello` becomes
`HELLO`.

## Security notes

Repeating-key XOR is not encryption. Known plaintext gives the key directly (plaintext XOR
ciphertext = key), and frequency analysis breaks it without any. Malware still uses it to hide
strings and configuration: look for runs of the same byte, which reveal the key where the
plaintext was zero.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `key` | bytes (hex, utf8, base64, latin1), secret | — | — |
| `scheme` | choice | `standard` | `standard`, `rolling` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `hello` | `key=hex:20` | `HELLO` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=FYnBCoAgEAX_5Z09VEd_JTpILSaGK1piyP5722mYmYFGpQZOsLNBvSlX2HWAMyw6Fxi44rUNRHp_UNr5CMnrP6nrb-56SG2ZICKbfA&i=y0jNyckHAA), or search for "XOR" in the operation list.

**CLI:**

```sh
unichef op xor --arg key=hex:20 hello
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("xor", {"key": {"encoding": "hex", "value": "20"}}, Dish.of_string("hello"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("xor", {"key": {"encoding": "hex", "value": "20"}}, { type: 'string', value: "hello" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [XOR cipher on Wikipedia](https://en.wikipedia.org/wiki/XOR_cipher)
- [Cryptopals set 1: break repeating-key XOR](https://cryptopals.com/sets/1/challenges/6)
- Related: [To Hex](to-hex.md), [ROT13](rot13.md), [Classical ciphers](../../learn/classical-ciphers.md)

<!-- docs:nav -->
---

[← Vigenère Encode](vigenere-encode.md) · [Contents](../../README.md) · [Gunzip →](gunzip.md)
<!-- /docs:nav -->
