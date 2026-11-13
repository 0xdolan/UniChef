<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Escape Smart Characters

Replace typographic characters (curly quotes, dashes, ellipsis, ©, ®, ™, arrows and some spaces) with plain ASCII. Other non-ASCII characters are kept (`include`), removed (`remove`) or replaced with a dot (`replace`).

| Id | Input | Output | Background |
|---|---|---|---|
| `escape-smart-characters` | string | string | [Text formats: hexdumps, escapes and identifier cases](../../learn/text-formats.md) |
<!-- /docs:head -->

## How it works

ASCII is copied. Typographic characters from a fixed table become their plain ASCII
spelling: curly quotes and primes become `"` and `'`, hyphens and dashes `-` or `--`, the
ellipsis `...`, `©` `(c)`, `®` `(r)`, `™` `(tm)`, arrows such as `→` `-->`, `«` `<<`, `×` `x`,
`÷` `/`, `±` `+/-`, the bullet `*` and no-break and other spaces a plain space.

Any other non-ASCII character is kept (`include`), dropped (`remove`) or written as `.`
(`replace`).

**Worked example: `“Hi” — it’s 3×4… ©`**

The result is `"Hi" -- it's 3x4... (c)`. With `unmappable=replace`, `café ✓` gives `caf. .`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `unmappable` | choice | `include` | `include`, `remove`, `replace` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `“Hi” — ok…` | — | `"Hi" -- ok...` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=DcoxDoAwCAXQu_y5HVy5inEghKiDlkDjQri7ffNLfOpxjxe0NcRUC9CeGAaChrBpj4d9drnYWebaaGA_18uqo34&i=e9QwxyPzUcNchUcNUxTysx81LAMA), or search for "Escape Smart Characters" in the operation list.

**CLI:**

```sh
unichef op escape-smart-characters '“Hi” — ok…'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("escape-smart-characters", {}, Dish.of_string("“Hi” — ok…"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("escape-smart-characters", {}, { type: 'string', value: "“Hi” — ok…" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Quotation marks in English on Wikipedia](https://en.wikipedia.org/wiki/Quotation_marks_in_English#Smart_quotes)
- Guide: [Text formats](../../learn/text-formats.md)
- Related: [Strip Diacritics](strip-diacritics.md)

<!-- docs:nav -->
---

[← Alternating caps](alternating-caps.md) · [Contents](../../README.md) · [Find / replace →](find-replace.md)
<!-- /docs:nav -->
