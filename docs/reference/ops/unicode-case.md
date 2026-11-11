<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Unicode Case

Full case mapping with Final_Sigma and the `tr`, `az` and `lt` tailorings. `fold` is full case folding, or simple folding with `simple` (ignored by other modes).

| Id | Input | Output | Background |
|---|---|---|---|
| `unicode-case` | string | string | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

Case mapping in Unicode is more than swapping `A–Z` and `a–z`. UniChef uses the full mappings
from the pinned UCD (`UnicodeData.txt` plus `SpecialCasing.txt`):

- **One character can become several**: `ß` upper-cases to `SS`, `ﬁ` to `FI`.
- **Context matters**: Greek capital sigma lower-cases to `ς` at the end of a word and `σ`
  elsewhere (Final_Sigma). `ΟΔΟΣ` becomes `οδος` with a final `ς`.
- **Language matters**: with `locale=tr` or `az`, `i` upper-cases to `İ` and `I` lower-cases
  to `ı`, so `istanbul` becomes `İSTANBUL`. `lt` keeps the dot above `i` when accents follow.

| `mode` | Result for `Straße` |
|---|---|
| `upper` | `STRASSE` |
| `lower` | `straße` |
| `title` | `Straße` (first cased letter of each word upper-cased) |
| `fold` | `strasse` |

**Case folding** is for comparing strings without regard to case, not for display. Full
folding maps `ß` to `ss`, so `Straße` and `STRASSE` fold to the same string. With `simple`,
only one-to-one folds are used (`ß` stays `ß`), which keeps the length the same.

**Worked example.** To compare two user names case-insensitively, fold both and compare. The
lower-case versions of `STRASSE` and `Straße` differ, but their folds are equal.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `mode` | choice | `upper` | `upper`, `lower`, `title`, `fold` |
| `locale` | choice | `none` | `none`, `tr`, `az`, `lt` |
| `simple` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `straße` | `mode=upper` | `STRASSE` |
| `İstanbul` | `mode=lower`, `locale=tr` | `istanbul` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzctMzk9J1U1OLE5V0lFKLEoHSlYr5QLFQLIFBalFSrW1sbUA&i=Ky4pSjw8PxUA), or search for "Unicode Case" in the operation list.

**CLI:**

```sh
unichef op unicode-case --arg mode=upper 'straße'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("unicode-case", {"mode": "upper"}, Dish.of_string("straße"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("unicode-case", {"mode": "upper"}, { type: 'string', value: "straße" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Unicode Standard §3.13: default case algorithms](https://www.unicode.org/versions/latest/core-spec/chapter-3/)
- [SpecialCasing.txt](https://www.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt)
- [The Turkish İ problem](https://en.wikipedia.org/wiki/Dotted_and_dotless_I_in_computing)
- Related: [Normalize](normalize.md), [Detect Confusables](detect-confusables.md), [Unicode](../../learn/unicode.md)

<!-- docs:nav -->
---

[← Unescape Unicode](unescape-unicode.md) · [Contents](../../README.md) · [UTF-8 Explain →](utf8-explain.md)
<!-- /docs:nav -->
