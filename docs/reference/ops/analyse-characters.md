<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Analyse Characters

One row per code point (or grapheme cluster) with the columns of PRD §4.6. In grapheme mode `index` is the inclusive code-point range `start-end`, per-code-point values are joined with ` + `, bytes and units with a space, and flags are merged.

| Id | Input | Output | Background |
|---|---|---|---|
| `analyse-characters` | string | table | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

Analyse Characters lists every code point with its properties from UniChef's UCD.

**Worked example: `é`**

| Column | Value | Meaning |
|---|---|---|
| `cp` | U+00E9 | code point |
| `name` | LATIN SMALL LETTER E WITH ACUTE | character name |
| `gc` | Ll | General_Category: lower-case letter |
| `block` | Latin-1 Supplement | block |
| `script`, `scx` | Latn | Script and Script_Extensions |
| `age` | 1.1 | Unicode version that added it |
| `bidi` | L | Bidi_Class |
| `ea` | A | East_Asian_Width: ambiguous |
| `utf8`, `utf16` | `C3 A9`, `00E9` | encoded forms |
| `decomposition` | `0065 0301` | canonical decomposition |
| `flags` | | invisible, bidi control, deprecated… |

With `granularity=grapheme`, there is one row per grapheme cluster. Its `index` is a
code-point range such as `1-2`, and per-code-point columns join their values with spaces.

The result is a table: view it in the web app, or turn it into JSON or CSV with the next step.
It answers "what is this character, really?" when text looks normal but behaves strangely.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `granularity` | choice | `codepoint` | `codepoint`, `grapheme` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `é👋🏽` | — | `index\tcp\tchar\tname\tgc\tblock\tscript\tscx\tage\tbidi\tea\tutf8\tutf16\tdecomposition\tflags\n0\tU+0065\te\tLATIN SMALL LETTER E\tLl\tBasic Latin\tLatn\tLatn\t1.1\tL\tNa\t65\t0065\t\t\n1\tU+0301\t◌́\tCOMBINING ACUTE ACCENT\tMn\tCombining Diacritical Marks\tZinh\tCher Cyrl Grek Latn Osge Sunu Tale Todr\t1.1\tNSM\tA\tCC 81\t0301\t\t\n2\tU+1F44B\t👋\tWAVING HAND SIGN\tSo\tMiscellaneous Symbols and Pictographs\tZyyy\tZyyy\t6.0\tON\tW\tF0 9F 91 8B\tD83D DC4B\t\t\n3\tU+1F3FD\t🏽\tEMOJI MODIFIER FITZPATRICK TYPE-4\tSk\tMiscellaneous Symbols and Pictographs\tZyyy\tZyyy\t8.0\tON\tW\tF0 9F 8F BD\tD83C DFFD\t\t` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKzEvMqSxO1U3OSCxKTC4BKlTSUUosSgcqqa6tja0FAA&i=Sz3T-GH-xO4P8_v3AgA), or search for "Analyse Characters" in the operation list.

**CLI:**

```sh
unichef op analyse-characters 'é👋🏽'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("analyse-characters", {}, Dish.of_string("é👋🏽"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("analyse-characters", {}, { type: 'string', value: "é👋🏽" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #44: Unicode Character Database](https://www.unicode.org/reports/tr44/)
- [Unicode code charts](https://www.unicode.org/charts/)
- Related: [To Code Points](to-code-points.md), [Detect Invisible](detect-invisible.md), [Show Bidi Classes](show-bidi-classes.md)

<!-- docs:nav -->
---

[← URL Encode](url-encode.md) · [Contents](../../README.md) · [Count →](count.md)
<!-- /docs:nav -->
