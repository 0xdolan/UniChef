<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Count

Count bytes, or decode UTF-8 (U+FFFD for ill-formed input) and count UTF-16 units, code points, grapheme clusters or lines (LF-separated; a final LF does not start a new line).

| Id | Input | Output | Background |
|---|---|---|---|
| `count` | bytes | integer | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

"How long is this text?" has five answers. Count gives the one you choose.

**Worked example: `é👋🏽`** (precomposed `é`, waving hand, medium skin tone)

| `unit` | Result | Why |
|---|---|---|
| `bytes` | 10 | UTF-8: 2 + 4 + 4 |
| `utf16-units` | 5 | 1 + 2 + 2 (each emoji is a surrogate pair) |
| `code-points` | 3 | U+00E9, U+1F44B, U+1F3FD |
| `graphemes` | 2 | `é` and `👋🏽` (the modifier joins its base) |
| `lines` | 1 | no LF |

Different systems count differently: a database column limits bytes, JavaScript's `length`
counts UTF-16 units, Python's `len` counts code points, and people see graphemes. Lines are
split on LF only, and a final LF does not start a new line.

Input that is not valid UTF-8 is decoded with U+FFFD before counting (except for `bytes`).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `unit` | choice | `code-points` | `bytes`, `utf16-units`, `code-points`, `graphemes`, `lines` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `é👋🏽` | `unit=graphemes` | `2` |
| `é👋🏽` | `unit=code-points` | `4` |
| `é👋🏽` | `unit=bytes` | `11` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKzi_NK1HSUUosSgeKViuV5mWWAIXTixILMlJzU4uVamtjawE&i=Sz3T-GH-xO4P8_v3AgA), or search for "Count" in the operation list.

**CLI:**

```sh
unichef op count --arg unit=graphemes 'é👋🏽'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("count", {"unit": "graphemes"}, Dish.of_string("é👋🏽"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("count", {"unit": "graphemes"}, { type: 'string', value: "é👋🏽" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [It’s not wrong that "🤦🏼‍♂️".length == 7](https://hsivonen.fi/string-length/)
- [UAX #29: grapheme clusters](https://www.unicode.org/reports/tr29/)
- Related: [Grapheme Split](grapheme-split.md), [UTF-8 Explain](utf8-explain.md), [Text and bytes](../../learn/text-and-bytes.md)

<!-- docs:nav -->
---

[← Analyse Characters](analyse-characters.md) · [Contents](../../README.md) · [Escape Unicode →](escape-unicode.md)
<!-- /docs:nav -->
