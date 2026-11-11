<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# JWT Verify

Check a JWT's signature and return its payload. The header `alg` must equal `algorithm` (so `none` and algorithm swaps are refused). `key` is the HMAC secret, or a PEM/DER public key, certificate or private key. Tokens with `crit` are refused. Time claims (`exp`, `nbf`) are not checked. Failures raise E_CRYPTO.

| Id | Input | Output | Background |
|---|---|---|---|
| `jwt-verify` | string | json | [Encryption](../../learn/encryption.md) |
<!-- /docs:head -->

## How it works

JWT Verify recomputes or checks the signature over `header.payload` and, if it is valid,
returns the payload.

1. Split the token at the dots and decode the header.
2. Check that the header's `alg` is exactly the `algorithm` you chose. A token that says
   `none`, or `HS256` when you expect `RS256`, is refused.
3. Refuse tokens with a `crit` header, whose extensions this operation does not understand.
4. Verify the signature with `key`: HMAC is recomputed and compared in constant time; RSA,
   ECDSA and EdDSA signatures are checked with the public key (a certificate or private key
   also works).

**Worked example.** The jwt.io sample token (ending `…SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`)
with `key=utf8:your-256-bit-secret` returns
`{"sub":"1234567890","name":"John Doe","iat":1516239022}`. With any other key, the step fails
with `E_CRYPTO: Invalid signature`.

Time claims (`exp`, `nbf`, `iat`) are **not** checked, so you can inspect an expired token.
An application must check them, along with `iss` and `aud`.

## Security notes

The two classic JWT bugs are accepting `alg: none` and *algorithm confusion*: a server that
takes the algorithm from the token can be tricked into checking an `HS256` signature with the
RSA public key as the HMAC secret. Fixing the algorithm, as this operation does, prevents both.
Short HMAC secrets can be cracked offline from one token.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `algorithm` | choice | `HS256` | `HS256`, `HS384`, `HS512`, `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512`, `ES256`, `ES384`, `ES512`, `EdDSA` |
| `key` | bytes (utf8, hex, base64, latin1), secret | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw` | `key=utf8:secret` | `{"sub":"zoe","name":"Zoë"}` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=FYpNCoAgFAbv8q1t0S68SrQQe4oVKv6FiHfvtRqGmYFGKbvgIVeBXChmyH0gREhcb1k4O9MhoJLlNHBT_0Feh9N5y1stZuOhqacSayadqGDOecwP&i=S630ykhyT870z_TyDK3yNPTL9Cz2zAsyTXb2NPPMLogIc_ay1Eut9KpKCfcEKTJLMgrN9HH2Ko0MN8zxzMrPDM-NdymsBCryyQty9TE39vZwCwuz8E6xME_NDjUuSXMuCXEN8PaICvQItjQ1rywqNQwuBwA), or search for "JWT Verify" in the operation list.

**CLI:**

```sh
unichef op jwt-verify --arg key=utf8:secret eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("jwt-verify", {"key": {"encoding": "utf8", "value": "secret"}}, Dish.of_string("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("jwt-verify", {"key": {"encoding": "utf8", "value": "secret"}}, { type: 'string', value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 8725: JWT best current practices](https://www.rfc-editor.org/rfc/rfc8725)
- [PortSwigger: JWT attacks](https://portswigger.net/web-security/jwt)
- Related: [JWT Sign](jwt-sign.md), [JWT Decode](jwt-decode.md), [HMAC and key derivation](../../learn/hmac-and-key-derivation.md)

<!-- docs:nav -->
---

[← JWT Sign](jwt-sign.md) · [Contents](../../README.md) · [PBKDF2 →](pbkdf2.md)
<!-- /docs:nav -->
