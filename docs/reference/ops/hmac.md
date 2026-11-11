<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Hashing

# HMAC

HMAC (RFC 2104) with `hash` (default sha256) and a bytes `key`.

| Id | Input | Output | Background |
|---|---|---|---|
| `hmac` | bytes | string | [HMAC and key derivation](../../learn/hmac-and-key-derivation.md) |
<!-- /docs:head -->

## How it works

HMAC (RFC 2104) turns a hash function into a *message authentication code*: only someone who
knows the key can produce or check the tag.

```
HMAC(K, m) = H( (K' XOR opad) || H( (K' XOR ipad) || m ) )
```

1. **Prepare the key.** If the key is longer than the hash's block size (64 bytes for SHA-256,
   128 for SHA-512), hash it first. Then pad it with zero bytes to the block size: that is K'.
2. **Inner hash.** XOR K' with `ipad` (the byte `36` repeated), append the message, and hash.
3. **Outer hash.** XOR K' with `opad` (the byte `5c` repeated), append the inner digest, and
   hash. The result is the tag.

The two nested hashes are what stop length-extension attacks, which break a naive
`H(key || message)`.

**Worked example** (RFC 4231 test case 2). Key `Jefe` (`key=utf8:Jefe`), message
`what do ya want for nothing?`, `hash=sha256`:
`5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843`.

HMAC signs API requests (AWS Signature Version 4, webhooks from GitHub and Stripe), JWTs with
`HS256` ([JWT Sign](jwt-sign.md)), and TOTP codes (HMAC-SHA1 of a counter).

## Security notes

- Compare tags in constant time, or an attacker can learn a valid tag byte by byte from the
  response time.
- Use a random key at least as long as the hash output; a short or guessable key can be
  brute-forced offline from a single message and tag.
- HMAC-MD5 and HMAC-SHA1 are not broken in practice, but choose SHA-256 for new designs.
- The `key` is marked secret: UniChef leaves it out of share links.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `hash` | choice | `sha256` | `sha256`, `sha1`, `md5`, `sha224`, `sha384`, `sha512`, `sha3-256`, `sha3-512` |
| `key` | bytes (hex, utf8, base64, latin1), secret | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `message` | `key=utf8:secret` | `8b5f48702995c1598c573db1e21866a9b825d4a794d169d7060a03605796360b` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=FYrBCoAgEAX_5Z29dAt_JTqIbRaViqtCyP5722mYYQY6FT5ThJ0MuFJm2GUgZVgcj_MwcCVoHLjo_UHRp-2MQYdW91mH7u5Gqky-UIWIrPIB&i=y00tLk5MTwUA), or search for "HMAC" in the operation list.

**CLI:**

```sh
unichef op hmac --arg key=utf8:secret message
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("hmac", {"key": {"encoding": "utf8", "value": "secret"}}, Dish.of_string("message"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("hmac", {"key": {"encoding": "utf8", "value": "secret"}}, { type: 'string', value: "message" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 2104: HMAC](https://www.rfc-editor.org/rfc/rfc2104)
- [RFC 4231: HMAC-SHA-2 test vectors](https://www.rfc-editor.org/rfc/rfc4231)
- Related: [SHA-2](sha2.md), [PBKDF2](pbkdf2.md), [JWT Sign](jwt-sign.md), [HMAC and key derivation](../../learn/hmac-and-key-derivation.md)

<!-- docs:nav -->
---

[← CRC-32](crc32.md) · [Contents](../../README.md) · [MD5 →](md5.md)
<!-- /docs:nav -->
