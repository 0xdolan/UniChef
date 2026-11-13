<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# To Camel case

Like To Snake case, but the first word is lower case and every later word is title case, with nothing between them.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-camel-case` | string | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

The text is split into words first, then joined with nothing between them: the first word in lower case and every later word in title case.

A word is a run of letters, marks and numbers; anything else (spaces, punctuation, `_`, `-`)
separates words, and apostrophes (`'` and `’`) are dropped. A word also ends:

- where a lower-case letter is followed by an upper-case one (`userName` → `user`, `Name`),
- before the last capital of an acronym when a lower-case letter follows (`HTTPResponse` →
  `HTTP`, `Response`),
- between letters and digits (`v2` → `v`, `2`).

Letters are classified with the Unicode character database, so every script counts, and
accents are kept: `Ça va? l'été 2024` gives `çaVaLété2024`.

**Worked example: `parseHTTPResponse v2`**

The words are `parse`, `HTTP`, `Response`, `v` and `2`, so the result is `parseHttpResponseV2`.

With `context_aware`, only names made of ASCII letters, digits, `_` and `-` outside
double-quoted strings change: `const userName = "Hello World";` gives `const userName = "Hello World";`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `context_aware` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `parseHTTPResponse v2` | — | `parseHttpResponseV2` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyddNTsxNzQGSxalKOkqJRelA2era2thaAA&i=K0gsKk71CAkJCEotLsjPK05VKDMCAA), or search for "To Camel case" in the operation list.

**CLI:**

```sh
unichef op to-camel-case 'parseHTTPResponse v2'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-camel-case", {}, Dish.of_string("parseHTTPResponse v2"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-camel-case", {}, { type: 'string', value: "parseHTTPResponse v2" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Naming conventions on Wikipedia](https://en.wikipedia.org/wiki/Naming_convention_(programming))
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [To Snake case](to-snake-case.md), [To Kebab case](to-kebab-case.md)

<!-- docs:nav -->
---

[← Tail](tail.md) · [Contents](../../README.md) · [To Kebab case →](to-kebab-case.md)
<!-- /docs:nav -->
