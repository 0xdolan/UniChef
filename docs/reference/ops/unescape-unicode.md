<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Unicode

# Unescape Unicode

Replace escapes with characters; `all` recognises every format. Adjacent UTF-16 escapes of one format combine into a pair; a lone surrogate becomes U+FFFD, and an escape above 10FFFF is left as it is.

| Id | Input | Output | Background |
|---|---|---|---|
| `unescape-unicode` | string | string | [Unicode](../../learn/unicode.md) |
<!-- /docs:head -->

## How it works

Unescape Unicode finds escape sequences and replaces them with characters. With the default
`format=all`, it recognises `\uXXXX`, `\u{X…}`, `\UXXXXXXXX`, `U+XXXX`, `&#xX…;`, `&#N;` and
`%uXXXX` in the same text. Choose one format to leave the others alone, for example when the
text also contains literal `U+` notation you want to keep.

**Worked example.** `\u00e9\ud83d\udc4b U+1F600 &#xE9; %u00E9` becomes `é👋 😀 é é`.

- Adjacent UTF-16 escapes of the same format that form a surrogate pair combine into one
  character: `👋` is `👋`.
- A lone surrogate, such as `\ud800` on its own, becomes U+FFFD.
- An escape above U+10FFFF is left as it is.
- Hex digits may be upper or lower case.

Unescaping is the first step in reading obfuscated JavaScript and JSON payloads, which often
hide strings as `\u0061\u006c\u0065\u0072\u0074` (`alert`).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `format` | choice | `all` | `all`, `backslash-u`, `backslash-u-braces`, `backslash-big-u`, `u-plus`, `html-hex`, `html-decimal`, `percent-u` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `caf\u00e9 \U0001F44B` | — | `café 👋` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqzUstTk4sSNUtzctMzk9JVdJRSixKByqorq2NrQUA&i=S05Miyk1MEi1VIgJNTAwMHQzMXECAA), or search for "Unescape Unicode" in the operation list.

**CLI:**

```sh
unichef op unescape-unicode 'caf\u00e9 \U0001F44B'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("unescape-unicode", {}, Dish.of_string("caf\\u00e9 \\U0001F44B"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("unescape-unicode", {}, { type: 'string', value: "caf\\u00e9 \\U0001F44B" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [ECMAScript: string literals](https://tc39.es/ecma262/#sec-literals-string-literals)
- [RFC 8259 §7: JSON strings](https://www.rfc-editor.org/rfc/rfc8259#section-7)
- Related: [Escape Unicode](escape-unicode.md), [HTML Entity Decode](html-entity-decode.md), [From Code Points](from-code-points.md)

<!-- docs:nav -->
---

[← To Code Points](to-code-points.md) · [Contents](../../README.md) · [Unicode Case →](unicode-case.md)
<!-- /docs:nav -->
