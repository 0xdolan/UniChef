<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# To Punycode

Encode the input with Punycode (RFC 3492). With `domain`, split it into labels at full stops (U+002E, U+3002, U+FF0E, U+FF61), encode each label that has a non-ASCII character as xn-- plus Punycode, and join the labels with U+002E. No mapping or checks are applied; use idna-to-ascii for that.

| Id | Input | Output | Background |
|---|---|---|---|
| `to-punycode` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

Punycode (RFC 3492) writes a Unicode string using only `a–z`, `0–9` and `-`, so it fits in
DNS labels.

**How it works**, for `münchen`:

1. **Copy the basic characters.** The ASCII characters are copied in order: `mnchen`. If there
   were any, a `-` follows.
2. **Encode the insertions.** The non-ASCII characters are processed in code-point order. For
   each, the encoder computes a single number, a *delta*, that combines *how far its code point
   is from the previous one* and *where in the string it goes*. For `ü` (U+00FC) inserted at
   position 1, the delta is (0xFC − 0x80) × (6 + 1) + 1 = 869.
3. **Write each delta as a variable-length integer** in base 36 (`a–z` = 0–25, `0–9` =
   26–35), with thresholds that adapt after every character (the *bias*), so small deltas take
   few characters. 869 is written `3ya`.

Result: `mnchen-3ya`.

With `domain`, the input is split into labels at full stops (including the ideographic and
full-width ones `。` `．` `｡`), and only labels with a non-ASCII character are encoded and
given the `xn--` prefix: `bücher.example` becomes `xn--bcher-kva.example`.

This operation applies the algorithm only. It does not lower-case, normalise or check the
name; real domain names should go through [IDNA to ASCII](idna-to-ascii.md).

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `domain` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `münchen` | — | `mnchen-3ya` |
| `bücher.example` | `domain=true` | `xn--bcher-kva.example` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqydctKM2rTM5PSVXSUUosSgfKVdfWxtYCAA&i=yz28Jy85IzUPAA), or search for "To Punycode" in the operation list.

**CLI:**

```sh
unichef op to-punycode 'münchen'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("to-punycode", {}, Dish.of_string("münchen"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("to-punycode", {}, { type: 'string', value: "münchen" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [RFC 3492: Punycode](https://www.rfc-editor.org/rfc/rfc3492)
- [Punycode on Wikipedia](https://en.wikipedia.org/wiki/Punycode)
- Related: [From Punycode](from-punycode.md), [IDNA to ASCII](idna-to-ascii.md), [Web encodings](../../learn/web-encodings.md)

<!-- docs:nav -->
---

[← To Octal](to-octal.md) · [Contents](../../README.md) · [Unescape String →](unescape-string.md)
<!-- /docs:nav -->
