<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Swap case

Upper-case every character that changes when upper-cased, and lower-case the rest, one code point at a time with full case mappings (`ß` becomes `SS`).

| Id | Input | Output | Background |
|---|---|---|---|
| `swap-case` | string | string | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`swap-case` looks at one code point at a time. If upper-casing it changes it, the upper-case
form is used; otherwise the lower-case form is used.

**Worked example: `straße`**

| Character | Upper-cased | Result |
|---|---|---|
| `s`, `t`, `r`, `a`, `e` | changes | `S`, `T`, `R`, `A`, `E` |
| `ß` | changes to `SS` | `SS` |

Result: `STRASSE`. Full case mappings can change the length: `ß` becomes two letters, and `İ`
becomes `i` plus a combining dot. Because each character is handled alone, a capital `Σ` at
the end of a word becomes `σ`, not the final form `ς`. Characters without case, such as
digits, CJK and emoji, are copied.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello, Wörld` | — | `hELLO, wÖRLD` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqLk8s0E1OLE5V0lFKLEoHylTX1sbWAgA&i=80jNycnXUQg_vK0oJwUA), or search for "Swap case" in the operation list.

**CLI:**

```sh
unichef op swap-case 'Hello, Wörld'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("swap-case", {}, Dish.of_string("Hello, Wörld"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("swap-case", {}, { type: 'string', value: "Hello, Wörld" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Unicode case mapping FAQ](https://www.unicode.org/faq/casemap_charprop.html)
- Related: [Unicode Case](unicode-case.md), [Alternating caps](alternating-caps.md)

<!-- docs:nav -->
---

[← Strip HTML tags](strip-html-tags.md) · [Contents](../../README.md) · [Tail →](tail.md)
<!-- /docs:nav -->
