<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base64

Decode Base64. Without `strict`, characters outside the alphabet are skipped.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base64` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

From Base64 reverses [To Base64](to-base64.md): each character is looked up in the alphabet
to get a 6-bit value, four values are joined into 24 bits, and those are cut into three
bytes. Padding `=` at the end says the last group carried only one or two bytes.

**Worked example: `SGk=`**

```
char      S      G      k      =
index     18     6      36     (pad)
6-bit     010010 000110 100100
bytes     01001000 01101001 (00: dropped)
          48 (H)   69 (i)
```

By default the decoder is forgiving, so you can paste data straight from an email, a log or
a script:
- whitespace and line breaks are skipped, and so is any character outside the alphabet;
- missing padding is accepted.

With `strict`, the input must be canonical: only alphabet characters, correct padding, and
zero bits where the encoder would have written zeros. Use strict mode when you check that
data was produced correctly or compare two implementations: lax decoders that accept
different inputs have caused signature bypasses.

`SGVsbG8` style strings starting with `eyJ` (`{"`), `PD94` (`<?x`), `TVq` (`MZ`), `H4sI`
(gzip) or `JVBER` (`%PDF`) tell you what is inside before you decode it.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `alphabet` | choice | `standard` | `standard`, `url`, `custom` |
| `custom` | string | — | — |
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `SGVsbG8sIHdvcmxkIQ==` | — | `Hello, world!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE41M1HSUUosSgfKVdfWxtYCAA&i=C3YPK05ytyj29EgpS86tyPYMtLUFAA), or search for "From Base64" in the operation list.

**CLI:**

```sh
unichef op from-base64 SGVsbG8sIHdvcmxkIQ==
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base64", {}, Dish.of_string("SGVsbG8sIHdvcmxkIQ=="))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base64", {}, { type: 'string', value: "SGVsbG8sIHdvcmxkIQ==" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 4648 §4: Base64](https://www.rfc-editor.org/rfc/rfc4648#section-4)
- [RFC 4648 §3.5: canonical encoding](https://www.rfc-editor.org/rfc/rfc4648#section-3.5)
- Related: [To Base64](to-base64.md), [Gunzip](gunzip.md), [JWT Decode](jwt-decode.md)

<!-- docs:nav -->
---

[← From Base62](from-base62.md) · [Contents](../../README.md) · [From Base85 →](from-base85.md)
<!-- /docs:nav -->
