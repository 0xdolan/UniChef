<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# PBKDF2

Derive a `length`-byte key from the input password (PBKDF2-HMAC, RFC 8018) and return it as hex. Warns W_INSECURE below 100 000 iterations.

| Id | Input | Output | Background |
|---|---|---|---|
| `pbkdf2` | bytes | string | [HMAC and key derivation](../../learn/hmac-and-key-derivation.md) |
<!-- /docs:head -->

## How it works

PBKDF2 (RFC 8018) turns a password into a key, and makes each guess expensive for an
attacker.

```
U1 = HMAC(password, salt || INT(i))
U2 = HMAC(password, U1)
…
Uc = HMAC(password, Uc-1)
T_i = U1 XOR U2 XOR … XOR Uc
key = T_1 || T_2 || …   (cut to length bytes)
```

*c* is `iterations` and *i* counts output blocks from 1. Each block costs *c* HMAC calls, so
an attacker trying a million passwords pays a million times *c*.

**Worked example** (RFC 6070). Password `password`, `salt=utf8:salt`, `hash=sha1`,
`iterations=1`, `length=20` gives `0c60c80f961f0e71f3a9b524af6012062fe037a6`. With the defaults
(SHA-256, 100 000 iterations, 32 bytes), the same password and salt give a different key that
takes about 100 000 times as long to compute.

- **Salt**: random, at least 16 bytes, unique per password and stored next to the hash. It
  stops precomputed tables and makes equal passwords hash differently.
- **Iterations**: as high as your users can wait for. OWASP recommends 600 000 for
  PBKDF2-HMAC-SHA256 (2023). UniChef warns `W_INSECURE` below 100 000.
- **Length**: asking for more than the hash's output size (32 bytes for SHA-256) doubles the
  defender's work but not the attacker's, who only needs the first block to test a guess.

## Security notes

PBKDF2 uses little memory, so GPUs and ASICs can try passwords very fast. For new password
storage, prefer a memory-hard function such as Argon2id or scrypt where available; PBKDF2 is
the choice when FIPS compliance is required.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `hash` | choice | `sha256` | `sha256`, `sha1`, `md5`, `sha224`, `sha384`, `sha512`, `sha3-256`, `sha3-512` |
| `iterations` | integer 1 to 10000000 | `100000` | — |
| `salt` | bytes (hex, utf8, base64, latin1) | — | — |
| `length` | integer 1 to 1024 | `32` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `password` | `salt=utf8:salt` | `0394a2ede332c9a13eb82e9b24631604c31df978b4e2f0fbd2c549944f9d79a5` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=HcoxDoAgEETRu0xNo5XhKsYCZTFEAoQFGsLdXa0mf_IGOhX2KUIvClwpM_Q-kDI08vlYt0LBlFvuATahfkvxStbHW0yrbhPRTWgk-Ys55zFf&i=K0gsLi7PL0oBAA), or search for "PBKDF2" in the operation list.

**CLI:**

```sh
unichef op pbkdf2 --arg salt=utf8:salt password
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("pbkdf2", {"salt": {"encoding": "utf8", "value": "salt"}}, Dish.of_string("password"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("pbkdf2", {"salt": {"encoding": "utf8", "value": "salt"}}, { type: 'string', value: "password" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 8018 §5.2: PBKDF2](https://www.rfc-editor.org/rfc/rfc8018#section-5.2)
- [RFC 6070: PBKDF2 test vectors](https://www.rfc-editor.org/rfc/rfc6070)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- Related: [HMAC](hmac.md), [AES Encrypt](aes-encrypt.md), [HMAC and key derivation](../../learn/hmac-and-key-derivation.md)

<!-- docs:nav -->
---

[← JWT Verify](jwt-verify.md) · [Contents](../../README.md) · [ROT13 →](rot13.md)
<!-- /docs:nav -->
