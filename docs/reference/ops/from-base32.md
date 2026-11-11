<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base32

Decode Base32. Without `strict`, it is case-insensitive and skips other characters.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base32` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each character is looked up in the alphabet to get 5 bits; the bits are joined and cut into
bytes, and the leftover bits at the end (fewer than eight, all zero in canonical data) are
dropped. `JBUQ====` gives `01001 00001 10100 10000`, which is `48 69` plus four zero bits:
`Hi`.

Without `strict`, lower-case letters are accepted and other characters (spaces, dashes,
missing padding) are skipped, so a secret copied from an authenticator setup page such as
`jbsw y3dp` works. With `strict`, only upper-case alphabet characters with correct padding are
accepted.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `rfc4648` | `rfc4648`, `hex` |
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `JBSWY3DP` | — | `Hello` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE41NlLSUUosSgfKVdfWxtYCAA&i=83IKDo80dgkAAA), or search for "From Base32" in the operation list.

**CLI:**

```sh
unichef op from-base32 JBSWY3DP
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base32", {}, Dish.of_string("JBSWY3DP"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base32", {}, { type: 'string', value: "JBSWY3DP" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4648 §6: Base32](https://www.rfc-editor.org/rfc/rfc4648#section-6)
- Related: [To Base32](to-base32.md), [From Base64](from-base64.md)

<!-- docs:nav -->
---

[← Encode Text](encode-text.md) · [Contents](../../README.md) · [From Base58 →](from-base58.md)
<!-- /docs:nav -->
