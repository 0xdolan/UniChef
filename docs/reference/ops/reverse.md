<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Reverse

Reverse the order of graphemes (default), code points or bytes. The first two decode UTF-8 first, replacing ill-formed sequences with U+FFFD.

| Id | Input | Output | Background |
|---|---|---|---|
| `reverse` | bytes | bytes | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

Reverse turns the text back to front, by the `unit` you choose.

| `unit` | `é👋🏽🇮🇶` becomes | Notes |
|---|---|---|
| `graphemes` (default) | `🇮🇶👋🏽é` | each visible character stays whole |
| `code-points` | the skin-tone modifier, `👋`, … | modifiers and flags come apart |
| `bytes` | invalid UTF-8 | for binary data |

**Worked example.** `abc` gives `cba`. With `graphemes`, `é👋🏽🇮🇶` gives `🇮🇶👋🏽é`. With
`code-points`, `é👋🏽` gives the skin-tone modifier first, then `👋`, then `é`: the modifier no
longer follows its base.

The first two units decode UTF-8 first, replacing ill-formed sequences with U+FFFD. Use
`bytes` to undo byte-reversed data, a common trick in malware and CTF challenges.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `unit` | choice | `graphemes` | `graphemes`, `code-points`, `bytes` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `é👋🏽` | `unit=graphemes` | `👋🏽é` |
| `abc` | — | `cba` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSgVJpirpKCUWpQPFq5VK8zJLgBLpRYkFGam5qcVKtbWxtQA&i=Sz3T-GH-xO4P8_v3AgA), or search for "Reverse" in the operation list.

**CLI:**

```sh
unichef op reverse --arg unit=graphemes 'é👋🏽'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("reverse", {"unit": "graphemes"}, Dish.of_string("é👋🏽"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("reverse", {"unit": "graphemes"}, { type: 'string', value: "é👋🏽" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #29: grapheme clusters](https://www.unicode.org/reports/tr29/)
- Related: [Grapheme Split](grapheme-split.md), [Head](head.md), [Data and text](../../learn/data-and-text.md)

<!-- docs:nav -->
---

[← Regex extract](regex-extract.md) · [Contents](../../README.md) · [Sort lines →](sort-lines.md)
<!-- /docs:nav -->
