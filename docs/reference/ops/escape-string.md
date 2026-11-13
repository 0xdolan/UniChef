<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Escape String

Escape a string for a JavaScript literal the way jsesc does. `special` escapes all but printable ASCII, `everything` escapes every character and `minimal` only the quote, backslash, control escapes and line or paragraph separators. `json` uses \u escapes and wraps the result in quotes; `es6` writes characters past U+FFFF as \u{...}.

| Id | Input | Output | Background |
|---|---|---|---|
| `escape-string` | string | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

Each character is looked at in turn, the way the jsesc library does:

1. With `special`, printable ASCII is copied (except quotes and `\`); with `everything`,
   nothing is.
2. The chosen `quote` is escaped as `\'`, `\"` or `` \` ``; other quotes are copied.
3. `\`, backspace, form feed, line feed, CR and tab become `\\`, `\b`, `\f`, `\n`,
   `\r` and `\t`; U+0000 becomes `\0` (not before a digit, and not with `json`).
4. Anything else becomes `\xHH` if it fits in two hex digits, otherwise `\uHHHH`. With
   `es6`, characters past U+FFFF become `\u{HHHHH}`; without it, a surrogate pair.

`minimal` stops after step 3, escaping only JavaScript's non-ASCII spaces besides. `json`
uses `\u` escapes only and wraps the result in the quote.

**Worked example: `It's`, a tab, `"é"` and 😀**

With the defaults the result is `It\'s\t"\xe9"\u{1f600}`. With `json` and `quote=double` it is
`"It's\t\"\u00e9\"\u{1f600}"`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `level` | choice | `special` | `special`, `everything`, `minimal` |
| `quote` | choice | `single` | `single`, `double`, `backtick` |
| `json` | boolean | `false` | — |
| `es6` | boolean | `true` | — |
| `upper_hex` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Don't stop\n` | — | `Don\'t stop\n` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKLU5OLEjVLS4pysxLV9JRSixKB8pW19bG1gIA&i=c8nPUy9RKC7JL-ACAA), or search for "Escape String" in the operation list.

**CLI:**

```sh
unichef op escape-string
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("escape-string", {}, Dish.of_string("Don't stop\n"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("escape-string", {}, { type: 'string', value: "Don't stop\n" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [jsesc](https://github.com/mathiasbynens/jsesc)
- [Escape sequences in JavaScript strings (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [Unescape String](unescape-string.md)

<!-- docs:nav -->
---

[← Encode Text](encode-text.md) · [Contents](../../README.md) · [From Base →](from-base.md)
<!-- /docs:nav -->
