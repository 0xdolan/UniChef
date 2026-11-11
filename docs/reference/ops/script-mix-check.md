<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Security

# Script Mix Check

The UTS #39 restriction level of the whole input: ASCII-Only, Single Script, Highly Restrictive, Moderately Restrictive, Minimally Restrictive or Unrestricted. `profile` (default true) applies step 1, so characters that are not Identifier_Status=Allowed (including spaces and punctuation) give Unrestricted.

| Id | Input | Output | Background |
|---|---|---|---|
| `script-mix-check` | string | string | [Unicode security](../../learn/unicode-security.md) |
<!-- /docs:head -->

## How it works

Script Mix Check gives the UTS #39 *restriction level* of the whole input: how far it mixes
writing systems. Each level is stricter than the next:

| Level | Means | Example |
|---|---|---|
| ASCII-Only | only ASCII | `paypal` |
| Single Script | one script (plus Common and Inherited characters) | `παράδειγμα` |
| Highly Restrictive | Latin with Han, Hiragana and Katakana; or with Han and Bopomofo; or with Han and Hangul | `東京tokyo` |
| Moderately Restrictive | Latin with one other Recommended script, except Cyrillic and Greek | `abcא` |
| Minimally Restrictive | any mix of Recommended scripts | `pаypal` (Latin + Cyrillic) |
| Unrestricted | anything else | `pay pal!` |

Scripts are taken from Script_Extensions, so a character used by several scripts (such as a
Japanese prolonged sound mark) fits any of them.

With `profile=true` (the default), step 1 of the UTS #39 algorithm applies first: any character
that is not Identifier_Status=Allowed makes the result Unrestricted. Spaces and most
punctuation are not allowed in identifiers, so `pay pal!` is Unrestricted. With
`profile=false`, that step is skipped and `pay pal!` is ASCII-Only.

## Security notes

Browsers show a domain in its Unicode form only when its labels pass a check like this; other
domains are shown as `xn--` Punycode. Require Highly Restrictive or stricter for user names
and identifiers you create, and treat Minimally Restrictive text, especially Latin mixed with
Cyrillic or Greek, as a likely spoof.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `profile` | boolean | `true` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `paypal` | — | `ASCII-Only` |
| `pаypal` | — | `Minimally Restrictive` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqTi7KLCjRzc2s0E3OSE3OVtJRSixKByqorq2NrQUA&i=K0isLEjMAQA), or search for "Script Mix Check" in the operation list.

**CLI:**

```sh
unichef op script-mix-check paypal
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("script-mix-check", {}, Dish.of_string("paypal"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("script-mix-check", {}, { type: 'string', value: "paypal" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [UTS #39 §5.2: restriction-level detection](https://www.unicode.org/reports/tr39/#Restriction_Level_Detection)
- [Chromium IDN display policy](https://chromium.googlesource.com/chromium/src/+/main/docs/idn.md)
- Related: [Detect Confusables](detect-confusables.md), [Filter by Property](filter-by-property.md), [Unicode security](../../learn/unicode-security.md)

<!-- docs:nav -->
---

[← Remove Bidi Controls](remove-bidi-controls.md) · [Contents](../../README.md) · [Adler-32 →](adler32.md)
<!-- /docs:nav -->
