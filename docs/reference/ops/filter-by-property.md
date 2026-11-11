<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Filter by Property

Keep or remove the code points whose property has one of the comma-separated `value`s. Names and aliases match loosely (`L`, `Letter`, `Latn`, `Basic Latin`); a General_Category group such as `L` covers its members.

| Id | Input | Output | Background |
|---|---|---|---|
| `filter-by-property` | string | string | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

Filter by Property keeps (or removes) the code points whose property has one of the values
you list.

| `property` | Example values |
|---|---|
| `general_category` | `L` (letters), `Lu` (upper-case letters), `N`, `P` (punctuation), `Zs`, `Cf` (format characters) |
| `script` | `Latin`, `Cyrillic`, `Arab`, `Han` |
| `script_extensions` | as `script`, but matches characters shared by several scripts too |
| `block` | `Basic Latin`, `Cyrillic`, `Emoticons` |

Values are comma-separated and match loosely: case, spaces, hyphens and underscores are
ignored, and both short and long names work (`Latn` or `Latin`, `P` or `Punctuation`). A
one-letter General_Category is a group: `L` means `Lu`, `Ll`, `Lt`, `Lm` and `Lo`.

**Worked examples.**
- `pаypal` with `property=script`, `value=Cyrillic` keeps only `а`: the one Cyrillic letter
  hiding in an otherwise Latin word.
- `Hi, there!` with `value=P`, `mode=remove` gives `Hi there`.

Script values follow the UCD's `Scripts.txt`; characters used by many scripts (digits,
punctuation) have the script `Common`. Use `script_extensions` to include them in a script's
set, as UTS #39 does.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `property` | choice | `general_category` | `general_category`, `script`, `script_extensions`, `block` |
| `value` | string | `L` | — |
| `mode` | choice | `keep` | `keep`, `remove` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Zoë, 42 € 😀` | — | `Zoë` |
| `Привет, world` | `property=script`, `value=Cyrillic, Common`, `mode=keep` | `Привет, ` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKy8wpSS3STarULSjKL0gtKqlU0lFKLEoHKqmurY2tBQA&i=i8o_vFpHwcRI4VHTGoUP82c0AAA), or search for "Filter by Property" in the operation list.

**CLI:**

```sh
unichef op filter-by-property 'Zoë, 42 € 😀'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("filter-by-property", {}, Dish.of_string("Zoë, 42 € 😀"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("filter-by-property", {}, { type: 'string', value: "Zoë, 42 € 😀" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UAX #44: Unicode Character Database](https://www.unicode.org/reports/tr44/)
- [UAX #24: script property](https://www.unicode.org/reports/tr24/)
- Related: [Analyse Characters](analyse-characters.md), [Script Mix Check](script-mix-check.md), [Unicode](../../learn/unicode.md)

<!-- docs:nav -->
---

[← Escape Unicode](escape-unicode.md) · [Contents](../../README.md) · [From Code Points →](from-code-points.md)
<!-- /docs:nav -->
