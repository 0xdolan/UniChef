<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# Unescape String

Replace backslash escapes: \n \r \t \b \f \v \a, quotes and backslash, octal \nnn, hex \xnn, \unnnn (surrogate pairs combine) and \u{n...}. Other backslashes stay as they are.

| Id | Input | Output | Background |
|---|---|---|---|
| `unescape-string` | string | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

Each backslash escape is replaced by the character it stands for:

| Escape | Character |
|---|---|
| `\n` `\r` `\t` `\b` `\f` `\v` `\a` | line feed, CR, tab, backspace, form feed, vertical tab, bell |
| `\\` `\'` `\"` | backslash and quotes |
| `\101` | octal, up to `\377` |
| `\x41` | two hex digits |
| `\u00e9`, `\u{1F600}` | a code point |

A high and a low surrogate written as two `\u` escapes (`\ud83d\ude00`) combine into one
character. An escape that names a lone surrogate or a value past U+10FFFF is an error. Other
backslashes are left as they are.

**Worked example**

`\x41\101 \u00e9 \ud83d\ude00` gives `AA é 😀`.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Don\'t stop\n` | — | `Don't stop\n` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzUstTk4sSNUtLinKzEtX0lFKLEoHylfX1sbWAgA&i=c8nPi1EvUSguyS-IyQMA), or search for "Unescape String" in the operation list.

**CLI:**

```sh
unichef op unescape-string 'Don\'"'"'t stop\n'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("unescape-string", {}, Dish.of_string("Don\\'t stop\\n"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("unescape-string", {}, { type: 'string', value: "Don\\'t stop\\n" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Escape sequences in JavaScript strings (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [Escape String](escape-string.md), [Unescape Unicode Characters](unescape-unicode.md)

<!-- docs:nav -->
---

[← To Punycode](to-punycode.md) · [Contents](../../README.md) · [URL Decode →](url-decode.md)
<!-- /docs:nav -->
