<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# AES Decrypt

Inverse of `aes-encrypt` with the same arguments. In GCM the last 16 bytes are the tag; a wrong key, IV, AAD or tag raises E_CRYPTO, as does bad PKCS#7 padding.

| Id | Input | Output | Background |
|---|---|---|---|
| `aes-decrypt` | bytes | bytes | [Encryption](../../learn/encryption.md) |
<!-- /docs:head -->

## How it works

AES Decrypt runs [AES Encrypt](aes-encrypt.md) backwards with the same `key`, `mode`, `iv`,
`padding` and `aad`. Each round applies the inverse steps (InvShiftRows, InvSubBytes,
AddRoundKey, InvMixColumns) with the round keys in reverse order. In CTR and GCM, decryption is
the same XOR with the key stream as encryption.

**Worked example** (NIST SP 800-38A, F.2.2). Key `2b7e151628aed2a6abf7158809cf4f3c`, IV
`000102030405060708090a0b0c0d0e0f`, `padding=none`, input bytes
`7649abac8119b246cee98e9b12e9197d` give `6bc1bee22e409f96e93d7e117393172a`.

The step fails with `E_CRYPTO` when:
- in **GCM**, the tag (the last 16 bytes of the input) does not match, because the key, IV,
  AAD or ciphertext is wrong or was changed. No plaintext is returned, as it must not be
  trusted;
- in **CBC or ECB** with PKCS#7, the padding at the end is not valid, which usually means a
  wrong key or IV;
- the input length is not a multiple of 16 where a mode needs it.

In CBC, a wrong IV only garbles the first block; a wrong key garbles everything. That pattern
helps when you recover keys in a CTF or from malware: the IV is often the first 16 bytes of the
ciphertext, or all zeros.

## Security notes

A CBC decryptor that reports padding errors differently from other errors is a *padding
oracle*: an attacker can decrypt messages by sending modified ciphertexts. Use GCM, or check a
MAC before decrypting.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `key` | bytes (hex, utf8, base64, latin1), secret | — | — |
| `mode` | choice | `cbc` | `cbc`, `ctr`, `gcm`, `ecb` |
| `iv` | bytes (hex, utf8, base64, latin1), secret | — | — |
| `padding` | choice | `pkcs7` | `pkcs7`, `none` |
| `aad` | bytes (hex, utf8, base64, latin1) | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `r[Q~Cg` | `key=hex:000102030405060708090a0b0c0d0e0f`, `mode=ctr`, `iv=hex:000000000000000000000000000004b2` | `secret` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=hYxdDoIwHMPv0ueZFMQvrmJ4GNtfXFRGtkkkZHd3HMDYl6b5tV0xS4jOj2grhZhkimivK_yEFlrizooJy5SgoMNQ2IqHLJvJaLx141B6d_kUPuvnW0oiWbHmng0PPPLEMy_U7GloKbwhK7y83aomhTJ087-_32r6GjnnLn8B&i=K4oOrHNOBwA), or search for "AES Decrypt" in the operation list.

**CLI:**

```sh
unichef op aes-decrypt --arg key=hex:000102030405060708090a0b0c0d0e0f --arg mode=ctr --arg iv=hex:000000000000000000000000000004b2 'r[Q~Cg'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("aes-decrypt", {"key": {"encoding": "hex", "value": "000102030405060708090a0b0c0d0e0f"}, "mode": "ctr", "iv": {"encoding": "hex", "value": "000000000000000000000000000004b2"}}, Dish.of_string("r[Q~Cg"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("aes-decrypt", {"key": {"encoding": "hex", "value": "000102030405060708090a0b0c0d0e0f"}, "mode": "ctr", "iv": {"encoding": "hex", "value": "000000000000000000000000000004b2"}}, { type: 'string', value: "r[Q~Cg" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [NIST SP 800-38A: block cipher modes](https://csrc.nist.gov/pubs/sp/800/38/a/final)
- [Padding oracle attack on Wikipedia](https://en.wikipedia.org/wiki/Padding_oracle_attack)
- Related: [AES Encrypt](aes-encrypt.md), [From Base64](from-base64.md), [Encryption](../../learn/encryption.md)

<!-- docs:nav -->
---

[← A1Z26 encode](a1z26-encode.md) · [Contents](../../README.md) · [AES Encrypt →](aes-encrypt.md)
<!-- /docs:nav -->
