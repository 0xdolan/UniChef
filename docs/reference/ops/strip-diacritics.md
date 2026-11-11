<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Strip Diacritics

NFD, then drop nonspacing marks that are Diacritic and of the Inherited script, then NFC. Script-specific marks such as the Devanagari virama are kept, and letters with no decomposition (ø, ł) are unchanged.

| Id | Input | Output | Background |
|---|---|---|---|
| `strip-diacritics` | string | string | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

Strip Diacritics removes accents and similar marks from letters:

1. **Decompose** to NFD, so `è` becomes `e` plus U+0300 COMBINING GRAVE ACCENT.
2. **Drop** each nonspacing mark (General_Category Mn) that has the Diacritic property and the
   Inherited script, that is, the marks shared by many scripts.
3. **Recompose** to NFC.

**Worked example.** `Crème brûlée, Łódź, नमस्ते` becomes `Creme brulee, Łodz, नमस्ते`.

- `Ł` stays, because it has no decomposition: the stroke is part of the letter, not a separate
  mark.
- The Devanagari virama and vowel signs stay, because they belong to the Devanagari script and
  removing them would change the word.

This is more careful than the common shortcut of deleting U+0300–U+036F after NFD, which
misses marks outside that block and breaks scripts that are not Latin. The result is useful
for search and sort keys and for file names. It is lossy: never use it on data you must keep.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Crème brûlée` | — | `Creme brulee` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QsgJyizILdFMyE5OLMksyk4uVdJQSi9KBCqpra2NrAQ&i=cy46vCI3VSGp6PDunMMrUwE), or search for "Strip Diacritics" in the operation list.

**CLI:**

```sh
unichef op strip-diacritics 'Crème brûlée'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("strip-diacritics", {}, Dish.of_string("Crème brûlée"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("strip-diacritics", {}, { type: 'string', value: "Crème brûlée" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #44: the Diacritic property](https://www.unicode.org/reports/tr44/)
- [Diacritic on Wikipedia](https://en.wikipedia.org/wiki/Diacritic)
- Related: [Normalize](normalize.md), [Unicode Case](unicode-case.md), [Unicode](../../learn/unicode.md)

<!-- docs:nav -->
---

[← Show Bidi Classes](show-bidi-classes.md) · [Contents](../../README.md) · [To Code Points →](to-code-points.md)
<!-- /docs:nav -->
