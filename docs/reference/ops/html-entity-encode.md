<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# HTML Entity Encode

Replace characters with references. `scope` is the five HTML-special characters ``& < > " '``, those plus every non-ASCII character, or all characters. `named` uses the shortest name ending in ``;`` (hex where there is none); astral characters get one reference each.

| Id | Input | Output | Background |
|---|---|---|---|
| `html-entity-encode` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

HTML Entity Encode replaces characters with HTML character references so that a browser shows
them as text instead of reading them as markup.

| `scope` | Replaces |
|---|---|
| `special` | the five characters `&` `<` `>` `"` `'` |
| `non-ascii` | those five plus every character above U+007F |
| `all` | every character |

| `format` | `é` becomes | `'` becomes |
|---|---|---|
| `named` | `&eacute;` | `&apos;` |
| `decimal` | `&#233;` | `&#39;` |
| `hex` | `&#xE9;` | `&#x27;` |

`named` picks the shortest name that ends in `;`, and uses a hex reference where HTML defines
no name (such as for most emoji): `café ✓ 👋` becomes `caf&eacute; &check; &#x1F44B;`. A
character above U+FFFF gets one reference for its code point, never two for a surrogate pair.

**Worked example.** `<p>café</p>` with the default scope becomes `&lt;p&gt;café&lt;/p&gt;`:
the browser shows the tags as text instead of creating a paragraph.

## Security notes

Escaping the five special characters prevents HTML injection (cross-site scripting) when a
value is placed in element content or in a **quoted** attribute value. It is not enough
inside `<script>`, `<style>`, unquoted attributes, or URLs such as `href="javascript:…"`:
each context needs its own encoding. Use your template engine's auto-escaping where you can.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `scope` | choice | `special` | `special`, `non-ascii`, `all` |
| `format` | choice | `named` | `named`, `decimal`, `hex` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `<p>café</p>` | — | `&lt;p&gt;café&lt;/p&gt;` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKKMnN0U3NK8ksqQRSyfkpqUo6SolF6UAl1bW1sbUA&i=symwS05MO7zSRr_ADgA), or search for "HTML Entity Encode" in the operation list.

**CLI:**

```sh
unichef op html-entity-encode '<p>café</p>'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("html-entity-encode", {}, Dish.of_string("<p>café</p>"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("html-entity-encode", {}, { type: 'string', value: "<p>café</p>" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [HTML Standard: named character references](https://html.spec.whatwg.org/multipage/named-characters.html)
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- Related: [HTML Entity Decode](html-entity-decode.md), [Escape Unicode](escape-unicode.md)

<!-- docs:nav -->
---

[← HTML Entity Decode](html-entity-decode.md) · [Contents](../../README.md) · [IDNA To ASCII →](idna-to-ascii.md)
<!-- /docs:nav -->
