<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# IDNA To Unicode

UTS #46 ToUnicode with nontransitional processing: map, normalise to NFC, decode xn-- labels and check every label. Any error fails the op with E_DECODE, naming the first error found.

| Id | Input | Output | Background |
|---|---|---|---|
| `idna-to-unicode` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

IDNA to Unicode shows a domain name the way a user would see it. Following UTS #46 with
nontransitional processing, it maps and normalises the name, decodes every `xn--` label from
Punycode, and checks each label with the same rules as [IDNA to ASCII](idna-to-ascii.md).

**Worked examples.** `xn--bcher-kva.example` becomes `bücher.example`, and `XN--FA-HIA.DE`
becomes `faß.de` (the prefix is case-insensitive and the name is lower-cased).

## Security notes

Use it to reveal what a link really points to. A label that decodes into a mix of scripts,
such as Latin with one Cyrillic letter, is a classic homograph attack: run
[Script Mix Check](script-mix-check.md) and [Detect Confusables](detect-confusables.md) on the
result. A label that fails the checks would be refused by a browser.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `check_hyphens` | boolean | `true` | — |
| `check_bidi` | boolean | `true` | — |
| `check_joiners` | boolean | `true` | — |
| `use_std3_ascii_rules` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `xn--bcher-kva.example` | — | `bücher.example` |
| `XN--FA-HIA.DE` | — | `faß.de` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKTMlL1C3J1y3Ny0zOT0lV0lFKLEoHylfX1sbWAgA&i=q8jT1U1Kzkgt0s0uS9RLrUjMLchJBQA), or search for "IDNA To Unicode" in the operation list.

**CLI:**

```sh
unichef op idna-to-unicode xn--bcher-kva.example
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("idna-to-unicode", {}, Dish.of_string("xn--bcher-kva.example"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("idna-to-unicode", {}, { type: 'string', value: "xn--bcher-kva.example" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UTS #46: Unicode IDNA compatibility processing](https://www.unicode.org/reports/tr46/)
- [IDN homograph attack on Wikipedia](https://en.wikipedia.org/wiki/IDN_homograph_attack)
- Related: [IDNA to ASCII](idna-to-ascii.md), [From Punycode](from-punycode.md), [Unicode security](../../learn/unicode-security.md)

<!-- docs:nav -->
---

[← IDNA To ASCII](idna-to-ascii.md) · [Contents](../../README.md) · [PEM to Hex →](pem-to-hex.md)
<!-- /docs:nav -->
