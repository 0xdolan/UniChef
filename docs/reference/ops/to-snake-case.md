<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# To Snake case

Split the text into words and join them in lower case with underscores. Words are runs of letters, marks and numbers, split where lower case meets upper case, before the last capital of an acronym and between letters and numbers; apostrophes are dropped. With `context_aware`, only identifiers outside double-quoted strings change.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-snake-case` | string | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

The text is split into words first, then joined in lower case with underscores.

A word is a run of letters, marks and numbers; anything else (spaces, punctuation, `_`, `-`)
separates words, and apostrophes (`'` and `’`) are dropped. A word also ends:

- where a lower-case letter is followed by an upper-case one (`userName` → `user`, `Name`),
- before the last capital of an acronym when a lower-case letter follows (`HTTPResponse` →
  `HTTP`, `Response`),
- between letters and digits (`v2` → `v`, `2`).

Letters are classified with the Unicode character database, so every script counts, and
accents are kept: `Ça va? l'été 2024` gives `ça_va_lété_2024`.

**Worked example: `parseHTTPResponse v2`**

The words are `parse`, `HTTP`, `Response`, `v` and `2`, so the result is `parse_http_response_v_2`.

With `context_aware`, only names made of ASCII letters, digits, `_` and `-` outside
double-quoted strings change: `const userName = "Hello World";` gives `const user_name = "Hello World";`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `context_aware` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `parseHTTPResponse v2` | — | `parse_http_response_v_2` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydctzkvMTtVNTixOVdJRSixKB8pW19bG1gIA&i=K0gsKk71CAkJCEotLsjPK05VKDMCAA), or search for "To Snake case" in the operation list.

**CLI:**

```sh
unichef op to-snake-case 'parseHTTPResponse v2'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-snake-case", {}, Dish.of_string("parseHTTPResponse v2"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-snake-case", {}, { type: 'string', value: "parseHTTPResponse v2" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Naming conventions on Wikipedia](https://en.wikipedia.org/wiki/Naming_convention_(programming))
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [To Kebab case](to-kebab-case.md), [To Camel case](to-camel-case.md)

<!-- docs:nav -->
---

[← To Kebab case](to-kebab-case.md) · [Contents](../../README.md) · [Trim →](trim.md)
<!-- /docs:nav -->
