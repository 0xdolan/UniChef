<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Data

# Parse URL

Split a URL into its RFC 3986 parts without decoding or normalising them. An absent part is null; surrounding ASCII whitespace is ignored.

| Id | Input | Output | Background |
|---|---|---|---|
| `parse-url` | string | json | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Parse URL splits a URL into the parts defined by RFC 3986, without decoding or normalising
them, so you see exactly what is there:

```
https://user:pw@example.com:8443/a/b%20c?q=1&r=%C3%A9#frag
└─┬─┘   └┬─┘└┬┘ └────┬────┘ └┬─┘└──┬───┘ └─────┬────┘ └┬─┘
scheme  user pass   host     port  path     query    fragment
```

**Worked example.** That URL gives

```json
{"scheme":"https","username":"user","password":"pw","host":"example.com","port":8443,
 "path":"/a/b%20c","query":"q=1&r=%C3%A9","fragment":"frag"}
```

An absent part is `null`: `mailto:ada@example.com` has only a scheme and a path. IPv6 hosts
keep their brackets (`[::1]`). Decode the query with
[Parse Query String](parse-query-string.md) and the parts with [URL Decode](url-decode.md).

## Security notes

The user-info part is a phishing trick: in `https://www.bank.example@evil.example/`, the host
is `evil.example`. Parsers that disagree about where the host starts (backslashes, extra `@`
signs, odd ports) have caused SSRF and open-redirect bugs; compare this strict RFC 3986 view
with what the application sees.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `https://zoë:pw@example.com:8443/a/b?q=1#top` | — | `{"scheme":"https","username":"zoë","password":"pw","host":"example.com","port":8443,"path":"/a/b","query":"q=1","fragment":"top"}` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSCwqTtUtLcpR0lFKLEoHylTX1sbWAgA&i=yygpKSi20tevyj-82qqg3CG1IjG3ICdVLzk_18rCxMRYP1E_yb7Q1lC5JL8AAA), or search for "Parse URL" in the operation list.

**CLI:**

```sh
unichef op parse-url 'https://zoë:pw@example.com:8443/a/b?q=1#top'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("parse-url", {}, Dish.of_string("https://zoë:pw@example.com:8443/a/b?q=1#top"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("parse-url", {}, { type: 'string', value: "https://zoë:pw@example.com:8443/a/b?q=1#top" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 3986 §3: URI syntax components](https://www.rfc-editor.org/rfc/rfc3986#section-3)
- [A new era of SSRF: exploiting URL parsers (Orange Tsai)](https://www.blackhat.com/docs/us-17/thursday/us-17-Tsai-A-New-Era-Of-SSRF-Exploiting-URL-Parser-In-Trending-Programming-Languages.pdf)
- Related: [Parse Query String](parse-query-string.md), [URL Decode](url-decode.md), [IDNA to Unicode](idna-to-unicode.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Parse Query String](parse-query-string.md) · [Contents](../../README.md) · [Find / replace →](find-replace.md)
<!-- /docs:nav -->
