<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# JWT Sign

Sign a JSON object as a JWT. `key` is the HMAC secret for HS*, or a PEM/DER private key. `header` adds JSON fields after `alg` and `typ` ("JWT"); it may replace `typ` but not `alg`. PS* and ES* signatures are randomised; `none` warns W_INSECURE.

| Id | Input | Output | Background |
|---|---|---|---|
| `jwt-sign` | json | string | [Encryption](../../learn/encryption.md) |
<!-- /docs:head -->

## How it works

A JSON Web Token (RFC 7519) is three base64url parts joined with dots:
`header.payload.signature`.

1. **Header**: `{"alg":"HS256","typ":"JWT"}` plus any fields from `header`, encoded as
   base64url without padding.
2. **Payload**: the input JSON object (the claims), encoded the same way.
3. **Signature**: the chosen algorithm applied to the ASCII string `header.payload`, then
   base64url-encoded.

| `algorithm` | Signature | `key` |
|---|---|---|
| `HS256`, `HS384`, `HS512` | [HMAC](hmac.md) with SHA-2 | shared secret |
| `RS256`… | RSASSA-PKCS1-v1_5 | RSA private key (PEM or DER) |
| `PS256`… | RSASSA-PSS (randomised) | RSA private key |
| `ES256`, `ES384`, `ES512` | ECDSA on P-256, P-384, P-521 (randomised) | EC private key |
| `EdDSA` | Ed25519 or Ed448 | Ed25519 or Ed448 private key |
| `none` | empty | none: warns `W_INSECURE` |

**Worked example.** The payload `{"sub":"1234567890","name":"John Doe","iat":1516239022}`
with `HS256` and the key `your-256-bit-secret` gives the token from jwt.io, which ends in
`.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`. The key is shorter than 256 bits, so UniChef
warns `W_INSECURE`, as RFC 7518 requires a key at least as long as the hash.

The payload is only encoded, not encrypted: anyone can read it with [JWT Decode](jwt-decode.md).
Never put secrets in it.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `algorithm` | choice | `HS256` | `HS256`, `HS384`, `HS512`, `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512`, `ES256`, `ES384`, `ES512`, `EdDSA`, `none` |
| `key` | bytes (utf8, hex, base64, latin1), secret | — | — |
| `header` | string | — | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `{"sub": "zoe", "name": "Zoë"}` | `key=utf8:secret` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=FYpBCoAgFAXv8ta2aBdeJVqI_cQKFb8aId6932oYZjoaZfYxQM8KXCgx9NoREzTOp0zsXYCCyU5Cx0XvDwo27j44mWo5FhmauSuJMtlMBWOMbXw&i=q1YqLk1SslJQqspPVdJRUMpLzE0FcaPyD69WqgUA), or search for "JWT Sign" in the operation list.

**CLI:**

```sh
unichef op jwt-sign --arg key=utf8:secret '{"sub": "zoe", "name": "Zoë"}'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("jwt-sign", {"key": {"encoding": "utf8", "value": "secret"}}, Dish.of_string("{\"sub\": \"zoe\", \"name\": \"Zoë\"}"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("jwt-sign", {"key": {"encoding": "utf8", "value": "secret"}}, { type: 'string', value: "{\"sub\": \"zoe\", \"name\": \"Zoë\"}" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 7518: JSON Web Algorithms](https://www.rfc-editor.org/rfc/rfc7518)
- [jwt.io introduction](https://jwt.io/introduction)
- Related: [JWT Verify](jwt-verify.md), [JWT Decode](jwt-decode.md), [HMAC](hmac.md), [HMAC and key derivation](../../learn/hmac-and-key-derivation.md)

<!-- docs:nav -->
---

[← JWT Decode](jwt-decode.md) · [Contents](../../README.md) · [JWT Verify →](jwt-verify.md)
<!-- /docs:nav -->
