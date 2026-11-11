<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# IDNA To ASCII

UTS #46 ToASCII with nontransitional processing: map, normalise to NFC, check every label, and encode non-ASCII labels as xn-- plus Punycode. Any error fails the op with E_DECODE, naming the first error found. `verify_dns_length` requires labels of 1 to 63 characters and a name of 1 to 253 (not counting a final dot).

| Id | Input | Output | Background |
|---|---|---|---|
| `idna-to-ascii` | string | string | [Web encodings](../../learn/web-encodings.md) |
<!-- /docs:head -->

## How it works

IDNA to ASCII converts an internationalised domain name into the ASCII form that the DNS
uses, following UTS #46 with nontransitional processing (as current browsers do):

1. **Map** every character through the UTS #46 mapping table: upper case to lower case,
   full-width to normal width, and some characters removed or refused.
2. **Normalise** to NFC.
3. **Split** into labels at full stops.
4. **Check** each label: no hyphens in positions 3 and 4 or at either end (`check_hyphens`);
   only letters, digits and hyphens (`use_std3_ascii_rules`); the Bidi rule for right-to-left
   labels (`check_bidi`); the ContextJ rules for ZWJ and ZWNJ (`check_joiners`).
5. **Encode** each label that has non-ASCII characters as `xn--` plus
   [Punycode](to-punycode.md).
6. **Check lengths** (`verify_dns_length`): each label 1 to 63 characters and the whole name
   1 to 253.

**Worked examples.** `Bücher.Example` becomes `xn--bcher-kva.example`. `faß.de` becomes
`xn--fa-hia.de`: with nontransitional processing `ß` is kept, while the older transitional
processing (IDNA2003) mapped it to `ss` and gave `fass.de`, a different domain.

Any error fails the step and names the first problem found.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `check_hyphens` | boolean | `true` | — |
| `check_bidi` | boolean | `true` | — |
| `check_joiners` | boolean | `true` | — |
| `use_std3_ascii_rules` | boolean | `true` | — |
| `verify_dns_length` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Bücher.Example` | — | `xn--bcher-kva.example` |
| `faß.de` | — | `xn--fa-hia.de` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslLKTMlL1C3J100sTs7MVNJRSixKB8pW19bG1gIA&i=czq8JzkjtUjPtSIxtyAnFQA), or search for "IDNA To ASCII" in the operation list.

**CLI:**

```sh
unichef op idna-to-ascii 'Bücher.Example'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("idna-to-ascii", {}, Dish.of_string("Bücher.Example"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("idna-to-ascii", {}, { type: 'string', value: "Bücher.Example" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UTS #46: Unicode IDNA compatibility processing](https://www.unicode.org/reports/tr46/)
- [RFC 5891: IDNA protocol](https://www.rfc-editor.org/rfc/rfc5891)
- Related: [IDNA to Unicode](idna-to-unicode.md), [To Punycode](to-punycode.md), [Script Mix Check](script-mix-check.md)

<!-- docs:nav -->
---

[← HTML Entity Encode](html-entity-encode.md) · [Contents](../../README.md) · [IDNA To Unicode →](idna-to-unicode.md)
<!-- /docs:nav -->
