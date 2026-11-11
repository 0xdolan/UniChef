<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Show Bidi Classes

One row per code point with its Bidi_Class (short and long name) and whether it is Bidi_Mirrored. Controls and invisible characters are shown by name.

| Id | Input | Output | Background |
|---|---|---|---|
| `show-bidi-classes` | string | table | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

Every code point has a Bidi_Class that tells the Unicode Bidirectional Algorithm (UAX #9) how
it behaves in mixed left-to-right and right-to-left text. This operation lists it for each
code point, with whether the character is mirrored (drawn reversed in right-to-left text,
like `(` and `)`).

**Worked example.** `a`, `א`, RIGHT-TO-LEFT OVERRIDE, `1`, `(`:

| Character | Class | Long name | Mirrored |
|---|---|---|---|
| `a` | L | Left_To_Right | false |
| `א` | R | Right_To_Left | false |
| U+202E | RLO | Right_To_Left_Override | false |
| `1` | EN | European_Number | false |
| `(` | ON | Other_Neutral | true |

Strong classes (L, R, AL) set the direction. Weak ones (EN, AN, ES, CS…) and neutral ones (ON,
WS) take the direction of their surroundings. The explicit formatting characters (LRE, RLE,
LRO, RLO, PDF, LRI, RLI, FSI, PDI) change the direction of the text that follows.

## Security notes

The explicit formatting classes are what Trojan Source attacks use: they can make code look
different from what the compiler reads. Any RLO, LRO, RLI, LRI, FSI or PDI in source code
deserves a look; remove them with [Remove Bidi Controls](remove-bidi-controls.md).

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `a\u202eب(1` | — | `index\tcp\tchar\tbidi\tbidi_name\tmirrored\n0\tU+0061\ta\tL\tLeft_To_Right\tfalse\n1\tU+202E\t⟨RIGHT-TO-LEFT OVERRIDE⟩\tRLO\tRight_To_Left_Override\tfalse\n2\tU+0628\tب\tAL\tArabic_Letter\tfalse\n3\tU+0028\t(\tON\tOther_Neutral\ttrue\n4\tU+0031\t1\tEN\tEuropean_Number\tfalse` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzsgv103KTMnUTc5JLC5OLVbSUUosSgeqqK6tja0FAA&i=S3zUsO7GCg1DAA), or search for "Show Bidi Classes" in the operation list.

**CLI:**

```sh
unichef op show-bidi-classes $'a\u202eب(1'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("show-bidi-classes", {}, Dish.of_string("a\u202eب(1"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("show-bidi-classes", {}, { type: 'string', value: "a\u202eب(1" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #9: Unicode Bidirectional Algorithm](https://www.unicode.org/reports/tr9/)
- [Trojan Source (CVE-2021-42574)](https://trojansource.codes/)
- Related: [Remove Bidi Controls](remove-bidi-controls.md), [Detect Invisible](detect-invisible.md), [Unicode security](../../learn/unicode-security.md)

<!-- docs:nav -->
---

[← Normalize](normalize.md) · [Contents](../../README.md) · [Strip Diacritics →](strip-diacritics.md)
<!-- /docs:nav -->
