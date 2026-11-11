<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# AES Encrypt

AES in CBC (default), CTR, GCM or ECB mode. `padding` (PKCS#7 by default) applies to CBC and ECB. In GCM the 16-byte tag is appended and `aad` is authenticated. ECB warns W_INSECURE.

| Id | Input | Output | Background |
|---|---|---|---|
| `aes-encrypt` | bytes | bytes | [Encryption](../../learn/encryption.md) |
<!-- /docs:head -->

## How it works

AES (FIPS 197) is a block cipher: with a key, it turns one 16-byte block into another, and
only the same key turns it back. The key length sets the number of rounds: 16 bytes (AES-128)
gives 10, 24 bytes gives 12, and 32 bytes gives 14. Each round applies four steps to the block,
seen as a 4 × 4 grid of bytes:

1. **SubBytes**: replace each byte using a fixed table (the S-box), the non-linear part.
2. **ShiftRows**: rotate row *n* of the grid left by *n* positions.
3. **MixColumns**: mix the four bytes of each column (multiplication in GF(2⁸)); skipped in
   the last round.
4. **AddRoundKey**: XOR with a round key derived from the key.

A **mode** says how to encrypt messages longer than one block:

| `mode` | How | IV | Padding | Notes |
|---|---|---|---|---|
| `cbc` | XOR each plaintext block with the previous ciphertext block, then encrypt | 16 bytes, random | PKCS#7 | no integrity |
| `ctr` | encrypt a counter (IV, IV+1…) and XOR the result with the plaintext | 16 bytes, never reused | none | no integrity; a stream cipher |
| `gcm` | CTR plus a GHASH authentication tag over the ciphertext and `aad` | 12 bytes recommended (16 accepted) | none | authenticated: the 16-byte tag is appended |
| `ecb` | encrypt each block on its own | none | PKCS#7 | insecure: warns `W_INSECURE` |

**PKCS#7 padding** fills the last block with *n* bytes of value *n* (from 1 to 16), so the
decryptor knows how much to remove. A full extra block of `10` bytes is added when the length
is already a multiple of 16. With `padding=none`, the input must be a multiple of 16 bytes.

**Worked example** (NIST SP 800-38A, F.2.1). Key `2b7e151628aed2a6abf7158809cf4f3c`, IV
`000102030405060708090a0b0c0d0e0f`, `padding=none`, input bytes
`6bc1bee22e409f96e93d7e117393172a` (input format hex) give
`7649abac8119b246cee98e9b12e9197d`.

Encrypting the same 16 bytes twice in ECB gives `3ad77bb40d7a3660a89ecaf32466ef97` twice:
identical blocks leak, which is why ECB shows the outline of an image it encrypts.

## Security notes

- Use **GCM** unless something else requires another mode: it detects tampering. CBC and CTR
  without a separate MAC allow bit-flipping, and CBC with error messages allows padding oracle
  attacks.
- Never reuse an IV with the same key in CTR or GCM. Reuse reveals the XOR of the two
  plaintexts, and in GCM it also lets an attacker forge tags.
- Derive keys from passwords with [PBKDF2](pbkdf2.md); never use a password directly as a
  key.
- The `key` and `iv` are marked secret: UniChef leaves them out of share links.

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
| `Attack at dawn` | `key=hex:000102030405060708090a0b0c0d0e0f`, `iv=hex:0f0e0d0c0b0a09080706050403020100` | `b4 dd 38 c9 96 76 b8 ec b1 d3 ad bd 52 ad 57 70` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=fYxBDoIwFETvMuuaTEVEuIphUeCDjaYlFImE9O5-L-BqMnkz78AmS_IxoLEGaZU5obkfiDMaOEknCf2yzysM3DIpO_CU_RcK4uDDpLuHfJRv7vUWbSQtzyx4YckrK95Y07Fjz4HCEdnAb_8Vow4HPXR6rFVQqahUYaFiSyLn3OYv&i=cywpSUzOVkgsUUhJLM8DAA), or search for "AES Encrypt" in the operation list.

**CLI:**

```sh
unichef op aes-encrypt --arg key=hex:000102030405060708090a0b0c0d0e0f --arg iv=hex:0f0e0d0c0b0a09080706050403020100 'Attack at dawn'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("aes-encrypt", {"key": {"encoding": "hex", "value": "000102030405060708090a0b0c0d0e0f"}, "iv": {"encoding": "hex", "value": "0f0e0d0c0b0a09080706050403020100"}}, Dish.of_string("Attack at dawn"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("aes-encrypt", {"key": {"encoding": "hex", "value": "000102030405060708090a0b0c0d0e0f"}, "iv": {"encoding": "hex", "value": "0f0e0d0c0b0a09080706050403020100"}}, { type: 'string', value: "Attack at dawn" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [FIPS 197: Advanced Encryption Standard](https://csrc.nist.gov/pubs/fips/197/final)
- [NIST SP 800-38A: block cipher modes](https://csrc.nist.gov/pubs/sp/800/38/a/final) and [SP 800-38D: GCM](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [A Stick Figure Guide to AES](https://www.moserware.com/2009/09/stick-figure-guide-to-advanced.html)
- Related: [AES Decrypt](aes-decrypt.md), [PBKDF2](pbkdf2.md), [Generate Random Bytes](generate-random-bytes.md), [Encryption](../../learn/encryption.md)

<!-- docs:nav -->
---

[← AES Decrypt](aes-decrypt.md) · [Contents](../../README.md) · [Atbash →](atbash.md)
<!-- /docs:nav -->
