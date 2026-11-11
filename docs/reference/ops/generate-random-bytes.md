<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# Generate Random Bytes

Replace the input with `length` random bytes: from the platform's secure random generator, or, when the recipe has a `seed`, from SHA-256 in counter mode.

| Id | Input | Output | Background |
|---|---|---|---|
| `generate-random-bytes` | bytes | bytes | [Encryption](../../learn/encryption.md) |
<!-- /docs:head -->

## How it works

Generate Random Bytes replaces the input with `length` random bytes.

- **Without a seed**, the bytes come from the platform's cryptographically secure generator:
  `secrets.token_bytes` in Python and `crypto.getRandomValues` in the browser. Use them for
  keys, IVs, salts and tokens.
- **With a `seed`** in the recipe, the bytes are SHA-256 in counter mode over the seed, so the
  same recipe gives the same bytes every time. That makes tests, examples and shared recipes
  reproducible, but the output is only as secret as the seed.

**Worked example.** A recipe with `generate-random-bytes` (`length=16`) and then
[To Hex](to-hex.md) gives a new 32-digit hex string on every run, suitable as an AES-128 key.
Follow with [To Base64](to-base64.md) for a URL-safe token.

## Security notes

Never put a seed in a recipe whose output you use as a real key: anyone with the recipe can
regenerate it. 16 bytes (128 bits) is enough for keys and tokens that must not be guessed.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `length` | integer 1 to 67108864 | `32` | — |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKT81LLUosSdUtSsxLyc_VTaosSS1W0lFKLEoHqqqurY2tBQA), or search for "Generate Random Bytes" in the operation list.

**CLI:**

```sh
unichef op generate-random-bytes
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("generate-random-bytes", {}, Dish.of_string(""))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("generate-random-bytes", {}, { type: 'string', value: "" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [NIST SP 800-90A: random bit generators](https://csrc.nist.gov/pubs/sp/800/90/a/r1/final)
- [MDN: Crypto.getRandomValues()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
- Related: [AES Encrypt](aes-encrypt.md), [PBKDF2](pbkdf2.md), [Encryption](../../learn/encryption.md)

<!-- docs:nav -->
---

[← Atbash](atbash.md) · [Contents](../../README.md) · [JWT Decode →](jwt-decode.md)
<!-- /docs:nav -->
