<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# URL Encode

Percent-encode with upper-case hex over the UTF-8 bytes of the input.

| Id | Input | Output | Background |
|---|---|---|---|
| `url-encode` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

URL Encode encodes the input as UTF-8, then writes each byte that may not appear as it is as
`%` followed by two upper-case hex digits.

**Worked example: `café au lait`**

| Character | UTF-8 bytes | Output |
|---|---|---|
| `c`, `a`, `f` | `63 61 66` | `caf` (unreserved) |
| `é` | `c3 a9` | `%C3%A9` |
| space | `20` | `%20` |

Result: `caf%C3%A9%20au%20lait`.

| `mode` | Leaves as it is | Use it for |
|---|---|---|
| `component` | `A–Z a–z 0–9 - . _ ~` | one query value or path segment (like `encodeURIComponent`) |
| `reserved-only` | everything except the reserved characters `: / ? # [ ] @ ! $ & ' ( ) * + , ; =` and `%` | neutralising URL syntax inside text |
| `all` | nothing: every byte is escaped | testing filters, mimicking obfuscated links |

Spaces always become `%20`. HTML forms write `+` instead; [URL Decode](url-decode.md) can read
both.

## Security notes

Encode untrusted values **before** putting them into a URL. Building
`https://api.example/?q=` + input without encoding lets the input add parameters (`&admin=1`)
or change the path. Encoding more than once (`%2520`) is a sign of double encoding, which
attackers use to slip past filters that decode once.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `mode` | choice | `component` | `component`, `all`, `reserved-only` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `café au lait` | — | `caf%C3%A9%20au%20lait` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLcrRTc1Lzk9JVdJRSixKB0pV19bG1gIA&i=S05MO7xSIbFUIScxswQA), or search for "URL Encode" in the operation list.

**CLI:**

```sh
unichef op url-encode 'café au lait'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("url-encode", {}, Dish.of_string("café au lait"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("url-encode", {}, { type: 'string', value: "café au lait" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 3986 §2: characters in URIs](https://www.rfc-editor.org/rfc/rfc3986#section-2)
- [MDN: encodeURIComponent](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent)
- [OWASP: double encoding](https://owasp.org/www-community/Double_Encoding)
- Related: [URL Decode](url-decode.md), [Parse URL](parse-url.md), [Web encodings](../../learn/web-encodings.md)

<!-- docs:nav -->
---

[← URL Decode](url-decode.md) · [Contents](../../README.md) · [Analyse Characters →](analyse-characters.md)
<!-- /docs:nav -->
