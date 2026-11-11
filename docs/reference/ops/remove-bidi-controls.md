<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Security

# Remove Bidi Controls

Delete every Bidi_Control character (U+061C, U+200E, U+200F, U+202A..U+202E, U+2066..U+2069).

| Id | Input | Output | Background |
|---|---|---|---|
| `remove-bidi-controls` | string | string | [Unicode security](../../learn/unicode-security.md) |
<!-- /docs:head -->

## How it works

Remove Bidi Controls deletes every character with the Bidi_Control property:

| Code points | Names |
|---|---|
| U+061C | ARABIC LETTER MARK |
| U+200E, U+200F | LEFT-TO-RIGHT MARK, RIGHT-TO-LEFT MARK |
| U+202A–U+202E | embeddings (LRE, RLE), POP DIRECTIONAL FORMATTING, overrides (LRO, RLO) |
| U+2066–U+2069 | isolates (LRI, RLI, FSI) and POP DIRECTIONAL ISOLATE |

**Worked example.** `access`, RLO, space, LRI, `level` becomes `access level`.

These characters have legitimate uses in right-to-left text, such as Arabic or Hebrew mixed
with numbers and Latin names, so removing them can change how such text is displayed. In
source code, identifiers, file names and logs they are almost never needed.

## Security notes

The Trojan Source attack (CVE-2021-42574) hides code inside comments or strings with these
controls, so that reviewers see something different from what the compiler reads. A file name
such as `invoice` + RLO + `fdp.exe` displays as `invoiceexe.pdf`. Remove the controls, or show them with
[Detect Invisible](detect-invisible.md) first to see what was hidden.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `abc\u202edef\u202c` | — | `abcdef` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSs3NL0vVTcpMydRNzs8rKcrPKVbSUUosSgcqqq6tja0FAA&i=S0xKftSwLiU17VHDGgA), or search for "Remove Bidi Controls" in the operation list.

**CLI:**

```sh
unichef op remove-bidi-controls $'abc\u202edef\u202c'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("remove-bidi-controls", {}, Dish.of_string("abc\u202edef\u202c"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("remove-bidi-controls", {}, { type: 'string', value: "abc\u202edef\u202c" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Trojan Source (CVE-2021-42574)](https://trojansource.codes/)
- [UAX #9 §2: explicit directional formatting characters](https://www.unicode.org/reports/tr9/#Explicit_Directional_Embeddings)
- Related: [Show Bidi Classes](show-bidi-classes.md), [Detect Invisible](detect-invisible.md), [Unicode security](../../learn/unicode-security.md)

<!-- docs:nav -->
---

[← Detect Invisible Characters](detect-invisible.md) · [Contents](../../README.md) · [Script Mix Check →](script-mix-check.md)
<!-- /docs:nav -->
