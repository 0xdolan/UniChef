<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# HTML Entity Decode

Decode named and numeric character references as HTML does in text content: the longest known name wins, legacy names may omit the semicolon, numeric references may omit it, 0x80-0x9F map through windows-1252, and 0, surrogates and values above 10FFFF become U+FFFD. An `&` that starts no reference stays as it is. `strict` fails on a missing semicolon, an unknown name or an invalid code point instead.

| Id | Input | Output | Background |
|---|---|---|---|
| `html-entity-decode` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

HTML Entity Decode turns character references back into characters, following the HTML
parser's rules for text content:

- **Named references** such as `&eacute;` and `&lt;`. Of the 2 231 names HTML defines, the
  longest one that matches wins, so `&notit;` is `¬it;` (because `&notin;` does not match but
  `&not` does).
- **Legacy names** such as `&amp`, `&lt` and `&copy` work without the semicolon, as in old
  web pages.
- **Numeric references**: `&#233;` (decimal) and `&#xE9;` (hex) are `é`, with or without the
  semicolon.
- **Windows-1252 quirk**: numbers 128–159 are read as Windows-1252, so `&#150;` is `–` (en
  dash), not the C1 control U+0096.
- **Invalid numbers**: 0, surrogates and values above 10FFFF become U+FFFD.
- An `&` that starts no reference stays as it is.

**Worked example.** `&lt;p&gt;caf&eacute; &#x1F44B;&lt;/p&gt;` becomes `<p>café 👋</p>`.

With `strict`, a missing semicolon, an unknown name or an invalid number fails the step,
which helps when you check that your own output is well-formed.

## Security notes

Browsers are this forgiving too, so attackers use references to hide payloads from naive
filters: `<a href="&#106;avascript&colon;alert(1)">` is a `javascript:` link. Decode before
you inspect.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `&lt;p&gt;caf&eacute; &#x1F44B;&lt;/p&gt;` | — | `<p>café 👋</p>` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKKMnN0U3NK8ksqdRNSU3OT0lV0lFKLEoHKqmurY2tBQA&i=U8spsS5QSy-xTk5MU0tNTC4tSbVWUFOuMHQzMXGyVgPK6oOlAQ), or search for "HTML Entity Decode" in the operation list.

**CLI:**

```sh
unichef op html-entity-decode '&lt;p&gt;caf&eacute; &#x1F44B;&lt;/p&gt;'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("html-entity-decode", {}, Dish.of_string("&lt;p&gt;caf&eacute; &#x1F44B;&lt;/p&gt;"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("html-entity-decode", {}, { type: 'string', value: "&lt;p&gt;caf&eacute; &#x1F44B;&lt;/p&gt;" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [HTML Standard: character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)
- [HTML Standard: named character references](https://html.spec.whatwg.org/multipage/named-characters.html)
- Related: [HTML Entity Encode](html-entity-encode.md), [Unescape Unicode](unescape-unicode.md)

<!-- docs:nav -->
---

[← From Punycode](from-punycode.md) · [Contents](../../README.md) · [HTML Entity Encode →](html-entity-encode.md)
<!-- /docs:nav -->
