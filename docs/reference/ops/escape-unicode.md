<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Escape Unicode

Write characters as escapes with upper-case hex. `scope` picks every non-ASCII character, every character, or only non-printable ones (categories C, Zl, Zp, Zs other than U+0020, and default-ignorables). `backslash-u` and `percent-u` write astral characters as surrogate pairs.

| Id | Input | Output | Background |
|---|---|---|---|
| `escape-unicode` | string | string | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

Escape Unicode writes characters as escape sequences so that text survives systems that only
handle ASCII, or so that invisible characters become visible.

**Worked example: `é👋`**

| `format` | Output | Used in |
|---|---|---|
| `backslash-u` | `\u00E9\uD83D\uDC4B` | JSON, JavaScript, Java, C# |
| `backslash-u-braces` | `\u{E9}\u{1F44B}` | modern JavaScript, Rust, PHP, Swift (`\u{…}`) |
| `backslash-big-u` | `\U000000E9\U0001F44B` | Python, C, C++ |
| `u-plus` | `U+00E9U+1F44B` | documentation |
| `html-hex` | `&#xE9;&#x1F44B;` | HTML, XML |
| `html-decimal` | `&#233;&#128075;` | HTML, XML |
| `percent-u` | `%u00E9%uD83D%uDC4B` | old JavaScript `escape()`, IIS |

`backslash-u` and `percent-u` use 16-bit units, so a character above U+FFFF becomes a UTF-16
surrogate pair: `👋` U+1F44B is `D83D DC4B`. `backslash-big-u` always writes `\U` with eight
digits.

`scope` picks what to escape: `non-ascii` (default), `all`, or `non-printable`, which escapes
only control, format, separator and unassigned characters and leaves the rest readable:
`a`, ZERO WIDTH SPACE, `b`, RIGHT-TO-LEFT OVERRIDE becomes `a\u200Bb\u202E`.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `format` | choice | `backslash-u` | `backslash-u`, `backslash-u-braces`, `backslash-big-u`, `u-plus`, `html-hex`, `html-decimal`, `percent-u` |
| `scope` | choice | `non-ascii` | `non-ascii`, `all`, `non-printable` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `café 👋` | — | `caf\u00E9 \uD83D\uDC4B` |
| `café 👋` | `format=html-hex` | `caf&#xE9; &#x1F44B;` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKLU5OLEjVLc3LTM5PSVXSUUosSgdKV9fWxtYCAA&i=S05MO7xS4cP8id0A), or search for "Escape Unicode" in the operation list.

**CLI:**

```sh
unichef op escape-unicode 'café 👋'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("escape-unicode", {}, Dish.of_string("café 👋"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("escape-unicode", {}, { type: 'string', value: "café 👋" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [ECMAScript: string literals](https://tc39.es/ecma262/#sec-literals-string-literals)
- [RFC 8259 §7: JSON strings](https://www.rfc-editor.org/rfc/rfc8259#section-7)
- Related: [Unescape Unicode](unescape-unicode.md), [HTML Entity Encode](html-entity-encode.md), [Detect Invisible](detect-invisible.md)

<!-- docs:nav -->
---

[← Count](count.md) · [Contents](../../README.md) · [Filter by Property →](filter-by-property.md)
<!-- /docs:nav -->
