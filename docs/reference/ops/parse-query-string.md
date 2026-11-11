<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Parse Query String

Split `name=value` pairs on `&` and percent-decode them as UTF-8. A leading `?` is ignored. In `object` output a repeated name collects its values into an array.

| Id | Input | Output | Background |
|---|---|---|---|
| `parse-query-string` | string | json | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Parse Query String splits `name=value` pairs on `&` and percent-decodes names and values as
UTF-8. A leading `?` is ignored, a pair without `=` has an empty value, and with
`plus_as_space` (the default, as in HTML forms) `+` is a space.

**Worked examples.**
- `?q=caf%C3%A9+au+lait&tag=a&tag=b` gives `{"q":"café au lait","tag":["a","b"]}`. In the
  `object` output, a repeated name collects its values into an array.
- With `output=pairs`, `q=a+b&x` gives `[["q","a b"],["x",""]]`, which keeps the order and
  every duplicate exactly.

## Security notes

Frameworks treat a repeated name differently: some take the first value, some the last, some
all of them. HTTP parameter pollution uses that difference to slip a value past a check. Use
`output=pairs` to see every value.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `output` | choice | `object` | `object`, `pairs` |
| `plus_as_space` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `?q=caf%C3%A9+au+lait&tag=a&tag=b&x` | — | `{"q":"café au lait","tag":["a","b"],"x":""}` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSCwqTtUtLE0tqtQtLinKzEtX0lFKLEoHKqmurY2tBQA&i=sy-0TU5MU3U2VnW01E4s1c5JzCxRK0lMt00Ek0lqFQA), or search for "Parse Query String" in the operation list.

**CLI:**

```sh
unichef op parse-query-string '?q=caf%C3%A9+au+lait&tag=a&tag=b&x'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("parse-query-string", {}, Dish.of_string("?q=caf%C3%A9+au+lait&tag=a&tag=b&x"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("parse-query-string", {}, { type: 'string', value: "?q=caf%C3%A9+au+lait&tag=a&tag=b&x" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [WHATWG URL Standard: application/x-www-form-urlencoded](https://url.spec.whatwg.org/#application/x-www-form-urlencoded)
- [OWASP: HTTP parameter pollution](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/04-Testing_for_HTTP_Parameter_Pollution)
- Related: [Parse URL](parse-url.md), [URL Decode](url-decode.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← JSON to CSV](json-to-csv.md) · [Contents](../../README.md) · [Parse URL →](parse-url.md)
<!-- /docs:nav -->
