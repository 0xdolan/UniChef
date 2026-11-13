<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Unicode Text Format

Draw a line through or under text by adding a combining mark after every character except line breaks: U+0336 for `strikethrough`, then U+0332 for `underline`.

| Id | Input | Output | Background |
|---|---|---|---|
| `unicode-text-format` | string | string | [Small codecs: cat -v, Rison, NetBIOS names, CTX1 and combining marks](../../learn/small-codecs.md) |
<!-- /docs:head -->

## How it works

After every code point except a line feed or carriage return, the operation adds U+0336
COMBINING LONG STROKE OVERLAY when `strikethrough` is on, then U+0332 COMBINING LOW LINE when
`underline` is on. With both off the text is unchanged.

**Worked example: `ab` with both on**

| Character | Written as |
|---|---|
| `a` | `a` U+0336 U+0332 |
| `b` | `b` U+0336 U+0332 |

Result: `a̶̲b̶̲`. How it looks depends on the font: some draw the marks as one line, others as
separate dashes. [Strip Diacritics](strip-diacritics.md) removes the marks again.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `underline` | boolean | `false` | — |
| `strikethrough` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc` | `underline=true` | `a̲b̲c̲` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DcoxCsAgDAXQu_xZh665SukgNS1CNRJjKYh3r_N7Ay9rS1JAm0Mzrg20D0gFoZd0SmRv_Jm_RHMwOAS91xlLI-uTCoNMO895zB8&i=S0xKBgA), or search for "Unicode Text Format" in the operation list.

**CLI:**

```sh
unichef op unicode-text-format --arg underline=true abc
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("unicode-text-format", {"underline": True}, Dish.of_string("abc"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("unicode-text-format", {"underline": true}, { type: 'string', value: "abc" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Combining character on Wikipedia](https://en.wikipedia.org/wiki/Combining_character)
- Guide: [Small codecs](../../learn/small-codecs.md)
- Related: [Strip Diacritics](strip-diacritics.md), [Analyse Characters](analyse-characters.md)

<!-- docs:nav -->
---

[← Trim](trim.md) · [Contents](../../README.md) · [Unique lines →](unique-lines.md)
<!-- /docs:nav -->
