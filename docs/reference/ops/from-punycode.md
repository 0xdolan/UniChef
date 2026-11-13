<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Punycode

Decode Punycode (RFC 3492). With `domain`, split the input into labels as to-punycode does and decode each label that starts with xn-- (any case).

| Id | Input | Output | Background |
|---|---|---|---|
| `from-punycode` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

From Punycode reverses the algorithm of [To Punycode](to-punycode.md):

1. Everything before the last `-` is the basic (ASCII) characters, copied as they are.
2. The rest is a series of base-36 variable-length integers. Each one decodes to a delta that
   says which code point to insert and at which position, using the same adaptive bias as the
   encoder.

**Worked example.** `mnchen-3ya`: the basic part is `mnchen`; `3ya` decodes to the delta 869,
which means insert U+00FC `ü` at position 1. Result: `münchen`.

With `domain`, the input is split into labels, and each label starting with `xn--` (in any
case) is decoded: `xn--bcher-kva.example` becomes `bücher.example`. Use
[IDNA to Unicode](idna-to-unicode.md) to also apply the IDNA validity checks.

## Security notes

Decoding a suspicious `xn--` domain shows the characters behind it. `xn--pypal-4ve.com` is
`pаypal.com` with a Cyrillic `а`. Follow up with [Detect Confusables](detect-confusables.md).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `domain` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `mnchen-3ya` | — | `münchen` |
| `xn--bcher-kva.example` | `domain=true` | `bücher.example` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1S0ozatMzk9JVdJRSixKB8pW19bG1gIA&i=y81LzkjN0zWuTAQA), or search for "From Punycode" in the operation list.

**CLI:**

```sh
unichef op from-punycode mnchen-3ya
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-punycode", {}, Dish.of_string("mnchen-3ya"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-punycode", {}, { type: 'string', value: "mnchen-3ya" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 3492: Punycode](https://www.rfc-editor.org/rfc/rfc3492)
- Related: [To Punycode](to-punycode.md), [IDNA to Unicode](idna-to-unicode.md), [Unicode security](../../learn/unicode-security.md)

<!-- docs:nav -->
---

[← From Octal](from-octal.md) · [Contents](../../README.md) · [Hex to PEM →](hex-to-pem.md)
<!-- /docs:nav -->
