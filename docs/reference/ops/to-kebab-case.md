<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# To Kebab case

Like To Snake case, but the words are joined with hyphens.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-kebab-case` | string | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

The text is split into words first, then joined in lower case with hyphens.

A word is a run of letters, marks and numbers; anything else (spaces, punctuation, `_`, `-`)
separates words, and apostrophes (`'` and `’`) are dropped. A word also ends:

- where a lower-case letter is followed by an upper-case one (`userName` → `user`, `Name`),
- before the last capital of an acronym when a lower-case letter follows (`HTTPResponse` →
  `HTTP`, `Response`),
- between letters and digits (`v2` → `v`, `2`).

Letters are classified with the Unicode character database, so every script counts, and
accents are kept: `Ça va? l'été 2024` gives `ça-va-lété-2024`.

**Worked example: `parseHTTPResponse v2`**

The words are `parse`, `HTTP`, `Response`, `v` and `2`, so the result is `parse-http-response-v-2`.

With `context_aware`, only names made of ASCII letters, digits, `_` and `-` outside
double-quoted strings change: `const userName = "Hello World";` gives `const user-name = "Hello World";`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `context_aware` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `parseHTTPResponse v2` | — | `parse-http-response-v-2` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydfNTk1KTNJNTixOVdJRSixKB8pW19bG1gIA&i=K0gsKk71CAkJCEotLsjPK05VKDMCAA), or search for "To Kebab case" in the operation list.

**CLI:**

```sh
unichef op to-kebab-case 'parseHTTPResponse v2'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-kebab-case", {}, Dish.of_string("parseHTTPResponse v2"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-kebab-case", {}, { type: 'string', value: "parseHTTPResponse v2" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Naming conventions on Wikipedia](https://en.wikipedia.org/wiki/Naming_convention_(programming))
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [To Snake case](to-snake-case.md), [To Camel case](to-camel-case.md)

<!-- docs:nav -->
---

[← To Camel case](to-camel-case.md) · [Contents](../../README.md) · [To Snake case →](to-snake-case.md)
<!-- /docs:nav -->
