<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Quoted-Printable Encode

Encode bytes as quoted-printable, with lines of at most 76 characters. In `text` mode, LF and CRLF are line breaks, written as CRLF; in `binary` mode they are escaped.

| Id | Input | Output | Background |
|---|---|---|---|
| `quoted-printable-encode` | bytes | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

Quoted-printable (RFC 2045) keeps text readable while making it safe for email, which
historically allowed only 7-bit ASCII lines of limited length.

1. The input is encoded as UTF-8.
2. Printable ASCII characters (33 to 126) other than `=` are kept as they are.
3. Every other byte is written as `=` and two upper-case hex digits. `=` itself becomes
   `=3D`.
4. Spaces and tabs are kept, except at the end of a line, where they would be lost in
   transit, so they are written as `=20` and `=09`.
5. Lines longer than 76 characters are split with a **soft line break**: an `=` at the end of
   the line, which the decoder removes.

**Worked example.** `café = 4€` becomes `caf=C3=A9 =3D 4=E2=82=AC`: `é` is `c3 a9`, `=` is
escaped and `€` is `e2 82 ac`.

In `text` mode, LF and CRLF in the input are line breaks and are written as CRLF, as email
requires. In `binary` mode they are data and are escaped as `=0A` and `=0D`, so the exact
bytes survive.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `mode` | choice | `text` | `text`, `binary` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `café = 4€` | — | `caf=C3=A9 =3D 4=E2=82=AC` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLM0vSU3RLSjKzCtJTMpJ1U3NS85PSVXSUUosSgeqq66tja0FAA&i=S05MO7xSwVbB5FHTGgA), or search for "Quoted-Printable Encode" in the operation list.

**CLI:**

```sh
unichef op quoted-printable-encode 'café = 4€'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("quoted-printable-encode", {}, Dish.of_string("café = 4€"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("quoted-printable-encode", {}, { type: 'string', value: "café = 4€" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 2045 §6.7: quoted-printable](https://www.rfc-editor.org/rfc/rfc2045#section-6.7)
- Related: [Quoted-Printable Decode](quoted-printable-decode.md), [To Base64](to-base64.md), [Web encodings](../../learn/web-encodings.md)

<!-- docs:nav -->
---

[← Quoted-Printable Decode](quoted-printable-decode.md) · [Contents](../../README.md) · [Swap Endianness →](swap-endianness.md)
<!-- /docs:nav -->
