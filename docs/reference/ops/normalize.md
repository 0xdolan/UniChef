<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Normalize

Apply a Unicode normalization form (UAX #15) from the pinned UCD.

| Id | Input | Output | Background |
|---|---|---|---|
| `normalize` | string | string | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

The same text can be stored as different code points. `é` is either U+00E9 (precomposed) or
`e` + U+0301 (combining acute). Normalisation (UAX #15) picks one form, so that equal-looking
text compares equal.

| `form` | Does | `é` becomes | `ﬁ①Ｈ²` becomes |
|---|---|---|---|
| `NFC` | canonical decomposition, then composition | U+00E9 | `ﬁ①Ｈ²` |
| `NFD` | canonical decomposition | U+0065 U+0301 | `ﬁ①Ｈ²` |
| `NFKC` | compatibility decomposition, then composition | U+00E9 | `fi1H2` |
| `NFKD` | compatibility decomposition | U+0065 U+0301 | `fi1H2` |

**Canonical** forms only change how a character is stored, never how it looks or what it
means. **Compatibility** forms (the K forms) also replace ligatures, circled and full-width
forms, superscripts and similar variants with plain characters, which loses formatting.

**Worked example.** To check whether two strings are the same text, normalise both to NFC and
compare. To build a search index or an identifier, NFKC folds more variants together
(Python identifiers and IDNA use it).

Normalisation uses the decomposition and composition data of UniChef's own UCD, so the result
is the same in every runtime, whatever Unicode version the browser or Python ships.

## Security notes

Normalise **before** you validate. If a check runs on the raw text and a later step applies
NFKC, `＜script＞` (full-width) passes the check and becomes `<script>`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `form` | choice | `NFC` | `NFC`, `NFD`, `NFKC`, `NFKD` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `ﬁ ① Ｘ²` | `form=NFKC` | `fi 1 X2` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKyy_KTczJrEpV0lFKLEoHylQrpQHFgFJ-bt7OSrW1sbUA&i=e7-mUeHRxAUK7_fsOLQJAA), or search for "Normalize" in the operation list.

**CLI:**

```sh
unichef op normalize --arg form=NFKC 'ﬁ ① Ｘ²'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("normalize", {"form": "NFKC"}, Dish.of_string("ﬁ ① Ｘ²"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("normalize", {"form": "NFKC"}, { type: 'string', value: "ﬁ ① Ｘ²" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #15: Unicode Normalization Forms](https://www.unicode.org/reports/tr15/)
- [Unicode normalization FAQ](https://www.unicode.org/faq/normalization.html)
- Related: [Strip Diacritics](strip-diacritics.md), [Detect Confusables](detect-confusables.md), [Unicode](../../learn/unicode.md)

<!-- docs:nav -->
---

[← Grapheme Split](grapheme-split.md) · [Contents](../../README.md) · [Show Bidi Classes →](show-bidi-classes.md)
<!-- /docs:nav -->
