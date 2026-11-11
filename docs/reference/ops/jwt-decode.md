<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# JWT Decode

Split a JWT into `header`, `payload` and `signature` (base64url text), without checking the signature or time claims. Surrounding whitespace is ignored.

| Id | Input | Output | Background |
|---|---|---|---|
| `jwt-decode` | string | json | [Encryption](../../learn/encryption.md) |
<!-- /docs:head -->

## How it works

JWT Decode splits a token at its two dots and decodes each part from base64url, without
checking anything.

**Worked example.** The jwt.io sample token
`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`
gives:

```json
{
  "header": {"alg": "HS256", "typ": "JWT"},
  "payload": {"sub": "1234567890", "name": "John Doe", "iat": 1516239022},
  "signature": "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
}
```

The signature stays as base64url text, since it is binary. Tokens begin with `eyJ`, the
base64url form of `{"`, which helps you spot them in logs, cookies and `Authorization:
Bearer` headers.

`iat`, `exp` and `nbf` are Unix timestamps in seconds: `1516239022` is 2018-01-18 01:30:22
UTC.

## Security notes

Decoding is not verifying. Anyone can change the payload of a token and re-encode it; only
[JWT Verify](jwt-verify.md) with the right key tells you whether the token is genuine. Tokens
in logs and tickets are credentials: treat them like passwords.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw` | — | `{"header":{"alg":"HS256","typ":"JWT"},"payload":{"sub":"zoe","name":"Zoë"},"signature":"LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw"}` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKKi_RTUlNzk9JVdJRSixKB0pV19bG1gIA&i=S630ykhyT870z_TyDK3yNPTL9Cz2zAsyTXb2NPPMLogIc_ay1Eut9KpKCfcEKTJLMgrN9HH2Ko0MN8zxzMrPDM-NdymsBCryyQty9TE39vZwCwuz8E6xME_NDjUuSXMuCXEN8PaICvQItjQ1rywqNQwuBwA), or search for "JWT Decode" in the operation list.

**CLI:**

```sh
unichef op jwt-decode eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("jwt-decode", {}, Dish.of_string("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("jwt-decode", {}, { type: 'string', value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9.LnREL73KHFVV8Kd87ekU3tfCtTEPKHZQHS957yru1Sw" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 7515 §3: JWS compact serialisation](https://www.rfc-editor.org/rfc/rfc7515#section-3)
- Related: [JWT Verify](jwt-verify.md), [From Base64](from-base64.md), [JSON Beautify](json-beautify.md)

<!-- docs:nav -->
---

[← Generate Random Bytes](generate-random-bytes.md) · [Contents](../../README.md) · [JWT Sign →](jwt-sign.md)
<!-- /docs:nav -->
