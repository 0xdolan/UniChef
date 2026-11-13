<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# URL Decode

Decode %XX escapes; malformed escapes stay as they are. Never fails.

| Id | Input | Output | Background |
|---|---|---|---|
| `url-decode` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

URL Decode replaces every `%` followed by two hex digits with the byte of that value, then
reads the bytes as UTF-8. `caf%C3%A9` becomes the bytes `63 61 66 c3 a9`, which is `café`.

It never fails. An escape that is not followed by two hex digits (`%2x`, a `%` at the end)
is kept as it is, and bytes that are not valid UTF-8 become U+FFFD. With `plus-as-space`, a
`+` becomes a space, as in HTML form data (`application/x-www-form-urlencoded`); otherwise
`+` stays a plus sign, as in a URL path.

**Worked example.** `a+b%2x%41` gives `a+b%2xA`: the `+` is kept, `%2x` is not a valid escape,
and `%41` is `A`.

## Security notes

Run it more than once to see double-encoded payloads: `%253Cscript%253E` decodes to
`%3Cscript%3E` and then to `<script>`. If a value is decoded twice somewhere in a system but
checked only once, an attacker can hide `../` or `<script>` from the check.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `plus-as-space` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `caf%C3%A9%20au%20lait` | — | `café au lait` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLcrRTUlNzk9JVdJRSixKB0pV19bG1gIA&i=S05MU3U2VnW0VDUySCwFEjmJmSUA), or search for "URL Decode" in the operation list.

**CLI:**

```sh
unichef op url-decode caf%C3%A9%20au%20lait
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("url-decode", {}, Dish.of_string("caf%C3%A9%20au%20lait"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("url-decode", {}, { type: 'string', value: "caf%C3%A9%20au%20lait" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 3986 §2.1: percent-encoding](https://www.rfc-editor.org/rfc/rfc3986#section-2.1)
- [WHATWG URL Standard: percent-decode](https://url.spec.whatwg.org/#percent-decode)
- Related: [URL Encode](url-encode.md), [Parse Query String](parse-query-string.md), [Web encodings](../../learn/web-encodings.md)

<!-- docs:nav -->
---

[← Unescape String](unescape-string.md) · [Contents](../../README.md) · [URL Encode →](url-encode.md)
<!-- /docs:nav -->
