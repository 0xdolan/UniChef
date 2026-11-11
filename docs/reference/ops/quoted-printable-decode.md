<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Quoted-Printable Decode

Decode quoted-printable. Soft line breaks and trailing spaces are removed, and other line breaks are kept as they are. Without `strict`, lower-case hex is accepted and a stray `=` is kept.

| Id | Input | Output | Background |
|---|---|---|---|
| `quoted-printable-decode` | string | bytes | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

Quoted-printable decoding replaces each `=XX` with the byte of hex value `XX`, removes soft
line breaks (an `=` at the end of a line, used to keep lines under 76 characters), and drops
spaces and tabs at the end of lines, which RFC 2045 says were added in transit. Other line
breaks are kept as they are.

**Worked example.** `caf=C3=A9 =3D 4=E2=82=AC` gives the bytes `63 61 66 c3 a9 20 3d 20 34 e2 82 ac`,
which as UTF-8 is `café = 4€`.

Without `strict`, lower-case hex (`=c3`) is accepted and an `=` that starts no valid escape is
kept as it is, as most mail clients do. With `strict`, both fail.

Phishing emails often hide their links and text in a quoted-printable body
(`Content-Transfer-Encoding: quoted-printable`); decode the body to read what the user sees.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `caf=C3=A9 =3D 4=E2=82=AC` | — | `café = 4€` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLM0vSU3RLSjKzCtJTMpJ1U1JTc5PSVXSUUosSgeqq66tja0FAA&i=S05Ms3U2tnW0VLA1dlEwsXU1srUwsnV0BgA), or search for "Quoted-Printable Decode" in the operation list.

**CLI:**

```sh
unichef op quoted-printable-decode 'caf=C3=A9 =3D 4=E2=82=AC'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("quoted-printable-decode", {}, Dish.of_string("caf=C3=A9 =3D 4=E2=82=AC"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("quoted-printable-decode", {}, { type: 'string', value: "caf=C3=A9 =3D 4=E2=82=AC" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 2045 §6.7: quoted-printable](https://www.rfc-editor.org/rfc/rfc2045#section-6.7)
- Related: [Quoted-Printable Encode](quoted-printable-encode.md), [From Base64](from-base64.md)

<!-- docs:nav -->
---

[← IDNA To Unicode](idna-to-unicode.md) · [Contents](../../README.md) · [Quoted-Printable Encode →](quoted-printable-encode.md)
<!-- /docs:nav -->
