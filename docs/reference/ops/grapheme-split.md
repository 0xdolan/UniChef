<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Grapheme Split

Join the extended grapheme clusters (UAX #29) with `delimiter`.

| Id | Input | Output | Background |
|---|---|---|---|
| `grapheme-split` | string | string | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

A grapheme cluster is what a reader sees as one character, which can be several code points.
This operation splits the text into extended grapheme clusters with the rules of UAX #29 and
joins them with `delimiter` (a new line by default).

**Worked example.** `é👋🏽🇮🇶` with `delimiter=|` gives `é|👋🏽|🇮🇶`.

| Cluster | Code points | Why they belong together |
|---|---|---|
| `é` | U+00E9 | one code point (or `e` + U+0301: a mark joins its base) |
| `👋🏽` | U+1F44B U+1F3FD | an emoji modifier joins its base |
| `🇮🇶` | U+1F1EE U+1F1F6 | regional indicators pair up into a flag |

Other rules keep CR LF together, keep Hangul syllables made of jamo together, and join emoji
sequences linked by ZERO WIDTH JOINER, such as `👩‍💻`.

Count graphemes (with [Count](count.md)) when a limit is about what users see, such as the
length of a display name. Cutting text in the middle of a cluster splits a flag into two
letters or drops a skin tone.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | string | `\n` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `é👋🏽🇮🇶` | `delimiter= ` | `é 👋🏽 🇮🇶` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DcoxCoAwDAXQq8if6-Caq4hDwVADrQ1JcCm9u53fG_jYXPoLOhI8WB10DnQFoVjWhxvvrlUCCdnK4oGbqzQJtpU2zHnNHw&i=Sz3T-GH-xO4P8_v3fpjfvg6ItwEA), or search for "Grapheme Split" in the operation list.

**CLI:**

```sh
unichef op grapheme-split --arg 'delimiter= ' 'é👋🏽🇮🇶'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("grapheme-split", {"delimiter": " "}, Dish.of_string("é👋🏽🇮🇶"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("grapheme-split", {"delimiter": " "}, { type: 'string', value: "é👋🏽🇮🇶" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #29: Unicode Text Segmentation](https://www.unicode.org/reports/tr29/)
- [Unicode emoji sequences (UTS #51)](https://www.unicode.org/reports/tr51/)
- Related: [Count](count.md), [Analyse Characters](analyse-characters.md), [Unicode](../../learn/unicode.md)

<!-- docs:nav -->
---

[← From Code Points](from-code-points.md) · [Contents](../../README.md) · [Normalize →](normalize.md)
<!-- /docs:nav -->
